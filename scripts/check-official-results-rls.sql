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
  ('44444444-4444-4444-4444-444444444444');

insert into public.teams (id, owner_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '青葉FC'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', '別クラブ');

insert into public.team_members (team_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'coach');

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on public.teams, public.team_members, public.admins to authenticated;

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
  report_id, team_id, competition_name, opponent_name, team_goals, opponent_goals, result_label
)
select id, team_id, '市長杯', '緑ヶ丘SC', 2, 1, 'win'
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

do $$
declare
  definers integer;
  policy_year text;
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

  select year_status into policy_year from public.official_result_policy where id = 1;
  if policy_year <> 'unset' then
    raise exception 'policy year was %', policy_year;
  end if;
end $$;
