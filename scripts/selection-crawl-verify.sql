-- Read-only checks for the selection crawl pipeline.
-- Before numbers were measured on 2026-11-12, before this migration:
--   selection_events 3190
--   published 2960
--   published 募集中 1005
--   published 日付未取得 759
--   published 申込終了 601
--   published 開催終了 595
--   draft 日付未取得 230
--   Instagram research rows 474, and none of those teams had a non-social official site
--   published rows whose official_url is Instagram 1141
-- Preview of this migration (not applied):
--   duplicate rows collapsed 2180
--   survivor rows hidden because the official/source URL is social 449
--   other survivor rows hidden as unseen for 60 days 113
--   survivor rows that stay published 218, of which 49 keep a future date
-- Official-site counts below stay at 0 until discover-official-sites has run.

select status, display_status, count(*) as rows
from public.selection_events
group by status, display_status
order by rows desc;

select count(*) as published_recruiting
from public.selection_events
where status = 'published' and display_status = '募集中';

select count(*) as published_with_upcoming_date
from public.selection_events
where status = 'published'
  and event_date >= (timezone('Asia/Tokyo', now()))::date;

select count(*) as hidden_stale
from public.selection_events
where status = 'hidden' and hidden_reason = 'stale_unseen';

select count(*) as hidden_instagram
from public.selection_events
where status = 'hidden' and hidden_reason = 'uncrawlable_instagram';

select count(*) as collapsed_duplicates
from public.selection_events
where status = 'collapsed';

select count(*) as duplicate_groups_still_published
from (
  select coalesce(team_master_id::text, 'org:' || coalesce(organization_name, ''))
         || ':' || public.normalize_selection_url(source_url) as group_key
  from public.selection_events
  where status = 'published'
  group by 1
  having count(*) > 1
) groups;

select count(*) as event_date_missing_from_event_dates
from public.selection_events
where status = 'published'
  and event_date is not null
  and cardinality(coalesce(event_dates, array[]::text[])) > 0
  and not (to_char(event_date, 'YYYY-MM-DD') = any (event_dates));

select count(*) as null_event_date_with_dates
from public.selection_events
where status = 'published'
  and event_date is null
  and cardinality(coalesce(event_dates, array[]::text[])) > 0;

select count(*) as recruiting_unseen_60d
from public.selection_events
where status = 'published'
  and display_status = '募集中'
  and last_seen_at < now() - interval '60 days';

select pipeline, status, count(*) as runs,
       coalesce(sum(urls_attempted), 0) as urls_attempted,
       coalesce(sum(urls_succeeded), 0) as urls_succeeded,
       coalesce(sum(urls_failed), 0) as urls_failed,
       coalesce(sum(events_inserted), 0) as events_inserted,
       coalesce(sum(events_updated), 0) as events_updated
from public.selection_crawl_runs
group by pipeline, status
order by pipeline, status;

select status, count(*) as urls, count(*) filter (where error is not null) as with_error
from public.selection_crawl_url_outcomes
group by status
order by urls desc;

select decision, count(*) as candidates, count(distinct team_master_id) as teams
from public.team_official_site_candidates
group by decision
order by candidates desc;

select count(*) as teams_auto_accepted
from public.team_selection_research
where research_status = 'official_site_auto_accepted'
   or official_site_decision = 'auto_accepted';

select count(*) as instagram_research_rows
from public.team_selection_research
where selection_page_url ilike '%instagram.com%';

select count(*) as instagram_teams_still_pending_review
from public.team_selection_research
where selection_page_url ilike '%instagram.com%'
  and official_site_decision = 'pending_review';

select count(*) as instagram_teams_with_no_candidate
from public.team_selection_research
where selection_page_url ilike '%instagram.com%'
  and official_site_decision = 'no_candidate';

select count(*) as teams_whose_crawl_target_left_instagram
from public.team_selection_research
where research_status = 'official_site_auto_accepted'
  and selection_page_url not ilike '%instagram.com%'
  and previous_selection_page_url ilike '%instagram.com%';
