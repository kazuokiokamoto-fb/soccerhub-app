-- Team chat open/create RLS on an empty database.
-- Does not connect to production. Builds the chat tables, applies the
-- team-chat migration, then checks legacy reuse, membership, message
-- read/send, and denial for someone outside the team. Run:
--   psql "postgresql://postgres@127.0.0.1:5432/team_chat_rls" -v ON_ERROR_STOP=1 -f scripts/check-team-chat-rls.sql
--
-- Production also has permissive chat_members INSERT policies that allow
-- any logged-in user to insert a row with user_id = auth.uid(). This
-- migration does not change those policies, so this fixture does not
-- install them. Joining through get_or_create_team_chat_thread is denied.

\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists public.teams (
  id uuid primary key,
  owner_id uuid,
  name text
);

create table if not exists public.team_members (
  team_id uuid,
  user_id uuid,
  role text
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  thread_type text not null,
  team_a_id uuid,
  team_b_id uuid,
  slot_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  team_id uuid,
  is_team_chat boolean not null default false,
  constraint chat_threads_shape_check check (
    (
      thread_type = 'direct'
      and slot_id is null
      and team_a_id is not null
      and team_b_id is not null
      and team_a_id <> team_b_id
    )
    or (thread_type = 'slot' and slot_id is not null)
    or (
      thread_type = 'team'
      and slot_id is null
      and team_a_id is not null
      and team_b_id is null
    )
  )
);

create table if not exists public.chat_members (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  user_id uuid not null,
  team_id uuid,
  created_at timestamptz not null default now(),
  constraint chat_members_thread_id_user_id_key unique (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  sender_id uuid not null,
  sender_team_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

-- Production blocks a second teammate when team_id is set. The migration
-- drops these indexes; create them first so the check fails if they remain.
create unique index chat_members_thread_team_uidx
  on public.chat_members (thread_id, team_id)
  where team_id is not null;

create unique index chat_members_thread_team_unique
  on public.chat_members (thread_id, team_id)
  where team_id is not null;

insert into public.teams (id, owner_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '青葉FC'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '別クラブ'),
  ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '新規FC');

insert into public.team_members (team_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member'),
  ('33333333-3333-3333-3333-333333333333', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member');

-- Legacy team chat: team_a_id only, one member, one message.
insert into public.chat_threads (
  id, thread_type, team_a_id, team_b_id, slot_id, team_id, created_by, created_at
) values (
  '44444444-4444-4444-4444-444444444444',
  'team',
  '11111111-1111-1111-1111-111111111111',
  null,
  null,
  null,
  null,
  '2026-01-01T00:00:00Z'
);

insert into public.chat_members (thread_id, user_id, team_id) values (
  '44444444-4444-4444-4444-444444444444',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.chat_messages (id, thread_id, sender_id, sender_team_id, body) values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'legacy-keep'
);

-- A direct thread that shares team_a_id must not be treated as the team chat.
insert into public.chat_threads (
  id, thread_type, team_a_id, team_b_id, slot_id, team_id, created_at
) values (
  '66666666-6666-6666-6666-666666666666',
  'direct',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  null,
  null,
  '2026-02-01T00:00:00Z'
);

create temp table team_snapshot as
select id, owner_id, name from public.teams;

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on public.teams, public.team_members to authenticated;
grant select, insert on public.chat_threads, public.chat_members, public.chat_messages to authenticated;

alter table public.teams enable row level security;
alter table public.teams force row level security;
drop policy if exists teams_select_all on public.teams;
create policy teams_select_all
on public.teams
for select
to authenticated
using (true);

alter table public.team_members enable row level security;
alter table public.team_members force row level security;
drop policy if exists team_members_select_self on public.team_members;
create policy team_members_select_self
on public.team_members
for select
to authenticated
using (user_id = (select auth.uid()));

alter table public.chat_threads enable row level security;
alter table public.chat_threads force row level security;

alter table public.chat_members enable row level security;
alter table public.chat_members force row level security;
drop policy if exists chat_members_select_self on public.chat_members;
create policy chat_members_select_self
on public.chat_members
for select
to authenticated
using (user_id = (select auth.uid()));

alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

drop policy if exists chat_threads_select_member_or_team on public.chat_threads;
create policy chat_threads_select_member_or_team
on public.chat_threads
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members cm
    where cm.thread_id = chat_threads.id
      and cm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.teams t
    where t.id = chat_threads.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = chat_threads.team_id
      and tm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members cm
    where cm.thread_id = chat_messages.thread_id
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.chat_members cm
    where cm.thread_id = chat_messages.thread_id
      and cm.user_id = (select auth.uid())
  )
);

\ir ../supabase/migrations/20261112045942_fix_team_chat_open.sql

do $$
declare
  legacy_team uuid;
  legacy_body text;
  legacy_created_by uuid;
  direct_team uuid;
  team_threads integer;
  blocking_indexes integer;
  policy_expr text;
begin
  select team_id, created_by
    into legacy_team, legacy_created_by
  from public.chat_threads
  where id = '44444444-4444-4444-4444-444444444444';

  if legacy_team is distinct from '11111111-1111-1111-1111-111111111111' then
    raise exception 'legacy team_id was not backfilled from team_a_id';
  end if;
  if legacy_created_by is not null then
    raise exception 'legacy created_by was rewritten';
  end if;

  select body into legacy_body
  from public.chat_messages
  where id = '55555555-5555-5555-5555-555555555555';
  if legacy_body is distinct from 'legacy-keep' then
    raise exception 'legacy message changed';
  end if;

  select team_id into direct_team
  from public.chat_threads
  where id = '66666666-6666-6666-6666-666666666666';
  if direct_team is not null then
    raise exception 'direct thread team_id was backfilled';
  end if;

  select count(*) into team_threads
  from public.chat_threads
  where thread_type = 'team'
    and (
      team_id = '11111111-1111-1111-1111-111111111111'
      or team_a_id = '11111111-1111-1111-1111-111111111111'
    );
  if team_threads <> 1 then
    raise exception 'expected one legacy team chat, saw %', team_threads;
  end if;

  select count(*) into blocking_indexes
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'chat_members_thread_team_uidx',
      'chat_members_thread_team_unique'
    );
  if blocking_indexes <> 0 then
    raise exception 'per-team chat member unique indexes were not dropped';
  end if;

  if to_regclass('public.chat_threads_team_chat_team_id_uidx') is null
     or to_regclass('public.chat_threads_team_chat_team_a_id_uidx') is null then
    raise exception 'team chat unique indexes were not created';
  end if;

  select pg_get_expr(polwithcheck, polrelid)
    into policy_expr
  from pg_policy
  where polname = 'chat_threads_insert_team_participant';

  if policy_expr is null
     or position('chat_threads.team_id' in policy_expr) = 0
     or position('chat_threads.team_a_id' in policy_expr) = 0
     or position('chat_threads.team_b_id' in policy_expr) = 0
     or position('tm.team_id = tm.team_id' in policy_expr) > 0 then
    raise exception 'insert policy is not qualified: %', policy_expr;
  end if;
