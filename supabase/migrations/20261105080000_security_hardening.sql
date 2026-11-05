-- サカまっち 安全なセキュリティ強化
-- 本番にはまだ適用しない。先にこのファイルだけをレビューし、適用順は PR 説明を参照。
-- 破壊的な DROP は 20261105080100_risky_drop_unused_tables.sql に分離している。
--
-- 意図的にやっていないこと:
--   * pg_net / pg_trgm のスキーマ移動（cron の net.http_post と trigram index が壊れる）
--   * 未使用 index の削除、auth.uid() initplan の一括書き換え（性能項目。挙動確認が別途必要）
--   * leaked password protection（Auth ダッシュボードの設定）
--   * RLS が有効でポリシーの無い内部テーブルを公開すること
--     （Edge Function は service_role で利用。API ロールには明示的に拒否する）

-- ---------------------------------------------------------------------------
-- 1. search_path を固定する
-- ---------------------------------------------------------------------------

alter function public.set_owner_id_if_null() set search_path = public;
alter function public.get_or_create_direct_thread(uuid, uuid) set search_path = public;
alter function public.notify_chat_message() set search_path = public;
alter function public.rpc_mark_thread_read(uuid) set search_path = public;
alter function public.import_municipality_kana(jsonb) set search_path = public;
alter function public.import_town_kana(jsonb) set search_path = public;
alter function public.set_profiles_updated_at() set search_path = public;
alter function public.set_chat_messages_updated_at() set search_path = public;
alter function public.is_team_member(uuid) set search_path = public;
alter function public.is_team_manager(uuid) set search_path = public;
alter function public.rpc_get_or_create_team_thread(uuid) set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.run_selection_crawler_all() set search_path = public;
alter function public.normalize_selection_url(text) set search_path = public;
alter function public.refresh_selection_event_status() set search_path = public;

-- is_admin(任意の uuid) は管理者一覧の照会に使えてしまう。
-- ポリシーは is_admin(auth.uid()) だけを呼ぶので、自分以外は常に false にする。
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(uid = (select auth.uid()), false)
    and exists (
      select 1
      from public.admins a
      where a.user_id = uid
    );
$$;

