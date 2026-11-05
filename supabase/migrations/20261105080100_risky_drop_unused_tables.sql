-- RISKY / レビュー前に適用しない
--
-- このファイルは空のレガシー表と、行が残っているバックアップ表を DROP する。
-- supabase db push はタイムスタンプ順に前の migration のあとでこれも実行する。
-- バックアップを残すなら、このファイルは適用しない。
--
-- 2026-11-05 時点の確認（本番は変更していない）:
--   match_threads, match_messages, match_applications, dm_threads は 0 行。
--   アプリとリポジトリ内の Edge Function から参照がない。
--   chat_threads / chat_messages / chat_members / match_requests が後継。
--   selection_events_backup_20260630 は 1047 行のスナップショット。
--   参照はないが、消すと復元できなくなる。適用前にダンプすること。
--
-- 依存順: match_messages が match_threads を参照しているので先に消す。

drop table if exists public.match_messages;
drop table if exists public.match_threads;
drop table if exists public.match_applications;
drop table if exists public.dm_threads;

-- 1047 行ある。ダンプを取ってからでなければ実行しない。
drop table if exists public.selection_events_backup_20260630;
