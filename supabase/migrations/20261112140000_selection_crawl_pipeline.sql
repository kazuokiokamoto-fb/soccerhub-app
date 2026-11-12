-- Selection crawl pipeline.
-- Backup: public.selection_events_backup_20261112
-- Apply this file by itself. Do not run `supabase db push` (older migrations drop backups).
-- Deploy verify-selection-domain-pages and discover-official-sites immediately after,
-- then run scripts/selection-crawl-schedule.sql. Until that script runs, job
-- crawl-selection-pages is paused so the previous function cannot delete rows.
-- Before enabling the cron, store the same SELECTION_SECRET value in vault as
-- name selection_secret. The cron sends it as x-selection-secret. The functions
-- reject the call when that header does not match their SELECTION_SECRET env.
--
-- Rollback (does not delete rows created after this migration):
--
-- update public.selection_events se
-- set status = b.status,
--     display_status = b.display_status,
--     event_date = b.event_date,
--     event_dates = b.event_dates,
--     duplicate_key = b.duplicate_key,
--     content_hash = b.content_hash,
--     hidden_reason = null,
--     collapsed_into = null,
--     updated_at = b.updated_at
-- from public.selection_events_backup_20261112 b
-- where se.id = b.id;
--
-- update public.team_selection_research
-- set selection_page_url = previous_selection_page_url,
--     official_homepage_url = previous_selection_page_url,
--     research_status = 'needs_review',
--     official_site_decision = 'rolled_back',
--     checked_at = null
-- where research_status = 'official_site_auto_accepted'
--   and previous_selection_page_url is not null;
--
-- update public.team_master tm
-- set official_url = c.previous_team_official_url
-- from public.team_official_site_candidates c
-- where c.team_master_id = tm.id
--   and c.decision = 'auto_accepted'
--   and tm.official_url = c.accepted_url;
--
-- update public.team_official_site_candidates
-- set decision = 'pending', accepted_url = null
-- where decision = 'auto_accepted';
--
-- Redeploy verify-selection-domain-pages from commit 34390ec (dashboard version v41).
-- Restore cron job crawl-selection-pages to active and this command (batchSize 20, no timeout argument):
--   SELECT net.http_post(
--     url := 'https://senspqsexmtrwjfsdadv.supabase.co/functions/v1/verify-selection-domain-pages',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--     ),
--     body := jsonb_build_object('batchSize', 20)
--   ) AS request_id;
-- select cron.unschedule('discover-official-sites');

create table public.selection_events_backup_20261112 as
select * from public.selection_events;

alter table public.selection_events_backup_20261112 enable row level security;
revoke all on table public.selection_events_backup_20261112 from public, anon, authenticated;
grant select on table public.selection_events_backup_20261112 to service_role;

alter table public.selection_events
  add column if not exists hidden_reason text,
  add column if not exists collapsed_into uuid;

alter table public.team_selection_research
  add column if not exists crawl_after timestamptz,
  add column if not exists previous_selection_page_url text,
  add column if not exists official_site_checked_at timestamptz,
  add column if not exists official_site_decision text;

create table public.selection_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline text not null,
  status text not null,
  trigger text,
  batch_size integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  urls_attempted integer not null default 0,
  urls_succeeded integer not null default 0,
  urls_failed integer not null default 0,
  events_inserted integer not null default 0,
  events_updated integer not null default 0,
  error text
);

create table public.selection_crawl_url_outcomes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.selection_crawl_runs (id) on delete cascade,
  research_id uuid,
  team_master_id uuid,
  url text,
  final_url text,
  status text,
  http_status integer,
  events_inserted integer not null default 0,
  events_updated integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz
);

create table public.selection_crawl_hosts (
  host text primary key,
  robots_txt text,
  robots_status integer,
  robots_fetched_at timestamptz,
  last_request_at timestamptz,
  backoff_until timestamptz,
  last_failure text,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint selection_crawl_hosts_last_failure_check check (
    last_failure is null or last_failure in ('network', 'robots')
  )
);

create table public.team_official_site_candidates (
  id uuid primary key default gen_random_uuid(),
  team_master_id uuid not null,
  research_id uuid,
  query text,
  candidate_url text not null,
  candidate_norm text not null,
  final_url text,
  accepted_url text,
  title text,
  snippet text,
  confidence integer not null default 0,
  reasons text[] not null default '{}',
  decision text not null,
  http_status integer,
  previous_selection_page_url text,
  previous_team_official_url text,
  run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_official_site_candidates_decision_check check (
    decision in (
      'pending',
      'auto_accepted',
      'pending_unverified',
      'fetch_failed',
      'robots_denied',
      'skipped_blocked',
      'no_candidate'
    )
  )
);