end
$$;

-- Owner of the legacy team reopens the same chat and can read its message.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;

do $$
declare
  opened uuid;
  seen text;
  team_threads integer;
begin
  opened := public.get_or_create_team_chat_thread('11111111-1111-1111-1111-111111111111');
  if opened is distinct from '44444444-4444-4444-4444-444444444444' then
    raise exception 'owner opened a different thread %', opened;
  end if;

  select count(*) into team_threads
  from public.chat_threads
  where thread_type = 'team'
    and team_a_id = '11111111-1111-1111-1111-111111111111';
  if team_threads <> 1 then
    raise exception 'owner created a duplicate team chat';
  end if;

  select body into seen
  from public.chat_messages
  where thread_id = opened
    and id = '55555555-5555-5555-5555-555555555555';
  if seen is distinct from 'legacy-keep' then
    raise exception 'owner could not read the legacy message';
  end if;
end
$$;

-- A teammate who is not yet a chat member can see the thread row by team_id
-- but cannot read or send until the function adds them.
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false);

do $$
declare
  visible_threads integer;
  visible_messages integer;
begin
  select count(*) into visible_threads
  from public.chat_threads
  where id = '44444444-4444-4444-4444-444444444444';
  if visible_threads <> 1 then
    raise exception 'teammate could not see the backfilled team chat';
  end if;

  select count(*) into visible_messages
  from public.chat_messages
  where thread_id = '44444444-4444-4444-4444-444444444444';
  if visible_messages <> 0 then
    raise exception 'teammate read messages before joining';
  end if;

  begin
    insert into public.chat_messages (thread_id, sender_id, sender_team_id, body)
    values (
      '44444444-4444-4444-4444-444444444444',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '11111111-1111-1111-1111-111111111111',
      'too-early'
    );
    raise exception 'teammate sent before joining';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

