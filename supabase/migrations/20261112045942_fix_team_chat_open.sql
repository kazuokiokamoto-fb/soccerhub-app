-- Open an existing team chat or create one, and add the caller as a member.
--
-- Legacy team chats stored the team on team_a_id and left team_id null.
-- get_or_create_team_chat_thread only matched team_id, so it missed those
-- rows, and the chat list attaches a team chat only when team_id is set.
-- Backfill team_id in place. Teams, messages, and thread ids are not rewritten.
--
-- chat_threads_shape_check requires team_a_id on thread_type = 'team'.
-- New rows set both team_id and team_a_id to the same team.
--
-- chat_members_thread_team_uidx and chat_members_thread_team_unique allowed
-- only one row per team on a thread. A second teammate's insert was discarded,
-- so they never became a chat member and could not read or send. Those indexes
-- are not tables and do not hold rows. (thread_id, user_id) uniqueness stays.
-- chat_members policies are unchanged.

update public.chat_threads
   set team_id = team_a_id
 where thread_type = 'team'
   and team_id is null
   and team_a_id is not null
   and team_b_id is null
   and slot_id is null;

create unique index if not exists chat_threads_team_chat_team_a_id_uidx
  on public.chat_threads (team_a_id)
  where thread_type = 'team'
    and team_b_id is null
    and slot_id is null
    and team_a_id is not null;

create unique index if not exists chat_threads_team_chat_team_id_uidx
  on public.chat_threads (team_id)
  where thread_type = 'team'
    and team_id is not null;

drop index if exists public.chat_members_thread_team_uidx;
drop index if exists public.chat_members_thread_team_unique;

create or replace function public.get_or_create_team_chat_thread(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  if p_team_id is null then
    raise exception 'not a member of team';
  end if;

  if not exists (
    select 1
    from public.teams t
    where t.id = p_team_id
      and t.owner_id = v_me
  ) and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = v_me
  ) then
    raise exception 'not a member of team';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('team-chat:' || p_team_id::text, 0));

  select t.id
    into v_thread_id
  from public.chat_threads t
  where t.thread_type = 'team'
    and t.slot_id is null
    and t.team_b_id is null
    and (t.team_id = p_team_id or t.team_a_id = p_team_id)
  order by case when t.team_id = p_team_id then 0 else 1 end, t.created_at asc
  limit 1;

  if v_thread_id is null then
    begin
      insert into public.chat_threads (
        thread_type,
        team_id,
        slot_id,
        team_a_id,
        team_b_id,
        created_by
      )
      values (
        'team',
        p_team_id,
        null,
        p_team_id,
        null,
        v_me
      )
      returning id into v_thread_id;
    exception
      when unique_violation then
        select t.id
          into v_thread_id
        from public.chat_threads t
        where t.thread_type = 'team'
          and t.slot_id is null
          and t.team_b_id is null
          and (t.team_id = p_team_id or t.team_a_id = p_team_id)
        order by case when t.team_id = p_team_id then 0 else 1 end, t.created_at asc
        limit 1;

        if v_thread_id is null then
          raise;
        end if;
    end;
  elsif exists (
    select 1
    from public.chat_threads t
    where t.id = v_thread_id
      and t.team_id is null
      and t.team_a_id = p_team_id
  ) then
    update public.chat_threads
       set team_id = p_team_id
     where id = v_thread_id
       and thread_type = 'team'
       and team_id is null
       and team_a_id = p_team_id
       and team_b_id is null
       and slot_id is null;
  end if;

  insert into public.chat_members (thread_id, user_id, team_id)
  values (v_thread_id, v_me, p_team_id)
  on conflict do nothing;

  update public.chat_members
     set team_id = p_team_id
   where thread_id = v_thread_id
     and user_id = v_me
     and team_id is distinct from p_team_id;

  if not exists (
    select 1
    from public.chat_members
    where thread_id = v_thread_id
      and user_id = v_me
  ) then
    raise exception 'could not add chat member';
  end if;

  return v_thread_id;
end;
$$;

revoke all on function public.get_or_create_team_chat_thread(uuid) from public, anon;
grant execute on function public.get_or_create_team_chat_thread(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_or_create_team_chat_thread(uuid) to service_role;
  end if;
end
$$;

drop policy if exists chat_threads_insert_team_participant on public.chat_threads;

create policy chat_threads_insert_team_participant
on public.chat_threads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams t
    where t.owner_id = (select auth.uid())
      and (
        t.id = chat_threads.team_a_id
        or t.id = chat_threads.team_b_id
        or t.id = chat_threads.team_id
      )
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.user_id = (select auth.uid())
      and (
        tm.team_id = chat_threads.team_a_id
        or tm.team_id = chat_threads.team_b_id
        or tm.team_id = chat_threads.team_id
      )
  )
);