-- 予定の承認は SECURITY DEFINER で RLS を迂回する。
-- 呼び出し元が相手チーム（または相手のいない下書きの作成者）であることを必須にする。
-- 引数 p_approved_by_user_id は署名互換のため残すが、記録には auth.uid() を使う。
create or replace function public.approve_schedule_proposal(
  p_proposal_id uuid,
  p_approved_by_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.schedule_proposals%rowtype;
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_approved_by_user_id is not null and p_approved_by_user_id is distinct from v_uid then
    raise exception 'approved_by_user_id must match the signed-in user';
  end if;

  select *
    into v_proposal
  from public.schedule_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'schedule_proposal not found';
  end if;

  if v_proposal.status not in ('draft', 'pending_approval') then
    raise exception 'proposal is not approvable';
  end if;

  v_allowed := (
    (
      v_proposal.approval_requested_to_team_id is not null
      and (
        exists (
          select 1 from public.teams t
          where t.id = v_proposal.approval_requested_to_team_id
            and t.owner_id = v_uid
        )
        or exists (
          select 1 from public.team_members tm
          where tm.team_id = v_proposal.approval_requested_to_team_id
            and tm.user_id = v_uid
        )
      )
    )
    or (
      v_proposal.opponent_team_id is not null
      and (
        exists (
          select 1 from public.teams t
          where t.id = v_proposal.opponent_team_id
            and t.owner_id = v_uid
        )
        or exists (
          select 1 from public.team_members tm
          where tm.team_id = v_proposal.opponent_team_id
            and tm.user_id = v_uid
        )
      )
    )
    or (
      v_proposal.approval_requested_to_team_id is null
      and v_proposal.opponent_team_id is null
      and (
        v_proposal.created_by_user_id = v_uid
        or exists (
          select 1 from public.teams t
          where t.id = v_proposal.created_by_team_id
            and t.owner_id = v_uid
        )
        or exists (
          select 1 from public.team_members tm
          where tm.team_id = v_proposal.created_by_team_id
            and tm.user_id = v_uid
        )
      )
    )
  );

  if not v_allowed then
    raise exception 'not allowed to approve this proposal';
  end if;

  update public.schedule_proposals
     set status = 'approved',
         approved_by_user_id = v_uid,
         confirmed_at = now(),
         updated_at = now()
   where id = p_proposal_id;

  insert into public.team_schedules (
    team_id,
    category,
    opponent,
    strength,
    date,
    start_time,
    end_time,
    meetup_time,
    dissolve_time,
    venue_name,
    address,
    parking,
    belongings,
    note,
    thread_id,
    status,
    proposal_id,
    opponent_team_id,
    external_opponent_name,
    created_by_user_id,
    source,
    created_at,
    updated_at
  )
  values (
    v_proposal.created_by_team_id,
    coalesce(v_proposal.category, ''),
    coalesce(
      (select name from public.teams where id = v_proposal.opponent_team_id),
      v_proposal.external_opponent_name,
      ''
    ),
    v_proposal.strength,
    v_proposal.date::text,
    v_proposal.start_time::text,
    v_proposal.end_time::text,
    v_proposal.meetup_time::text,
    v_proposal.dissolve_time::text,
    v_proposal.venue_name,
    v_proposal.address,
    v_proposal.parking,
    v_proposal.belongings,
    v_proposal.note,
    v_proposal.thread_id,
    'confirmed',
    v_proposal.id,
    v_proposal.opponent_team_id,
    v_proposal.external_opponent_name,
    v_proposal.created_by_user_id,
    'proposal',
    now(),
    now()
  );

  if v_proposal.opponent_team_id is not null then
    insert into public.team_schedules (
      team_id,
      category,
      opponent,
      strength,
      date,
      start_time,
      end_time,
      meetup_time,
      dissolve_time,
      venue_name,
      address,
      parking,
      belongings,
      note,
      thread_id,
      status,
      proposal_id,
      opponent_team_id,
      external_opponent_name,
      created_by_user_id,
      source,
      created_at,
      updated_at
    )
    values (
      v_proposal.opponent_team_id,
      coalesce(v_proposal.category, ''),
      coalesce(
        (select name from public.teams where id = v_proposal.created_by_team_id),
        ''
      ),
      v_proposal.strength,
      v_proposal.date::text,
      v_proposal.start_time::text,
      v_proposal.end_time::text,
      v_proposal.meetup_time::text,
      v_proposal.dissolve_time::text,
      v_proposal.venue_name,
      v_proposal.address,
      v_proposal.parking,
      v_proposal.belongings,
      v_proposal.note,
      v_proposal.thread_id,
      'confirmed',
      v_proposal.id,
      v_proposal.created_by_team_id,
      null,
      v_uid,
      'proposal',
      now(),
      now()
    );
  end if;
end;
$$;

-- DM 作成はログイン済みで、my_team_id のオーナーまたはメンバーだけ。
-- chat_members.user_id は NOT NULL なので、両オーナーと呼び出し元を入れる。
create or replace function public.rpc_get_or_create_dm_thread(
  my_team_id uuid,
  other_team_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sorted_team_a uuid;
  sorted_team_b uuid;
  v_thread_key text;
  v_thread_id uuid;
  v_exists_a boolean;
  v_exists_b boolean;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if my_team_id is null or other_team_id is null then
    raise exception 'my_team_id and other_team_id are required';
  end if;

  if my_team_id = other_team_id then
    raise exception 'cannot create direct thread with same team';
  end if;

  if not exists (
    select 1
    from public.teams t
    where t.id = my_team_id
      and t.owner_id = v_uid
  ) and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = my_team_id
      and tm.user_id = v_uid
  ) then
    raise exception 'not a member of my_team_id';
  end if;

  select exists(
    select 1 from public.teams where id = my_team_id
  ) into v_exists_a;

  if not v_exists_a then
    raise exception 'my_team_id does not exist in teams: %', my_team_id;
  end if;

  select exists(
    select 1 from public.teams where id = other_team_id
  ) into v_exists_b;

  if not v_exists_b then
    raise exception 'other_team_id does not exist in teams: %', other_team_id;
  end if;

  if my_team_id::text < other_team_id::text then
    sorted_team_a := my_team_id;
    sorted_team_b := other_team_id;
  else
    sorted_team_a := other_team_id;
    sorted_team_b := my_team_id;
  end if;

  v_thread_key := 'direct:' || sorted_team_a::text || ':' || sorted_team_b::text;

  select id
    into v_thread_id
  from public.chat_threads
  where thread_type = 'direct'
    and thread_key = v_thread_key
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads (
      thread_type,
      team_a_id,
      team_b_id,
      slot_id,
      created_by,
      thread_key
    )
    values (
      'direct',
      sorted_team_a,
      sorted_team_b,
      null,
      v_uid,
      v_thread_key
    )
    returning id into v_thread_id;
  end if;

  insert into public.chat_members (thread_id, team_id, user_id)
  values (v_thread_id, my_team_id, v_uid)
  on conflict do nothing;

  insert into public.chat_members (thread_id, team_id, user_id)
  select distinct on (t.owner_id)
    v_thread_id,
    t.id,
    t.owner_id
  from public.teams t
  where t.id in (sorted_team_a, sorted_team_b)
    and t.owner_id is not null
  order by t.owner_id, t.id
  on conflict do nothing;

  return v_thread_id;
end;
$$;

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

  if not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.owner_id = v_me
  ) and not exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = v_me
  ) then
    raise exception 'not a member of team';
  end if;

  select id
    into v_thread_id
  from public.chat_threads
  where thread_type = 'team'
    and team_id = p_team_id
    and slot_id is null
    and team_a_id is null
    and team_b_id is null
  limit 1;

  if v_thread_id is null then
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
      null,
      null,
      v_me
    )
    returning id into v_thread_id;
  end if;

  insert into public.chat_members (
    thread_id,
    user_id,
    team_id
  )
  values (
    v_thread_id,
    v_me,
    p_team_id
  )
  on conflict do nothing;

  update public.chat_members
     set team_id = p_team_id
   where thread_id = v_thread_id
     and user_id = v_me;

  return v_thread_id;
