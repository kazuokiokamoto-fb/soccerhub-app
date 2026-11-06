-- Annual official-match reports. Not applied to production by this change.
-- Apply this file once, at the reviewed SHA. Do not apply an older copy of the same filename.
-- Do not run supabase db push of the whole migrations folder against production:
-- production schema_migrations has 20261105102204 security_hardening, which does not match
-- the repo filenames 20261105080000 / 20261105080100. The later file drops backup tables.
--
-- Network retrieval stores sourced candidates only. It cannot mark a report submitted.
-- Authorization uses teams.owner_id and team_members.role (owner, coach).
-- Production team_members_role_check allows owner, coach, member. It does not allow manager.
-- No security definer helper is added. No user_metadata is read.
--
-- Decided 2026-11-06 JST:
--   period is the Japanese fiscal year, April 1 through the next March 31.
--   2025年度 is 2025-04-01 through 2026-03-31.
--   deadline is May 31 of the following fiscal year, end of that Asia/Tokyo day.
--   2025年度 is due through 2026-05-31 23:59:59.999 Asia/Tokyo and overdue from 2026-06-01 00:00.
--   enforcement is status_only. Late submission stays allowed.
--   This schema has no path that blocks login, matches, chat, or scheduling.
--   Reopening a submitted report is still undecided, so submitted rows stay immutable.

-- ---------------------------------------------------------------------------
-- Policy: standing fiscal-year rule. There is no unset year.
-- ---------------------------------------------------------------------------

create table public.official_result_policy (
  id integer primary key,
  period_kind text not null,
  deadline_month integer not null,
  deadline_day integer not null,
  deadline_time_zone text not null,
  enforcement text not null default 'status_only',
  late_submission text not null default 'allowed',
  updated_at timestamptz not null default now(),
  constraint official_result_policy_singleton check (id = 1),
  constraint official_result_policy_period check (period_kind = 'jp_fiscal'),
  constraint official_result_policy_deadline check (deadline_month = 5 and deadline_day = 31),
  constraint official_result_policy_zone check (deadline_time_zone = 'Asia/Tokyo'),
  constraint official_result_policy_enforcement check (enforcement = 'status_only'),
  constraint official_result_policy_late check (late_submission = 'allowed')
);

insert into public.official_result_policy (
  id, period_kind, deadline_month, deadline_day, deadline_time_zone, enforcement, late_submission
) values (
  1, 'jp_fiscal', 5, 31, 'Asia/Tokyo', 'status_only', 'allowed'
);

comment on table public.official_result_policy is
  'Japanese fiscal year April 1 through March 31. Deadline is May 31 of the following fiscal year, end of that Asia/Tokyo day. status_only never blocks login, matches, chat, or scheduling. Late submission stays allowed.';

-- ---------------------------------------------------------------------------
-- Reports, sources, frozen candidates, team lines, correction history
-- ---------------------------------------------------------------------------

create table public.official_result_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  reporting_year integer not null,
  state text not null default 'draft',
  outcome text not null default 'unspecified',
  version integer not null default 1,
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_result_reports_year check (reporting_year between 1990 and 2100),
  constraint official_result_reports_state check (state in ('draft', 'in_review', 'submitted')),
  constraint official_result_reports_outcome check (
    outcome in ('unspecified', 'has_results', 'no_official_results')
  ),
  constraint official_result_reports_version check (version > 0),
  constraint official_result_reports_submit_shape check (
    (
      state <> 'submitted'
      and submitted_at is null
      and submitted_by is null
    )
    or (
      state = 'submitted'
      and submitted_at is not null
      and submitted_by is not null
      and outcome in ('has_results', 'no_official_results')
    )
  ),
  constraint official_result_reports_team_year unique (team_id, reporting_year)
);

comment on table public.official_result_reports is
  'One team-authored annual report. submitted means a manager confirmed it. A fetched page never sets this.';

comment on column public.official_result_reports.reporting_year is
  'Fiscal-year label. 2025 means 2025-04-01 through 2026-03-31 Asia/Tokyo. The database does not reject a submit after the May 31 deadline.';

