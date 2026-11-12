-- Additive affiliation and standing-report tables.
-- Do not apply this file to production from the app change itself.
-- Apply 20261105214326_annual_official_results.sql first if it is not already applied.
-- This file does not drop the per-match tables or their rows.
--
-- Outer policy columns are schema-qualified. An unqualified team_id inside
-- "from team_members tm" is resolved to tm.team_id, which is true for any
-- membership row the caller can see.

alter table public.official_result_reports
  add column submission_kind text not null default 'legacy_lines',
  add column standing_category text,
  add column standing_rank integer,
  add column standing_rank_unknown boolean not null default false,
  add column standing_source_url text,
  add column standing_candidate_id uuid;

alter table public.official_result_reports
  add constraint official_result_reports_submission_kind
    check (submission_kind in ('legacy_lines', 'standing')),
  add constraint official_result_reports_standing_rank
    check (standing_rank is null or standing_rank between 1 and 99),
  add constraint official_result_reports_standing_text
    check (
      (standing_category is null or char_length(standing_category) between 1 and 40)
      and (standing_source_url is null or char_length(standing_source_url) between 8 and 500)
    ),
  add constraint official_result_reports_standing_shape
    check (
      submission_kind <> 'standing'
      or (
        standing_category is not null
        and (
          (standing_rank_unknown and standing_rank is null)
          or ((not standing_rank_unknown) and standing_rank between 1 and 99)
        )
      )
    );

comment on column public.official_result_reports.submission_kind is
  'legacy_lines keeps the original per-match report. standing is category plus final rank.';

create or replace function public.official_result_reports_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is distinct from old.team_id
     or new.reporting_year is distinct from old.reporting_year
     or new.created_by is distinct from old.created_by then
    raise exception 'report identity is immutable';
  end if;

  if old.state = 'submitted' then
    raise exception 'submitted report is immutable';
  end if;

  if new.state = 'submitted' and old.state is distinct from 'submitted' then
    if auth.uid() is null then
      raise exception 'not authenticated';
    end if;
    if new.submission_kind = 'standing' then
      if new.standing_category is null or char_length(btrim(new.standing_category)) = 0 then
        raise exception 'standing category required';
      end if;
      if new.standing_rank_unknown then
        if new.standing_rank is not null then
          raise exception 'standing rank conflict';
        end if;
        new.outcome := 'no_official_results';
      else
        if new.standing_rank is null or new.standing_rank < 1 or new.standing_rank > 99 then
          raise exception 'standing rank required';
        end if;
        new.outcome := 'has_results';
      end if;
    elsif new.outcome = 'no_official_results' then
      if exists (
        select 1 from public.official_result_lines line
        where line.report_id = new.id
          and line.included
      ) then
        raise exception 'included lines remain';
      end if;
    elsif new.outcome = 'has_results' then
      if not exists (
        select 1 from public.official_result_lines line
        where line.report_id = new.id
          and line.included
      ) then
        raise exception 'included line required';
      end if;
    else
      raise exception 'outcome required';
    end if;
    new.submitted_by := auth.uid();
    new.submitted_at := now();
  end if;

  if new.version is distinct from old.version + 1 then
    raise exception 'report version must increase by 1';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.official_result_reports_guard() from public, anon;
grant execute on function public.official_result_reports_guard() to authenticated;

-- ---------------------------------------------------------------------------
-- Affiliation. 「所属なし」 is an explicit status, not a missing row.
-- ---------------------------------------------------------------------------

create table public.team_affiliations (
  team_id uuid primary key references public.teams (id) on delete cascade,
  status text not null,
  prefecture text,
  category text,
  organization_name text,
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_affiliations_status check (status in ('affiliated', 'none')),
  constraint team_affiliations_shape check (
    (
      status = 'none'
      and prefecture is null
      and category is null
      and organization_name is null
    )
    or (
      status = 'affiliated'
      and prefecture is not null
      and category is not null
      and organization_name is not null
      and char_length(prefecture) between 2 and 10
      and char_length(category) between 1 and 40
      and char_length(organization_name) between 1 and 80
    )
  )
);

comment on table public.team_affiliations is
  'League affiliation for results discovery. status none is an explicit 所属なし and still counts as registered.';

create table public.team_affiliation_dismissals (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

comment on table public.team_affiliation_dismissals is
  'Hides the affiliation prompt for that manager. It does not block any other feature.';

create table public.team_result_pages (
  team_id uuid primary key references public.teams (id) on delete cascade,
  url text,
  suggested_url text,
  status text not null,
  confidence text not null,
  note text,
  updated_by uuid references auth.users (id),
  last_crawled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint team_result_pages_status check (
    status in ('searching', 'found', 'needs_url', 'manual', 'none')
  ),
  constraint team_result_pages_confidence check (confidence in ('high', 'low', 'none')),
  constraint team_result_pages_url_len check (
    (url is null or char_length(url) between 8 and 500)
    and (suggested_url is null or char_length(suggested_url) between 8 and 500)
    and (note is null or char_length(note) <= 200)
  )
);

create index team_result_pages_due_idx
  on public.team_result_pages (status, last_crawled_at);

create table public.official_standing_candidates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  fiscal_year integer not null,
  category text,
  rank integer,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  evidence text not null,
  confidence text not null,
  created_at timestamptz not null default now(),
  constraint official_standing_candidates_year check (fiscal_year between 1990 and 2100),
  constraint official_standing_candidates_rank check (rank is null or rank between 1 and 99),
  constraint official_standing_candidates_confidence check (confidence in ('high', 'low')),
  constraint official_standing_candidates_text check (
    char_length(source_url) between 8 and 500
    and char_length(evidence) between 1 and 240
    and (category is null or char_length(category) between 1 and 40)
  )
);

