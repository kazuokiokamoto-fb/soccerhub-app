-- Affiliation and standing RLS on an empty database.
-- Does not connect to production. Applies both additive migrations, then
-- checks cross-team denial, member denial, candidate insert denial, and a
-- standing submit that does not need per-match lines. Run:
--   psql "postgresql://postgres:postgres@127.0.0.1:5432/standing_rls" -v ON_ERROR_STOP=1 -f scripts/check-standing-rls.sql

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
\ir ../supabase/migrations/20261111193000_team_affiliation_standings.sql

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd');

insert into public.teams (id, owner_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '青葉FC'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '別クラブ');

insert into public.team_members (team_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'coach'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on public.teams, public.team_members, public.admins to authenticated;

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

-- Coach of team A can save that team's affiliation.
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false);
set role authenticated;

insert into public.team_affiliations (team_id, status, prefecture, category, organization_name, updated_by)
values (
  '11111111-1111-1111-1111-111111111111',
  'affiliated',
  '東京都',
  'U-12',
  '東京少年サッカー連盟',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

do $$
begin
  begin
    insert into public.team_affiliations (team_id, status, prefecture, category, organization_name, updated_by)
    values (
      '22222222-2222-2222-2222-222222222222',
      'affiliated',
      '神奈川県',
      'U-12',
      '他チーム',
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );
    raise exception 'cross-team affiliation insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;

  update public.team_affiliations
     set organization_name = '書き換え',
         updated_by = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
   where team_id = '22222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'cross-team affiliation update was allowed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false);

do $$
begin
  begin
    insert into public.team_affiliations (team_id, status, updated_by)
    values (
      '11111111-1111-1111-1111-111111111111',
      'none',
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );
    raise exception 'member affiliation insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false);

do $$
begin
  begin
    insert into public.official_standing_candidates (
      team_id, fiscal_year, category, rank, source_url, fetched_at, evidence, confidence
    ) values (
      '11111111-1111-1111-1111-111111111111',
      2025,
      'U-12',
      1,
      'https://example.com/standings',
      now(),
      'evidence',
      'high'
    );
    raise exception 'coach candidate insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.official_result_reports (
      team_id, reporting_year, state, outcome, version, created_by
    ) values (
      '22222222-2222-2222-2222-222222222222',
      2025,
      'draft',
      'unspecified',
      1,
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );
    raise exception 'cross-team report insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

insert into public.official_result_reports (
  team_id, reporting_year, state, outcome, version, created_by
) values (
  '11111111-1111-1111-1111-111111111111',
  2025,
  'draft',
  'unspecified',
  1,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

update public.official_result_reports
   set state = 'submitted',
       submission_kind = 'standing',
       standing_category = 'U-12',
       standing_rank = 3,
       standing_rank_unknown = false,
       version = 2
 where team_id = '11111111-1111-1111-1111-111111111111'
   and reporting_year = 2025;

do $$
declare
  saved_state text;
  saved_outcome text;
  saved_lines integer;
begin
  select state, outcome into saved_state, saved_outcome
    from public.official_result_reports
   where team_id = '11111111-1111-1111-1111-111111111111'
     and reporting_year = 2025;
  if saved_state is distinct from 'submitted' or saved_outcome is distinct from 'has_results' then
    raise exception 'standing submit did not stick: % %', saved_state, saved_outcome;
  end if;
  select count(*) into saved_lines
    from public.official_result_lines
   where report_id = (
     select id from public.official_result_reports
      where team_id = '11111111-1111-1111-1111-111111111111'
        and reporting_year = 2025
   );
  if saved_lines <> 0 then
    raise exception 'standing submit required lines';
  end if;
end
$$;

insert into public.official_result_reports (
  team_id, reporting_year, state, outcome, version, created_by
) values (
  '11111111-1111-1111-1111-111111111111',
  2024,
  'draft',
  'unspecified',
  1,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

do $$
begin
  begin
    update public.official_result_reports
       set state = 'submitted',
           submission_kind = 'standing',
           standing_category = null,
           standing_rank_unknown = false,
           version = 2
     where team_id = '11111111-1111-1111-1111-111111111111'
       and reporting_year = 2024;
    raise exception 'standing submit without category was allowed';
  exception
    when others then
      if sqlerrm not like '%standing category required%' then
        raise;
      end if;
  end;
end
$$;

reset role;

insert into public.official_standing_candidates (
  team_id, fiscal_year, category, rank, source_url, fetched_at, evidence, confidence
) values
  ('11111111-1111-1111-1111-111111111111', 2025, 'U-12', 3, 'https://example.com/a', now(), 'a', 'high'),
  ('22222222-2222-2222-2222-222222222222', 2025, '一般', 1, 'https://example.com/b', now(), 'b', 'high');

do $$
declare
  still_submitted text;
begin
  select state into still_submitted
    from public.official_result_reports
   where team_id = '11111111-1111-1111-1111-111111111111'
     and reporting_year = 2025;
  if still_submitted is distinct from 'submitted' then
    raise exception 'candidate insert changed the report to %', still_submitted;
  end if;
end
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false);

do $$
declare
  own_count integer;
  other_count integer;
begin
  select count(*) into own_count
    from public.official_standing_candidates
   where team_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into other_count
    from public.official_standing_candidates
   where team_id = '22222222-2222-2222-2222-222222222222';
  if own_count <> 1 then
    raise exception 'coach could not read own candidate, saw %', own_count;
  end if;
  if other_count <> 0 then
    raise exception 'coach could read another team candidate';
  end if;
end
$$;