create unique index team_official_site_candidates_team_url_idx
  on public.team_official_site_candidates (team_master_id, candidate_norm);

create index selection_crawl_runs_pipeline_idx
  on public.selection_crawl_runs (pipeline, status, started_at desc);

create index selection_crawl_url_outcomes_run_idx
  on public.selection_crawl_url_outcomes (run_id);

alter table public.selection_crawl_runs enable row level security;
alter table public.selection_crawl_url_outcomes enable row level security;
alter table public.selection_crawl_hosts enable row level security;
alter table public.team_official_site_candidates enable row level security;

revoke all on table public.selection_crawl_runs from public, anon, authenticated;
revoke all on table public.selection_crawl_url_outcomes from public, anon, authenticated;
revoke all on table public.selection_crawl_hosts from public, anon, authenticated;
revoke all on table public.team_official_site_candidates from public, anon, authenticated;

grant select, insert, update, delete on table public.selection_crawl_runs to service_role;
grant select, insert, update, delete on table public.selection_crawl_url_outcomes to service_role;
grant select, insert, update, delete on table public.selection_crawl_hosts to service_role;
grant select, insert, update, delete on table public.team_official_site_candidates to service_role;

create or replace function public.selection_url_is_uncrawlable(input_url text)
returns boolean
language sql
immutable
set search_path = public
as $fn$
  select coalesce(public.normalize_selection_url(input_url), '') ~
    '(^|\.)(instagram\.com|youtube\.com|youtu\.be|line\.me|lin\.ee|facebook\.com|fb\.com|tiktok\.com|twitter\.com|x\.com|t\.co|google\.com|forms\.gle)(/|$)'
$fn$;

revoke all on function public.selection_url_is_uncrawlable(text) from public, anon, authenticated;
grant execute on function public.selection_url_is_uncrawlable(text) to service_role;

create or replace function public.selection_crawl_host(input_url text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(
        split_part(coalesce(public.normalize_selection_url(input_url), ''), '/', 1),
        ':[0-9]+$',
        ''
      ),
      '^www\.',
      ''
    ),
    ''
  );
$fn$;

create or replace function public.selection_host_observation_failed(input_url text, last_seen timestamptz)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1
    from public.selection_crawl_hosts h
    where h.host = public.selection_crawl_host(input_url)
      and h.last_failure in ('network', 'robots')
      and h.last_failure_at is not null
      and last_seen is not null
      and h.last_failure_at > last_seen
  );
$fn$;

revoke all on function public.selection_crawl_host(text) from public, anon, authenticated;
revoke all on function public.selection_host_observation_failed(text, timestamptz) from public, anon, authenticated;
grant execute on function public.selection_crawl_host(text) to service_role;
grant execute on function public.selection_host_observation_failed(text, timestamptz) to service_role;

create temporary table selection_event_plan as
with published as (
  select
    se.id,
    se.manual_locked,
    se.last_seen_at,
    se.created_at,
    se.fetched_at,
    se.event_date,
    se.event_dates,
    case
      when se.team_master_id is not null then se.team_master_id::text
      else 'org:' || coalesce(se.organization_name, '')
    end || ':' || public.normalize_selection_url(se.source_url) as group_key
  from public.selection_events se
  where se.status = 'published'
),
ranked as (
  select
    p.*,
    row_number() over (
      partition by p.group_key
      order by p.manual_locked desc, p.last_seen_at desc nulls last, p.created_at desc nulls last, p.id
    ) as rn,
    count(*) over (partition by p.group_key) as grp_n,
    max(p.last_seen_at) over (partition by p.group_key) as grp_last_seen
  from published p
)
select
  ranked.*,
  encode(extensions.digest(convert_to(ranked.group_key, 'UTF8'), 'sha256'), 'hex') as stable_key
from ranked;

