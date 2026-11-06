-- Isolated check for supabase/migrations/20261105214326_annual_official_results.sql.
-- Run only on an empty database. Do not point this at production.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists auth.users (
  id uuid primary key
);

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

create table if not exists public.admins (
  user_id uuid primary key
);

\ir ../supabase/migrations/20261105214326_annual_official_results.sql

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555');

insert into public.teams (id, owner_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '青葉FC'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', '別クラブ');

insert into public.team_members (team_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'coach'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'owner');

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on public.teams, public.team_members, public.admins to authenticated;

-- Production shape: teams are readable; a member sees their own membership row,
-- and a team owner sees that team's membership rows. That own-row visibility is
-- what makes an uncorrelated "tm.team_id = team_id" check succeed.
alter table public.teams enable row level security;
alter table public.teams force row level security;
create policy teams_select_all
on public.teams
for select
to authenticated
using (true);

alter table public.team_members enable row level security;
alter table public.team_members force row level security;
create policy team_members_select_self
on public.team_members
for select
to authenticated
using (user_id = (select auth.uid()));
create policy team_members_select_team_owner
on public.team_members
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_members.team_id
      and t.owner_id = (select auth.uid())
  )
);

-- Negative control. The old predicate must still ALLOW a coach of team A to
-- write a row for team B. If this insert is denied, the later denials could be
-- a false pass caused by team_members RLS hiding the coach's own row.
create table public.rls_name_probe (
  team_id uuid not null
);
alter table public.rls_name_probe enable row level security;
alter table public.rls_name_probe force row level security;
grant insert on public.rls_name_probe to authenticated;
create policy rls_name_probe_insert_vulnerable
on public.rls_name_probe
for insert
to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;

do $$
declare
  own_rows integer;
  vulnerable_seen boolean;
  other_team_seen boolean;
begin
  select count(*) into own_rows from public.team_members;
  if own_rows <> 1 then
    raise exception 'coach should see only their own membership row, saw %', own_rows;
  end if;

  select
    exists (
      select 1 from public.team_members tm
      where tm.team_id = tm.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    ),
    exists (
      select 1 from public.team_members tm
      where tm.team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  into vulnerable_seen, other_team_seen;
  if vulnerable_seen is not true or other_team_seen is not false then
    raise exception 'name-resolution fixture was % / %', vulnerable_seen, other_team_seen;
  end if;

  insert into public.rls_name_probe (team_id)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
end $$;

reset role;

do $$
declare
  probed integer;
begin
  select count(*) into probed from public.rls_name_probe
  where team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if probed <> 1 then
    raise exception 'negative control did not reproduce the unqualified team_id bug, rows %', probed;
  end if;
end $$;

drop policy rls_name_probe_insert_vulnerable on public.rls_name_probe;
create policy rls_name_probe_insert_correlated
on public.rls_name_probe
for insert
to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = rls_name_probe.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;

do $$
begin
  begin
    insert into public.rls_name_probe (team_id)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    raise exception 'qualified predicate allowed a cross-team insert';
  exception
    when insufficient_privilege then
      null;
  end;
  insert into public.rls_name_probe (team_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
end $$;

reset role;
drop table public.rls_name_probe;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

do $$
begin
  begin
    insert into public.official_result_reports (team_id, reporting_year, created_by)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      2026,
      '22222222-2222-2222-2222-222222222222'
    );
    raise exception 'member insert should have failed';
  exception
    when insufficient_privilege then
      null;
    when others then
      if SQLERRM = 'member insert should have failed' then
        raise;
      end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

insert into public.official_result_reports (team_id, reporting_year, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  2026,
  '11111111-1111-1111-1111-111111111111'
);

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.official_result_reports;
  if seen <> 1 then
    raise exception 'manager should see own report, saw %', seen;
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.official_result_reports;
  if seen <> 0 then
    raise exception 'other team saw % reports', seen;
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.official_result_reports;
  if seen <> 1 then
    raise exception 'coach should see the report, saw %', seen;
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

update public.official_result_reports
   set state = 'submitted',
       outcome = 'no_official_results',
       version = 2,
       submitted_by = '33333333-3333-3333-3333-333333333333',
       submitted_at = '2000-01-01T00:00:00Z'
 where team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
declare
  confirmer uuid;
begin
  select submitted_by into confirmer
  from public.official_result_reports
  where team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if confirmer <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'confirmer was overwritten to %', confirmer;
  end if;

  update public.official_result_reports
     set outcome = 'has_results',
         version = 3
   where team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if found then
    raise exception 'submitted report was editable';
  end if;
end $$;

insert into public.official_result_reports (team_id, reporting_year, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  2025,
  '11111111-1111-1111-1111-111111111111'
);

insert into public.official_result_lines (
  report_id, team_id, competition_name, opponent_name, played_on, team_goals, opponent_goals, result_label
)
select id, team_id, '市長杯', '緑ヶ丘SC', '2026-03-31', 2, 1, 'win'
from public.official_result_reports
where reporting_year = 2025;

do $$
declare
  report_version integer;
  report_state text;
  revision_count integer;
begin
  select version, state into report_version, report_state
  from public.official_result_reports
  where reporting_year = 2025;
  if report_state <> 'draft' or report_version <> 2 then
    raise exception 'line insert changed report to % version %', report_state, report_version;
  end if;

  begin
    update public.official_result_lines
       set played_on = '2026-04-01'
     where competition_name = '市長杯';
    raise exception 'outside fiscal year accepted';
  exception
    when others then
      if SQLERRM = 'outside fiscal year accepted' then
        raise;
      end if;
  end;

  begin
    update public.official_result_reports
       set state = 'submitted',
           outcome = 'no_official_results',
           version = version + 1
     where reporting_year = 2025;
    raise exception 'no-results submit ignored an included line';
  exception
    when others then
      if SQLERRM = 'no-results submit ignored an included line' then
        raise;
      end if;
  end;

  update public.official_result_lines
     set opponent_name = '緑丘SC'
   where competition_name = '市長杯';
  select count(*) into revision_count from public.official_result_line_revisions;
  if revision_count <> 1 then
    raise exception 'revision count %', revision_count;
  end if;

  begin
    update public.official_result_candidates set excerpt = 'changed' where true;
    raise exception 'candidate update should be denied';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

-- Team B owner can file for team B. Coach, membership-owner, and owner_id of
-- team A cannot write team B's report, revision, or fetch attempt.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;

insert into public.official_result_reports (team_id, reporting_year, created_by)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  2026,
  '33333333-3333-3333-3333-333333333333'
);

