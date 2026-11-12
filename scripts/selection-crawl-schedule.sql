-- Run this after deploying verify-selection-domain-pages and discover-official-sites.
-- The migration pauses crawl-selection-pages so the previous function cannot
-- delete rows. This turns that job back on. The command itself is already the
-- batch-of-4 call installed by 20261112140000_selection_crawl_pipeline.sql.
-- discover-official-sites is scheduled by the migration (batch 2, every 10 minutes).
-- Both commands send x-selection-secret from vault secret selection_secret.
-- Create that vault secret, and set the same value as the SELECTION_SECRET
-- secret on both edge functions, before running this script. Discovery also
-- needs SERPER_API_KEY on discover-official-sites.

do $cron$
declare
  v_job bigint;
begin
  if to_regnamespace('cron') is null then
    raise exception 'pg_cron is not installed';
  end if;
  select jobid into v_job from cron.job where jobname = 'crawl-selection-pages';
  if v_job is null then
    raise exception 'crawl-selection-pages is not scheduled';
  end if;
  perform cron.alter_job(v_job, null, null, null, null, true);
end
$cron$;