create temporary table selection_kept_dates as
with exploded as (
  select
    r.group_key,
    r.grp_n,
    d.val as event_date,
    (
      d.val = to_char((timezone('Asia/Tokyo', r.created_at))::date, 'YYYY-MM-DD')
      or d.val = to_char((timezone('Asia/Tokyo', r.created_at))::date + interval '1 year', 'YYYY-MM-DD')
      or d.val = to_char((timezone('Asia/Tokyo', r.fetched_at))::date, 'YYYY-MM-DD')
      or d.val = to_char((timezone('Asia/Tokyo', r.fetched_at))::date + interval '1 year', 'YYYY-MM-DD')
      or d.val = to_char((timezone('Asia/Tokyo', r.last_seen_at))::date, 'YYYY-MM-DD')
      or d.val = to_char((timezone('Asia/Tokyo', r.last_seen_at))::date + interval '1 year', 'YYYY-MM-DD')
    ) as artifact
  from selection_event_plan r
  cross join lateral (
    select val
    from (
      select unnest(
        case
          when cardinality(coalesce(r.event_dates, array[]::text[])) > 0 then coalesce(r.event_dates, array[]::text[])
          when r.event_date is not null then array[to_char(r.event_date, 'YYYY-MM-DD')]
          else array[]::text[]
        end
      ) as val
    ) raw
    where val ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) d
)
select group_key, event_date
from exploded
group by group_key, event_date
having bool_or(grp_n = 1) or bool_or(coalesce(artifact, false) = false);

create temporary table selection_survivor_dates as
select
  group_key,
  coalesce(array_agg(event_date order by event_date), array[]::text[]) as event_dates,
  min(event_date) filter (
    where event_date >= to_char((timezone('Asia/Tokyo', now()))::date, 'YYYY-MM-DD')
  ) as future_date,
  max(event_date) filter (
    where event_date < to_char((timezone('Asia/Tokyo', now()))::date, 'YYYY-MM-DD')
  ) as past_date
from selection_kept_dates
group by group_key;

update public.selection_events se
set
  status = 'collapsed',
  hidden_reason = 'collapsed_duplicate',
  collapsed_into = survivor.id,
  content_hash = null,
  duplicate_key = 'collapsed:' || se.id::text,
  updated_at = now()
from selection_event_plan loser
join selection_event_plan survivor
  on survivor.group_key = loser.group_key
 and survivor.rn = 1
where se.id = loser.id
  and loser.rn > 1
  and loser.manual_locked = false;

update public.selection_events se
set content_hash = null
where se.content_hash in (
  select stable_key from selection_event_plan where rn = 1
);

update public.selection_events se
set
  duplicate_key = plan.stable_key,
  content_hash = plan.stable_key,
  event_dates = coalesce(dates.event_dates, array[]::text[]),
  event_date = nullif(coalesce(dates.future_date, dates.past_date), '')::date,
  display_status = case
    when se.application_deadline is not null
      and se.application_deadline::text < to_char((timezone('Asia/Tokyo', now()))::date, 'YYYY-MM-DD')
      then '申込終了'
    when coalesce(cardinality(dates.event_dates), 0) = 0 and se.is_rolling_recruitment is true then '募集中'
    when coalesce(cardinality(dates.event_dates), 0) = 0 then '日付未取得'
    when dates.future_date is null and dates.past_date is not null then '開催終了'
    else '募集中'
  end,
  status = case
    when public.selection_url_is_uncrawlable(se.source_url)
      or public.selection_url_is_uncrawlable(se.selection_page_url)
      or public.selection_url_is_uncrawlable(se.official_url)
      then 'hidden'
    when plan.grp_last_seen < now() - interval '60 days'
      and not public.selection_host_observation_failed(se.source_url, plan.grp_last_seen)
      and not public.selection_host_observation_failed(se.selection_page_url, plan.grp_last_seen)
      then 'hidden'
    else 'published'
  end,
  hidden_reason = case
    when public.selection_url_is_uncrawlable(se.source_url)
      or public.selection_url_is_uncrawlable(se.selection_page_url)
      or public.selection_url_is_uncrawlable(se.official_url)
      then 'uncrawlable_instagram'
    when plan.grp_last_seen < now() - interval '60 days'
      and not public.selection_host_observation_failed(se.source_url, plan.grp_last_seen)
      and not public.selection_host_observation_failed(se.selection_page_url, plan.grp_last_seen)
      then 'stale_unseen'
    else null
  end,
  updated_at = now()
from selection_event_plan plan
left join selection_survivor_dates dates on dates.group_key = plan.group_key
where se.id = plan.id
  and plan.rn = 1
  and plan.manual_locked = false;

update public.selection_events se
set
  duplicate_key = plan.stable_key,
  content_hash = plan.stable_key,
  updated_at = now()
from selection_event_plan plan
where se.id = plan.id
  and plan.rn = 1
  and plan.manual_locked = true;

drop table selection_survivor_dates;
drop table selection_kept_dates;
drop table selection_event_plan;