do $$
declare
  opened uuid;
  seen text;
  member_team uuid;
  team_threads integer;
begin
  opened := public.get_or_create_team_chat_thread('11111111-1111-1111-1111-111111111111');
  if opened is distinct from '44444444-4444-4444-4444-444444444444' then
    raise exception 'teammate opened a different thread %', opened;
  end if;

  select team_id into member_team
  from public.chat_members
  where thread_id = opened
    and user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  if member_team is distinct from '11111111-1111-1111-1111-111111111111' then
    raise exception 'teammate was not added with the team id';
  end if;

  select count(*) into team_threads
  from public.chat_threads
  where thread_type = 'team'
    and (
      team_id = '11111111-1111-1111-1111-111111111111'
      or team_a_id = '11111111-1111-1111-1111-111111111111'
    );
  if team_threads <> 1 then
    raise exception 'teammate created a duplicate team chat';
  end if;

  select body into seen
  from public.chat_messages
  where thread_id = opened
  order by created_at asc
  limit 1;
  if seen is distinct from 'legacy-keep' then
    raise exception 'teammate could not read the legacy message';
  end if;

  insert into public.chat_messages (thread_id, sender_id, sender_team_id, body)
  values (
    opened,
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'from-teammate'
  );

  select body into seen
  from public.chat_messages
  where thread_id = opened
    and body = 'from-teammate';
  if seen is distinct from 'from-teammate' then
    raise exception 'teammate could not read the message they sent';
  end if;
end
$$;

-- Someone on another team cannot create, read, or join this chat.
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false);

do $$
declare
  visible_threads integer;
  visible_messages integer;
  joined integer;
  threads_before integer;
  threads_after integer;
begin
  select count(*) into threads_before
  from public.chat_threads
  where thread_type = 'team';

  begin
    perform public.get_or_create_team_chat_thread('11111111-1111-1111-1111-111111111111');
    raise exception 'outsider opened a team chat';
  exception
    when others then
      if sqlerrm not like '%not a member of team%' then
        raise;
      end if;
  end;

  select count(*) into joined
  from public.chat_members
  where thread_id = '44444444-4444-4444-4444-444444444444'
    and user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  if joined <> 0 then
    raise exception 'outsider joined the team chat';
  end if;

  select count(*) into threads_after
  from public.chat_threads
  where thread_type = 'team';
  if threads_after <> threads_before then
    raise exception 'outsider created a team chat';
  end if;

  select count(*) into visible_threads
  from public.chat_threads
  where id = '44444444-4444-4444-4444-444444444444'
     or team_id = '11111111-1111-1111-1111-111111111111'
     or team_a_id = '11111111-1111-1111-1111-111111111111';
  if visible_threads <> 0 then
    raise exception 'outsider read the team chat';
  end if;

  select count(*) into visible_messages
  from public.chat_messages
  where thread_id = '44444444-4444-4444-4444-444444444444';
  if visible_messages <> 0 then
    raise exception 'outsider read team chat messages';
  end if;

  -- Team C has no chat yet, so a unique index cannot hide an RLS failure.
  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'team',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      null,
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );
    raise exception 'outsider inserted a team_a_id chat';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'team',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      '33333333-3333-3333-3333-333333333333',
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );
    raise exception 'outsider inserted a team_id chat';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.chat_messages (thread_id, sender_id, sender_team_id, body)
    values (
      '44444444-4444-4444-4444-444444444444',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      '22222222-2222-2222-2222-222222222222',
      'nope'
    );
    raise exception 'outsider sent a team chat message';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.chat_members (thread_id, user_id, team_id)
    values (
      '44444444-4444-4444-4444-444444444444',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'outsider inserted a chat member row';
  exception
    when insufficient_privilege then
      null;
  end;

  -- A participant can still insert a direct thread for their own team.
  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'direct',
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
      null,
      null,
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );
    raise exception 'rollback direct insert';
  exception
    when others then
      if sqlerrm <> 'rollback direct insert' then
        raise;
      end if;
  end;
end
$$;

-- A real member can insert their own team's chat. Roll it back so the
-- function below is what creates the single kept row.
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false);