create index official_standing_candidates_team_year_idx
  on public.official_standing_candidates (team_id, fiscal_year, fetched_at desc);

comment on table public.official_standing_candidates is
  'Crawled category and final rank. A row is not a submitted report.';

alter table public.official_result_reports
  add constraint official_result_reports_standing_candidate_fk
  foreign key (standing_candidate_id)
  references public.official_standing_candidates (id)
  on delete set null;

create table public.official_standing_fetches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  source_url text not null,
  host text not null,
  fiscal_year integer,
  ok boolean not null,
  error text,
  http_status integer,
  fetched_at timestamptz not null default now(),
  constraint official_standing_fetches_error_len check (
    (error is null or char_length(error) <= 200)
    and char_length(host) between 1 and 253
    and char_length(source_url) between 8 and 500
  )
);

create index official_standing_fetches_host_time_idx
  on public.official_standing_fetches (host, fetched_at desc);

create index official_standing_fetches_team_time_idx
  on public.official_standing_fetches (team_id, fetched_at desc);

comment on table public.official_standing_fetches is
  'Every crawl attempt, including failures. Failures stay here and do not surface as product errors.';

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger team_affiliations_touch
before update on public.team_affiliations
for each row
execute function public.touch_updated_at();

create trigger team_result_pages_touch
before update on public.team_result_pages
for each row
execute function public.touch_updated_at();

revoke all on function public.touch_updated_at() from public, anon;
grant execute on function public.touch_updated_at() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Managers of that team only. Candidates and fetch logs are service-role writes.
-- ---------------------------------------------------------------------------

alter table public.team_affiliations enable row level security;
alter table public.team_affiliation_dismissals enable row level security;
alter table public.team_result_pages enable row level security;
alter table public.official_standing_candidates enable row level security;
alter table public.official_standing_fetches enable row level security;

alter table public.team_affiliations force row level security;
alter table public.team_affiliation_dismissals force row level security;
alter table public.team_result_pages force row level security;
alter table public.official_standing_candidates force row level security;
alter table public.official_standing_fetches force row level security;

revoke all on table public.team_affiliations from public, anon, authenticated;
revoke all on table public.team_affiliation_dismissals from public, anon, authenticated;
revoke all on table public.team_result_pages from public, anon, authenticated;
revoke all on table public.official_standing_candidates from public, anon, authenticated;
revoke all on table public.official_standing_fetches from public, anon, authenticated;

grant select, insert, update on table public.team_affiliations to authenticated;
grant select, insert, update on table public.team_affiliation_dismissals to authenticated;
grant select, insert, update on table public.team_result_pages to authenticated;
grant select on table public.official_standing_candidates to authenticated;
grant select on table public.official_standing_fetches to authenticated;

create policy team_affiliations_select
on public.team_affiliations
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_affiliations.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = team_affiliations.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy team_affiliations_insert
on public.team_affiliations
for insert
to authenticated
with check (
  team_affiliations.updated_by = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_affiliations.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_affiliations.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy team_affiliations_update
on public.team_affiliations
for update
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_affiliations.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = team_affiliations.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
)
with check (
  team_affiliations.updated_by = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_affiliations.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_affiliations.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy team_affiliation_dismissals_select
on public.team_affiliation_dismissals
for select
to authenticated
using (team_affiliation_dismissals.user_id = (select auth.uid()));

create policy team_affiliation_dismissals_insert
on public.team_affiliation_dismissals
for insert
to authenticated
with check (
  team_affiliation_dismissals.user_id = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_affiliation_dismissals.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_affiliation_dismissals.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy team_affiliation_dismissals_update
on public.team_affiliation_dismissals
for update
to authenticated
using (team_affiliation_dismissals.user_id = (select auth.uid()))
with check (
  team_affiliation_dismissals.user_id = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_affiliation_dismissals.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_affiliation_dismissals.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy team_result_pages_select
on public.team_result_pages
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_result_pages.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = team_result_pages.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy team_result_pages_insert
on public.team_result_pages
for insert
to authenticated
with check (
  team_result_pages.updated_by = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_result_pages.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_result_pages.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy team_result_pages_update
on public.team_result_pages
for update
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_result_pages.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = team_result_pages.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
)
with check (
  team_result_pages.updated_by = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = team_result_pages.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_result_pages.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_standing_candidates_select
on public.official_standing_candidates
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_standing_candidates.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_standing_candidates.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_standing_fetches_select
on public.official_standing_fetches
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_standing_fetches.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_standing_fetches.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);