end;
$$;

create or replace function public.get_or_create_team_thread(team_a uuid, team_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
  k text;
  tid uuid;
  ua uuid;
begin
  ua := auth.uid();
  if ua is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.teams t
    where t.id = team_a and t.owner_id = ua
  ) and not exists (
    select 1 from public.team_members tm
    where tm.team_id = team_a and tm.user_id = ua
  ) then
    raise exception 'not a member of team_a';
  end if;

  if team_a < team_b then
    a := team_a; b := team_b;
  else
    a := team_b; b := team_a;
  end if;

  k := 'team:' || a::text || ':' || b::text;

  select id into tid
  from public.chat_threads
  where thread_key = k
  limit 1;

  if tid is null then
    insert into public.chat_threads(thread_key)
    values (k)
    returning id into tid;
  end if;

  insert into public.chat_members(thread_id, team_id, user_id)
  values (tid, team_a, ua)
  on conflict do nothing;

  return tid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. API から実行できてはいけない関数の EXECUTE を外す
--    トリガー関数は anon だけ外し、ログインユーザーの EXECUTE は残す。
-- ---------------------------------------------------------------------------

revoke all on function public.approve_schedule_proposal(uuid, uuid) from public, anon;
revoke all on function public.delete_team_safe(uuid) from public, anon;
revoke all on function public.get_or_create_direct_thread(uuid, uuid) from public, anon;
revoke all on function public.get_or_create_team_chat_thread(uuid) from public, anon;
revoke all on function public.get_or_create_team_thread(uuid, uuid) from public, anon;
revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.is_chat_member(uuid) from public, anon;
revoke all on function public.is_team_manager(uuid) from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;
revoke all on function public.normalize_selection_url(text) from public, anon;
revoke all on function public.rpc_get_or_create_dm_thread(uuid, uuid) from public, anon;
revoke all on function public.rpc_mark_thread_read(uuid) from public, anon;

-- トリガー関数は authenticated の EXECUTE を残す。
-- 行を書いたユーザー側に EXECUTE が要る環境でも、チャット送信や updated_at 更新が止まらないようにする。
revoke all on function public.notify_chat_message() from public, anon;
revoke all on function public.set_chat_messages_updated_at() from public, anon;
revoke all on function public.set_owner_id_if_null() from public, anon;
revoke all on function public.set_profiles_updated_at() from public, anon;
revoke all on function public.touch_updated_at() from public, anon;
revoke all on function public.update_updated_at_column() from public, anon;

revoke all on function public.import_municipality_kana(jsonb) from public, anon, authenticated;
revoke all on function public.import_town_kana(jsonb) from public, anon, authenticated;
revoke all on function public.refresh_selection_event_status() from public, anon, authenticated;
revoke all on function public.run_selection_crawler_all() from public, anon, authenticated;
revoke all on function public.rpc_get_or_create_team_thread(uuid) from public, anon, authenticated;