do $$
begin
  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'team',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      '33333333-3333-3333-3333-333333333333',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    );
    raise exception 'rollback member insert';
  exception
    when others then
      if sqlerrm <> 'rollback member insert' then
        raise;
      end if;
  end;
end
$$;

-- Owner who is not in team_members, then a second member, sharing one new chat.
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false);

do $$
declare
  opened uuid;
  again uuid;
  member_team uuid;
begin
  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'team',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      '33333333-3333-3333-3333-333333333333',
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    );
    raise exception 'rollback owner insert';
  exception
    when others then
      if sqlerrm <> 'rollback owner insert' then
        raise;
      end if;
  end;

  opened := public.get_or_create_team_chat_thread('33333333-3333-3333-3333-333333333333');
  again := public.get_or_create_team_chat_thread('33333333-3333-3333-3333-333333333333');
  if opened is null or opened is distinct from again then
    raise exception 'owner did not reuse the new team chat';
  end if;

  if (
    select count(*)
    from public.chat_threads
    where thread_type = 'team'
      and team_id = '33333333-3333-3333-3333-333333333333'
      and team_a_id = '33333333-3333-3333-3333-333333333333'
      and team_b_id is null
  ) <> 1 then
    raise exception 'new team chat was not stored on team_id and team_a_id';
  end if;

  select team_id into member_team
  from public.chat_members
  where thread_id = opened
    and user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  if member_team is distinct from '33333333-3333-3333-3333-333333333333' then
    raise exception 'owner was not added as a chat member';
  end if;

  insert into public.chat_messages (thread_id, sender_id, sender_team_id, body)
  values (
    opened,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '33333333-3333-3333-3333-333333333333',
    'from-owner'
  );
end
$$;

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false);

do $$
declare
  opened uuid;
  seen text;
  member_team uuid;
begin
  opened := public.get_or_create_team_chat_thread('33333333-3333-3333-3333-333333333333');
  select team_id into member_team
  from public.chat_members
  where thread_id = opened
    and user_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  if member_team is distinct from '33333333-3333-3333-3333-333333333333' then
    raise exception 'second member was not added with the team id';
  end if;

  select body into seen
  from public.chat_messages
  where thread_id = opened
    and body = 'from-owner';
  if seen is distinct from 'from-owner' then
    raise exception 'second member could not read the owner message';
  end if;

  insert into public.chat_messages (thread_id, sender_id, sender_team_id, body)
  values (
    opened,
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '33333333-3333-3333-3333-333333333333',
    'from-second'
  );
end
$$;

-- A logged-in user with no team cannot open or create one.
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);

do $$
begin
  begin
    perform public.get_or_create_team_chat_thread('33333333-3333-3333-3333-333333333333');
    raise exception 'stranger opened a team chat';
  exception
    when others then
      if sqlerrm not like '%not a member of team%' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.chat_members
    where user_id = '99999999-9999-9999-9999-999999999999'
  ) then
    raise exception 'stranger joined a chat';
  end if;

  begin
    insert into public.chat_threads (
      thread_type, team_a_id, team_b_id, slot_id, team_id, created_by
    ) values (
      'team',
      '22222222-2222-2222-2222-222222222222',
      null,
      null,
      '22222222-2222-2222-2222-222222222222',
      '99999999-9999-9999-9999-999999999999'
    );
    raise exception 'stranger inserted a team chat';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

do $$
declare
  legacy_body text;
  message_count integer;
begin
  select body into legacy_body
  from public.chat_messages
  where id = '55555555-5555-5555-5555-555555555555';
  if legacy_body is distinct from 'legacy-keep' then
    raise exception 'legacy message was rewritten';
  end if;

  select count(*) into message_count
  from public.chat_messages
  where thread_id = '44444444-4444-4444-4444-444444444444';
  if message_count <> 2 then
    raise exception 'legacy thread message count changed to %', message_count;
  end if;

  if exists (
    select 1
    from public.teams t
    full join team_snapshot s using (id)
    where t.id is null
       or s.id is null
       or t.owner_id is distinct from s.owner_id
       or t.name is distinct from s.name
  ) then
    raise exception 'team data changed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '', false);
set role anon;

do $$
begin
  begin
    perform public.get_or_create_team_chat_thread('11111111-1111-1111-1111-111111111111');
    raise exception 'anon executed get_or_create_team_chat_thread';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;