reset role;
create table public.rls_fixture (
  name text primary key,
  id uuid not null
);
grant select on public.rls_fixture to authenticated;
insert into public.rls_fixture (name, id)
select 'team_b_report', id
from public.official_result_reports
where team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  and reporting_year = 2026;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;

insert into public.official_result_reports (team_id, reporting_year, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  2024,
  '44444444-4444-4444-4444-444444444444'
);

insert into public.official_result_fetch_attempts (team_id, user_id)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444'
);

do $$
declare
  own_report uuid;
  seen_other integer;
begin
  select id into own_report
  from public.official_result_reports
  where team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and reporting_year = 2024;
  if own_report is null then
    raise exception 'coach could not read their own report';
  end if;

  insert into public.official_result_line_revisions (
    line_id, report_id, team_id, editor_id, before_values, after_values
  ) values (
    gen_random_uuid(),
    own_report,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '44444444-4444-4444-4444-444444444444',
    '{"opponent_name":"before"}'::jsonb,
    '{"opponent_name":"after"}'::jsonb
  );

  select count(*) into seen_other
  from public.official_result_reports
  where team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if seen_other <> 0 then
    raise exception 'coach saw % reports for the other team', seen_other;
  end if;

  begin
    insert into public.official_result_reports (team_id, reporting_year, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      2025,
      '44444444-4444-4444-4444-444444444444'
    );
    raise exception 'coach inserted a report for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_line_revisions (
      line_id, report_id, team_id, editor_id, before_values, after_values
    ) values (
      gen_random_uuid(),
      (select id from public.rls_fixture where name = 'team_b_report'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '44444444-4444-4444-4444-444444444444',
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'coach inserted a revision for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_fetch_attempts (team_id, user_id)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '44444444-4444-4444-4444-444444444444'
    );
    raise exception 'coach inserted a fetch attempt for another team';
  exception
    when insufficient_privilege then
      null;
  end;

end $$;

reset role;
insert into public.rls_fixture (name, id)
select 'coach_report', id
from public.official_result_reports
where team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and reporting_year = 2024;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;

insert into public.official_result_sources (
  report_id, team_id, source_url, retrieval_method, discovery_extent, match_confidence, created_by
) values (
  (select id from public.rls_fixture where name = 'coach_report'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'https://example.com/a',
  'manual_url',
  'page_fetched',
  'no_explicit_results',
  '44444444-4444-4444-4444-444444444444'
);

do $$
declare
  own_source uuid;
begin
  select id into own_source
  from public.official_result_sources
  where report_id = (select id from public.rls_fixture where name = 'coach_report');
  if own_source is null then
    raise exception 'coach could not read their own source';
  end if;

  insert into public.official_result_candidates (
    source_id, report_id, team_id, excerpt, match_basis, fingerprint
  ) values (
    own_source,
    (select id from public.rls_fixture where name = 'coach_report'),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '青葉FC 1-0',
    'same team',
    'same-team'
  );

  begin
    insert into public.official_result_sources (
      report_id, team_id, source_url, retrieval_method, discovery_extent, match_confidence, created_by
    ) values (
      (select id from public.rls_fixture where name = 'team_b_report'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'https://example.com/b',
      'manual_url',
      'page_fetched',
      'not_evaluated',
      '44444444-4444-4444-4444-444444444444'
    );
    raise exception 'coach inserted a source for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_candidates (
      source_id, report_id, team_id, excerpt, match_basis, fingerprint
    ) values (
      own_source,
      (select id from public.rls_fixture where name = 'coach_report'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '別クラブ 1-0',
      'other team',
      'other-team'
    );
    raise exception 'coach inserted a candidate for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_lines (
      report_id, team_id, competition_name, opponent_name, team_goals, opponent_goals, result_label
    ) values (
      (select id from public.rls_fixture where name = 'team_b_report'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '市長杯',
      '青葉FC',
      1,
      0,
      'win'
    );
    raise exception 'coach inserted a line for another team';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
set role authenticated;

insert into public.official_result_reports (team_id, reporting_year, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  2023,
  '55555555-5555-5555-5555-555555555555'
);

insert into public.official_result_fetch_attempts (team_id, user_id)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '55555555-5555-5555-5555-555555555555'
);

do $$
declare
  own_report uuid;
begin
  select id into own_report
  from public.official_result_reports
  where reporting_year = 2023;
  if own_report is null then
    raise exception 'membership owner could not read their own report';
  end if;

  insert into public.official_result_line_revisions (
    line_id, report_id, team_id, editor_id, before_values, after_values
  ) values (
    gen_random_uuid(),
    own_report,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    '{}'::jsonb,
    '{}'::jsonb
  );

  begin
    insert into public.official_result_reports (team_id, reporting_year, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      2024,
      '55555555-5555-5555-5555-555555555555'
    );
    raise exception 'membership owner inserted a report for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_line_revisions (
      line_id, report_id, team_id, editor_id, before_values, after_values
    ) values (
      gen_random_uuid(),
      (select id from public.rls_fixture where name = 'team_b_report'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '55555555-5555-5555-5555-555555555555',
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'membership owner inserted a revision for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_fetch_attempts (team_id, user_id)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '55555555-5555-5555-5555-555555555555'
    );
    raise exception 'membership owner inserted a fetch attempt for another team';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

do $$
begin
  begin
    insert into public.official_result_reports (team_id, reporting_year, created_by)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      2022,
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'owner_id inserted a report for another team';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_fetch_attempts (team_id, user_id)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'owner_id inserted a fetch attempt for another team';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

do $$
declare
  definers integer;
  policy_year text;
  unqualified text;
begin
  select count(*) into definers
  from pg_proc
  join pg_namespace n on n.oid = pg_proc.pronamespace
  where n.nspname = 'public'
    and pg_proc.proname like 'official_result%'
    and pg_proc.prosecdef;
  if definers <> 0 then
    raise exception 'security definer helper count %', definers;
  end if;

  select period_kind || ':' || deadline_month::text || '-' || deadline_day::text
         || ':' || deadline_time_zone || ':' || enforcement || ':' || late_submission
    into policy_year
  from public.official_result_policy
  where id = 1;
  if policy_year <> 'jp_fiscal:5-31:Asia/Tokyo:status_only:allowed' then
    raise exception 'policy was %', policy_year;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'official_result_policy'
      and column_name = 'year_status'
  ) then
    raise exception 'unset year_status column is still present';
  end if;

  select string_agg(c.relname || '.' || p.polname, ', ')
    into unqualified
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'official_result%'
    and (
      coalesce(pg_get_expr(p.polqual, p.polrelid), '')
      || ' '
      || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
    ) ~ '(^|[^._[:alnum:]])(team_id|report_id|source_id)([^_[:alnum:]]|$)';
  if unqualified is not null then
    raise exception 'unqualified outer column in %', unqualified;
  end if;
end $$;