create or replace function public.refresh_selection_event_status()
returns void
language plpgsql
set search_path = public
as $fn$
declare
  today text := to_char((timezone('Asia/Tokyo', now()))::date, 'YYYY-MM-DD');
begin
  update public.selection_events se
  set
    event_dates = case
      when cardinality(coalesce(se.event_dates, array[]::text[])) > 0 then (
        select coalesce(array_agg(d order by d), array[]::text[])
        from (
          select distinct val as d
          from unnest(se.event_dates) as u(val)
          where val ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ) cleaned
      )
      when se.event_date is not null then array[to_char(se.event_date, 'YYYY-MM-DD')]
      else coalesce(se.event_dates, array[]::text[])
    end,
    event_date = (
      select coalesce(
        min(d) filter (where d >= today),
        max(d) filter (where d < today)
      )::date
      from (
        select val as d
        from unnest(
          case
            when cardinality(coalesce(se.event_dates, array[]::text[])) > 0 then se.event_dates
            when se.event_date is not null then array[to_char(se.event_date, 'YYYY-MM-DD')]
            else array[]::text[]
          end
        ) as u(val)
        where val ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ) dates
    ),
    updated_at = now()
  where se.status = 'published'
    and se.manual_locked = false
    and (
      cardinality(coalesce(se.event_dates, array[]::text[])) > 0
      or se.event_date is not null
    );

  update public.selection_events se
  set
    display_status = case
      when se.display_status = '申込終了' then '申込終了'
      when se.application_deadline is not null and se.application_deadline::text < today then '申込終了'
      when coalesce(cardinality(se.event_dates), 0) = 0 and se.is_rolling_recruitment is true then '募集中'
      when coalesce(cardinality(se.event_dates), 0) = 0 then '日付未取得'
      when (
        select max(val)
        from unnest(coalesce(se.event_dates, array[]::text[])) as u(val)
        where val ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ) < today then '開催終了'
      else '募集中'
    end,
    status = case
      when public.selection_url_is_uncrawlable(se.source_url)
        or public.selection_url_is_uncrawlable(se.selection_page_url)
        or public.selection_url_is_uncrawlable(se.official_url)
        then 'hidden'
      when se.last_seen_at < now() - interval '60 days'
        and not public.selection_host_observation_failed(se.source_url, se.last_seen_at)
        and not public.selection_host_observation_failed(se.selection_page_url, se.last_seen_at)
        then 'hidden'
      else se.status
    end,
    hidden_reason = case
      when public.selection_url_is_uncrawlable(se.source_url)
        or public.selection_url_is_uncrawlable(se.selection_page_url)
        or public.selection_url_is_uncrawlable(se.official_url)
        then 'uncrawlable_instagram'
      when se.last_seen_at < now() - interval '60 days'
        and not public.selection_host_observation_failed(se.source_url, se.last_seen_at)
        and not public.selection_host_observation_failed(se.selection_page_url, se.last_seen_at)
        then 'stale_unseen'
      else se.hidden_reason
    end,
    updated_at = now()
  where se.status = 'published'
    and se.manual_locked = false;
end;
$fn$;

revoke all on function public.refresh_selection_event_status() from public, anon, authenticated;
grant execute on function public.refresh_selection_event_status() to service_role;

do $cron$
declare
  v_job bigint;
  v_command text := $cmd$
  SELECT net.http_post(
    url := 'https://senspqsexmtrwjfsdadv.supabase.co/functions/v1/verify-selection-domain-pages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'x-selection-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'selection_secret')
    ),
    body := jsonb_build_object('batchSize', 4, 'trigger', 'pg_cron'),
    timeout_milliseconds := 5000
  ) AS request_id;
$cmd$;
  v_discover text := $cmd$
  SELECT net.http_post(
    url := 'https://senspqsexmtrwjfsdadv.supabase.co/functions/v1/discover-official-sites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'x-selection-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'selection_secret')
    ),
    body := jsonb_build_object('batchSize', 2, 'trigger', 'pg_cron'),
    timeout_milliseconds := 5000
  ) AS request_id;
$cmd$;
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron is not installed; selection crawl schedule was left unchanged';
    return;
  end if;

  select jobid into v_job from cron.job where jobname = 'crawl-selection-pages';
  if v_job is not null then
    perform cron.alter_job(v_job, null, v_command, null, null, false);
  end if;

  if not exists (select 1 from cron.job where jobname = 'discover-official-sites') then
    perform cron.schedule('discover-official-sites', '*/10 * * * *', v_discover);
  end if;
end
$cron$;