grant execute on function public.import_municipality_kana(jsonb) to service_role;
grant execute on function public.import_town_kana(jsonb) to service_role;
grant execute on function public.notify_chat_message() to service_role;
grant execute on function public.refresh_selection_event_status() to service_role;
grant execute on function public.run_selection_crawler_all() to service_role;
grant execute on function public.rpc_get_or_create_team_thread(uuid) to service_role;
grant execute on function public.set_chat_messages_updated_at() to service_role;
grant execute on function public.set_owner_id_if_null() to service_role;
grant execute on function public.set_profiles_updated_at() to service_role;
grant execute on function public.touch_updated_at() to service_role;
grant execute on function public.update_updated_at_column() to service_role;

-- RLS は TRUNCATE を止めない。API ロールから TRUNCATE を外す。
revoke truncate on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. security invoker ビュー
--    selection_events には published の SELECT ポリシーが既にある。
--    public_selection_page_candidates の元テーブルは API 非公開なので、
--    invoker にすると anon/authenticated からは空になる。
-- ---------------------------------------------------------------------------

alter view public.selection_events_public set (security_invoker = true);
alter view public.public_selection_page_candidates set (security_invoker = true);

revoke all on table public.public_selection_page_candidates from public, anon, authenticated;
grant select on table public.public_selection_page_candidates to service_role;

-- ---------------------------------------------------------------------------
-- 4. 広すぎるポリシーを、実際の操作に合わせる
-- ---------------------------------------------------------------------------

drop policy if exists schedule_proposals_insert_authenticated on public.schedule_proposals;
drop policy if exists schedule_proposals_select_authenticated on public.schedule_proposals;

create policy schedule_proposals_insert_own
on public.schedule_proposals
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (
    created_by_team_id is null
    or exists (
      select 1 from public.teams t
      where t.id = created_by_team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = created_by_team_id
        and tm.user_id = (select auth.uid())
    )
  )
);

create policy schedule_proposals_select_participants
on public.schedule_proposals
for select
to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.teams t
    where t.owner_id = (select auth.uid())
      and t.id in (created_by_team_id, opponent_team_id, approval_requested_to_team_id)
  )
  or exists (
    select 1 from public.team_members tm
    where tm.user_id = (select auth.uid())
      and tm.team_id in (created_by_team_id, opponent_team_id, approval_requested_to_team_id)
  )
  or (
    thread_id is not null
    and public.is_chat_member(thread_id)
  )
);

drop policy if exists "authenticated users can create chat threads" on public.chat_threads;
drop policy if exists chat_threads_insert_authenticated on public.chat_threads;
drop policy if exists chat_threads_insert_dm_authenticated on public.chat_threads;

create policy chat_threads_insert_team_participant
on public.chat_threads
for insert
to authenticated
with check (
  exists (
    select 1 from public.teams t
    where t.owner_id = (select auth.uid())
      and t.id in (team_a_id, team_b_id, team_id)
  )
  or exists (
    select 1 from public.team_members tm
    where tm.user_id = (select auth.uid())
      and tm.team_id in (team_a_id, team_b_id, team_id)
  )
);

-- thread_type = dm なら他人の user_id でも挿入できてしまうポリシーを外す。
-- 自分の参加は user_id = auth.uid() の既存ポリシーで残る。
drop policy if exists chat_members_insert_for_dm_thread on public.chat_members;

-- (thread_id, user_id) の一意制約が二重にある。同じ定義の方を1つ外す。
alter table public.chat_members
  drop constraint if exists chat_members_thread_user_unique;

-- ---------------------------------------------------------------------------
-- 5. クローラ用テーブルは API から触れないことを明示する
--    service_role は RLS を迂回するので Edge Function はそのまま動く。
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'data_quality_flags',
    'league_sources',
    'match_team_notes',
    'selection_event_blacklist',
    'selection_events_backup_20260630',
    'selection_notification_logs',
    'selection_page_candidates',
    'selection_search_jobs',
    'selection_update_candidates',
    'team_directory',
    'team_directory_seeds',
    'team_homepages',
    'team_league_history',
    'team_master',
    'team_master_import',
    'team_notifications',
    'team_rank_aliases',
    'team_seed_jobs',
    'team_selection_import',
    'team_selection_research'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_no_api_access',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_no_api_access',
      table_name
    );
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      table_name
    );
  end loop;
end $$;

drop policy if exists selection_sources_public_read on public.selection_sources;
drop policy if exists selection_sources_no_api_access on public.selection_sources;
create policy selection_sources_no_api_access
on public.selection_sources
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.selection_sources from anon, authenticated;
