# 公式戦の年次報告

セレクション画面の分割（PR #2、`cursor/selection-frontend-split-7294`）とは別の変更です。このブランチは `main` から切ってあり、分割ブランチには依存しません。PR #2 はマージせず、選択画面の振り分けも有効にしません。

この文書の時点では、本番へのマージ、デプロイ、本番 Supabase への書き込みはしていません。適用順は PR #3 に書いてあります。

## 何をするか

所有者（`teams.owner_id`）と、`team_members.role` が `owner` / `coach` の人が、チームごとに1年度分の公式戦結果を確認して提出します。本番の `team_members_role_check` は `owner` / `coach` / `member` だけを許します。`manager` という役割は保存できないので、報告権限には入れていません。`member` は報告できません。

1. インターネット全体の自動検索はしません。検索用の有料サービスも、新しいアカウントも使いません。
2. チームが公開URLを指定すると、サーバがそのページだけを取得します。URL、取得時刻、内容のハッシュ、照合結果を残します。
3. ページ内にチーム名と対象年度があり、同じ行に明示されたスコアがあるときだけ下書き候補にします。日付がある行は、その年度の 4月1日から翌年3月31日までに入るときだけ残します。無いものは「無かった」と表示し、得点を作りません。
4. 候補の元の値は更新しません。チームが直した内容は別の行と訂正履歴に残します。
5. 提出ボタンを押したときだけ提出済みになり、確認者はログイン中のユーザー、時刻はサーバ時刻です。同じ内容の再送は、確認者と時刻を変えずに成功として返します。
6. 「公式戦はなかった」も、チームが明示して提出したときだけ成立します。

取得しただけでは提出にも確認済みにもなりません。

## 決めた年度と期限

2026-11-06 JST の決定です。

- 対象期間は日本の年度です。4月1日から翌年3月31日までです。暦年ではありません。
- 例: 2025年度は 2025-04-01 から 2026-03-31 です。
- 提出期限は、その年度の翌年度5月31日の終わり（日本時間）です。2025年度の期限は 2026-05-31 です。
- 2026-05-31 23:59:59.999（日本時間）までは期限内です。2026-06-01 0:00:00.000 から期限超過の表示になります。
- 日本時間は通年 UTC+9 です。夏時間はありません。
- 期限を過ぎても提出できます。ログイン、試合、チャット、予定、その他の機能は止めません。
- 画面に出す年度は、進行中の年度と、その直前の年度です。例として 2026-06-01 時点では 2025年度（期限超過）と 2026年度（進行中）です。それより前の未提出年度を、自動では期限超過の一覧に残しません。年を指定して開いて提出することはできます。

`official_result_policy` の初期行は `jp_fiscal`、期限 5月31日、`Asia/Tokyo`、`enforcement = status_only`、`late_submission = allowed` です。未設定の年はありません。データベースはこの行を別の期限へ変える制約を持っています。提出の可否は期限を見ていません。

## 権限

新しい関数に `security definer` はありません。RLS はチームの所有者と、`owner` / `coach` だけに開きます。`user_metadata` は見ていません。ブラウザに service role は置いていません。ビューは増やしていません。

マイグレーションは `supabase/migrations/20261105214326_annual_official_results.sql` です。本番にはまだありません。同じファイル名の古いコピー（対象年が未設定の版）は適用しないでください。本番の `schema_migrations` は `20261105102204 security_hardening` だけで、リポジトリの `20261105080000` や `20261105080100` とはバージョンが違います。フォルダ全体の `supabase db push` は、セキュリティ変更の再実行と、バックアップ表を消す `20261105080100_risky_drop_unused_tables.sql` につながるので使いません。

## 環境変数

新しい名前はありません。既存の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を、ログイン中のユーザーとして使います。

## 適用と戻し方

アプリより先に、この1ファイルだけを本番データベースへ適用します。その後で PR #3 をマージすると、画面が表を読みます。表が無い間、年次報告の画面は「未適用」と出します。試合やチャットの経路はこの表を読みません。

戻すときは、アプリを先に戻し、その後に次の順で削除します。

```sql
drop table if exists public.official_result_fetch_attempts;
drop table if exists public.official_result_line_revisions;
drop table if exists public.official_result_lines;
drop table if exists public.official_result_candidates;
drop table if exists public.official_result_sources;
drop table if exists public.official_result_reports;
drop table if exists public.official_result_policy;
drop function if exists public.official_result_lines_audit();
drop function if exists public.official_result_reports_guard();
```

適用時に `schema_migrations` へ記録した場合は、そのバージョン行も戻す対象です。

## まだ人が決めること

- 公式戦にどの大会を含めるか。この変更は範囲を新たに決めていません。
- 提出後に訂正を再開できるか。今のスキーマは提出済みを変更できません。

## 確認できたことと、できていないこと

単体テストと、空の PostgreSQL 16 にこのマイグレーションだけを入れた権限チェックで、年度の境界、期限、チーム分離、提出後の不変を見ます。結果のコマンドと成否は PR #3 に書きます。本番の Supabase では、この変更のために表の有無と既存列の型を読んだだけで、SQL の適用はしていません。公開ページの取得は、指定URLに対するサーバ取得までで、検索エンジン連携はありません。ログインしたブラウザでの提出操作は、本番にもローカルの実セッションでも確認していません。