create table public.official_result_sources (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.official_result_reports (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  retrieval_method text not null,
  discovery_extent text not null,
  match_confidence text not null,
  http_status integer,
  content_sha256 text,
  page_title text,
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint official_result_sources_method check (retrieval_method = 'manual_url'),
  constraint official_result_sources_extent check (
    discovery_extent in ('manual_url_only', 'page_fetched', 'fetch_failed', 'no_automatic_search')
  ),
  constraint official_result_sources_confidence check (
    match_confidence in (
      'not_evaluated',
      'team_and_year_seen',
      'team_or_year_missing',
      'no_explicit_results'
    )
  ),
  constraint official_result_sources_url_len check (char_length(source_url) between 8 and 500),
  constraint official_result_sources_title_len check (
    page_title is null or char_length(page_title) <= 120
  ),
  constraint official_result_sources_note_len check (
    note is null or char_length(note) <= 300
  )
);

create unique index official_result_sources_url_hash_uidx
  on public.official_result_sources (report_id, source_url, content_sha256)
  where content_sha256 is not null;

comment on table public.official_result_sources is
  'Provenance for a public page. discovery_extent describes what was actually retrieved.';

create table public.official_result_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.official_result_sources (id) on delete cascade,
  report_id uuid not null references public.official_result_reports (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  competition_name text,
  opponent_name text,
  played_on date,
  team_goals integer,
  opponent_goals integer,
  excerpt text not null,
  match_basis text not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint official_result_candidates_goals check (
    (team_goals is null or team_goals between 0 and 20)
    and (opponent_goals is null or opponent_goals between 0 and 20)
    and (
      (team_goals is null and opponent_goals is null)
      or (team_goals is not null and opponent_goals is not null)
    )
  ),
  constraint official_result_candidates_text check (
    char_length(excerpt) between 1 and 240
    and char_length(match_basis) between 1 and 300
    and (competition_name is null or char_length(competition_name) <= 80)
    and (opponent_name is null or char_length(opponent_name) <= 80)
  ),
  constraint official_result_candidates_fingerprint unique (source_id, fingerprint)
);

create index official_result_candidates_report_fingerprint_idx
  on public.official_result_candidates (report_id, fingerprint);

comment on table public.official_result_candidates is
  'Frozen source values. No update policy. These are not the team submission.';

create table public.official_result_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.official_result_reports (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  origin_candidate_id uuid references public.official_result_candidates (id) on delete set null,
  competition_name text not null,
  opponent_name text not null,
  played_on date,
  team_goals integer,
  opponent_goals integer,
  result_label text not null default 'unknown',
  included boolean not null default true,
  team_note text,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_result_lines_goals check (
    (team_goals is null or team_goals between 0 and 20)
    and (opponent_goals is null or opponent_goals between 0 and 20)
  ),
  constraint official_result_lines_label check (
    result_label in ('win', 'loss', 'draw', 'unknown')
  ),
  constraint official_result_lines_text check (
    char_length(competition_name) between 1 and 80
    and char_length(opponent_name) between 1 and 80
    and (team_note is null or char_length(team_note) <= 200)
  ),
  constraint official_result_lines_version check (version > 0)
);

create index official_result_lines_report_idx
  on public.official_result_lines (report_id, sort_order, created_at);

create table public.official_result_line_revisions (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null,
  report_id uuid not null references public.official_result_reports (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  editor_id uuid not null references auth.users (id),
  edited_at timestamptz not null default now(),
  before_values jsonb not null,
  after_values jsonb not null
);

create index official_result_line_revisions_report_idx
  on public.official_result_line_revisions (report_id, edited_at desc);

comment on table public.official_result_line_revisions is
  'Team correction history. Separate from the frozen source candidate.';

create table public.official_result_fetch_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index official_result_fetch_attempts_team_time_idx
  on public.official_result_fetch_attempts (team_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers. Not security definer. authenticated needs EXECUTE so the write runs.
-- ---------------------------------------------------------------------------

create function public.official_result_reports_guard()
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
    if new.outcome = 'no_official_results' then
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

create trigger official_result_reports_guard
before update on public.official_result_reports
for each row
execute function public.official_result_reports_guard();

create function public.official_result_lines_audit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  line_before jsonb;
  line_after jsonb;
  report_year integer;
begin
  if tg_op <> 'DELETE' and new.played_on is not null then
    select r.reporting_year into report_year
      from public.official_result_reports r
     where r.id = new.report_id;
    if report_year is null
       or new.played_on < make_date(report_year, 4, 1)
       or new.played_on > make_date(report_year + 1, 3, 31) then
      raise exception 'played_on is outside the fiscal year';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.report_id is distinct from old.report_id
       or new.team_id is distinct from old.team_id
       or new.origin_candidate_id is distinct from old.origin_candidate_id then
      raise exception 'line identity is immutable';
    end if;

    if auth.uid() is null then
      raise exception 'not authenticated';
    end if;

    line_before := jsonb_build_object(
      'competition_name', old.competition_name,
      'opponent_name', old.opponent_name,
      'played_on', old.played_on,
      'team_goals', old.team_goals,
      'opponent_goals', old.opponent_goals,
      'result_label', old.result_label,
      'included', old.included,
      'team_note', old.team_note,
      'sort_order', old.sort_order
    );
    line_after := jsonb_build_object(
      'competition_name', new.competition_name,
      'opponent_name', new.opponent_name,
      'played_on', new.played_on,
      'team_goals', new.team_goals,
      'opponent_goals', new.opponent_goals,
      'result_label', new.result_label,
      'included', new.included,
      'team_note', new.team_note,
      'sort_order', new.sort_order
    );

    if line_before is distinct from line_after then
      insert into public.official_result_line_revisions (
        line_id, report_id, team_id, editor_id, before_values, after_values
      )
      values (
        old.id, old.report_id, old.team_id, auth.uid(), line_before, line_after
      );
    end if;

    new.version := old.version + 1;
    new.updated_at := now();
  end if;

  update public.official_result_reports
     set version = version + 1,
         updated_at = now()
   where id = coalesce(new.report_id, old.report_id)
     and state <> 'submitted';

  return coalesce(new, old);
end;
$$;

create trigger official_result_lines_audit
before insert or update or delete on public.official_result_lines
for each row
execute function public.official_result_lines_audit();

revoke all on function public.official_result_reports_guard() from public, anon;
revoke all on function public.official_result_lines_audit() from public, anon;
grant execute on function public.official_result_reports_guard() to authenticated;
grant execute on function public.official_result_lines_audit() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Team managers only. Policy row is readable, not writable, except admins.
--
-- Outer columns are schema-qualified. PostgreSQL resolves an unqualified name
-- from the innermost query. Inside "from team_members tm", "tm.team_id = team_id"
-- means tm.team_id = tm.team_id, which is true for any membership row the caller
-- can see. team_members_select_self makes a coach's own row visible, so that
-- predicate would allow a coach or member-owner of team A to write team B.
-- The same capture happens for "r.team_id = team_id" inside a reports subquery.
-- ---------------------------------------------------------------------------

alter table public.official_result_policy enable row level security;
alter table public.official_result_reports enable row level security;
alter table public.official_result_sources enable row level security;
alter table public.official_result_candidates enable row level security;
alter table public.official_result_lines enable row level security;
alter table public.official_result_line_revisions enable row level security;
alter table public.official_result_fetch_attempts enable row level security;

alter table public.official_result_policy force row level security;
alter table public.official_result_reports force row level security;
alter table public.official_result_sources force row level security;
alter table public.official_result_candidates force row level security;
alter table public.official_result_lines force row level security;
alter table public.official_result_line_revisions force row level security;
alter table public.official_result_fetch_attempts force row level security;

revoke all on table public.official_result_policy from public, anon, authenticated;
revoke all on table public.official_result_reports from public, anon, authenticated;
revoke all on table public.official_result_sources from public, anon, authenticated;
revoke all on table public.official_result_candidates from public, anon, authenticated;
revoke all on table public.official_result_lines from public, anon, authenticated;
revoke all on table public.official_result_line_revisions from public, anon, authenticated;
revoke all on table public.official_result_fetch_attempts from public, anon, authenticated;

grant select on table public.official_result_policy to authenticated;
grant select, insert, update on table public.official_result_reports to authenticated;
grant select, insert on table public.official_result_sources to authenticated;
grant select, insert on table public.official_result_candidates to authenticated;
grant select, insert, update, delete on table public.official_result_lines to authenticated;
grant select, insert on table public.official_result_line_revisions to authenticated;
grant select, insert on table public.official_result_fetch_attempts to authenticated;

create policy official_result_policy_select
on public.official_result_policy
for select
to authenticated
using (true);

create policy official_result_policy_update_admin
on public.official_result_policy
for update
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  period_kind = 'jp_fiscal'
  and deadline_month = 5
  and deadline_day = 31
  and deadline_time_zone = 'Asia/Tokyo'
  and enforcement = 'status_only'
  and late_submission = 'allowed'
  and exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  )
);

create policy official_result_reports_select
on public.official_result_reports
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_reports.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_reports.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_reports_insert
on public.official_result_reports
for insert
to authenticated
with check (
  official_result_reports.created_by = (select auth.uid())
  and official_result_reports.state = 'draft'
  and official_result_reports.outcome = 'unspecified'
  and official_result_reports.submitted_at is null
  and official_result_reports.submitted_by is null
  and official_result_reports.version = 1
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_reports.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_reports.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_reports_update
on public.official_result_reports
for update
to authenticated
using (
  official_result_reports.state <> 'submitted'
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_reports.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_reports.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
)
with check (
  exists (
    select 1 from public.teams t
    where t.id = official_result_reports.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_reports.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_sources_select
on public.official_result_sources
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_sources.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_sources.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_sources_insert
on public.official_result_sources
for insert
to authenticated
with check (
  official_result_sources.created_by = (select auth.uid())
  and exists (
    select 1 from public.official_result_reports r
    where r.id = official_result_sources.report_id
      and r.team_id = official_result_sources.team_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_sources.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_sources.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_candidates_select
on public.official_result_candidates
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_candidates.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_candidates.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_candidates_insert
on public.official_result_candidates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.official_result_sources s
    join public.official_result_reports r on r.id = s.report_id
    where s.id = official_result_candidates.source_id
      and s.report_id = official_result_candidates.report_id
      and s.team_id = official_result_candidates.team_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_candidates.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_candidates.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_lines_select
on public.official_result_lines
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_lines.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_lines.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_lines_insert
on public.official_result_lines
for insert
to authenticated
with check (
  official_result_lines.version = 1
  and exists (
    select 1 from public.official_result_reports r
    where r.id = official_result_lines.report_id
      and r.team_id = official_result_lines.team_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_lines.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_lines.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_lines_update
on public.official_result_lines
for update
to authenticated
using (
  exists (
    select 1 from public.official_result_reports r
    where r.id = official_result_lines.report_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_lines.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_lines.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
)
with check (
  exists (
    select 1 from public.official_result_reports r
    where r.id = official_result_lines.report_id
      and r.team_id = official_result_lines.team_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_lines.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_lines.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_lines_delete
on public.official_result_lines
for delete
to authenticated
using (
  exists (
    select 1 from public.official_result_reports r
    where r.id = official_result_lines.report_id
      and r.state <> 'submitted'
  )
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_lines.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_lines.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_line_revisions_select
on public.official_result_line_revisions
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_line_revisions.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_line_revisions.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_line_revisions_insert
on public.official_result_line_revisions
for insert
to authenticated
with check (
  official_result_line_revisions.editor_id = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_line_revisions.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_line_revisions.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);

create policy official_result_fetch_attempts_select
on public.official_result_fetch_attempts
for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = official_result_fetch_attempts.team_id
      and t.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = official_result_fetch_attempts.team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'coach')
  )
);

create policy official_result_fetch_attempts_insert
on public.official_result_fetch_attempts
for insert
to authenticated
with check (
  official_result_fetch_attempts.user_id = (select auth.uid())
  and (
    exists (
      select 1 from public.teams t
      where t.id = official_result_fetch_attempts.team_id
        and t.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = official_result_fetch_attempts.team_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'coach')
    )
  )
);
