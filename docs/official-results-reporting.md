# 公式戦の年次報告

セレクション画面の分割（PR #2、`cursor/selection-frontend-split-7294`）とは別の変更です。このブランチは `main` から切ってあり、分割ブランチには依存しません。両方をマージするときは、触っているファイルが重ならないことを確認してください。

本番への適用、デプロイ、本番 Supabase への書き込みはしていません。

## 何をするか

管理者（`teams.owner_id`）と、`team_members.role` が `owner` / `coach` / `manager` の人が、チームごとに1年分の公式戦結果を確認して提出します。

1. インターネット全体の自動検索はしません。検索用の有料サービスも、新しいアカウントも使いません。
2. チームが公開URLを指定すると、サーバがそのページだけを取得します。URL、取得時刻、内容のハッシュ、照合結果を残します。
3. ページ内にチーム名と対象年があり、同じ行に明示されたスコアがあるときだけ下書き候補にします。無いものは「無かった」と表示し、得点を作りません。
4. 候補の元の値は更新しません。チームが直した内容は別の行と訂正履歴に残します。
5. 提出ボタンを押したときだけ提出済みになり、確認者はログイン中のユーザー、時刻はサーバ時刻です。同じ内容の再送は、確認者と時刻を変えずに成功として返します。
6. 「公式戦はなかった」も、チームが明示して提出したときだけ成立します。

取得しただけでは提出にも確認済みにもなりません。

## 義務の意味

必須なのは、対象年が設定されたときの未提出が見えることです。試合、チャット、サイト、アカウントは止めません。

`official_result_policy` の初期値は対象年なし、期限なし、`enforcement = status_only` だけです。期限の日付はこのコードに書いていません。対象年を決めるのは、方針が決まってから管理者がこの1行を更新する作業です。画面に更新ボタンはありません。

## 権限

新しい関数に `security definer` はありません。RLS はチームの所有者と、上の役割だけに開きます。`user_metadata` は見ていません。ブラウザに service role は置いていません。ビューは増やしていません。

マイグレーションは `supabase/migrations/20261105214326_annual_official_results.sql` です。未適用です。

## 環境変数

新しい名前はありません。既存の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を、ログイン中のユーザーとして使います。

## 適用

1. マイグレーションをレビューする。
2. 本番ではないデータベースで適用結果を見る。
3. 問題がなければ、そのとき選んだ手順で本番に適用する。このPRは適用しません。
4. アプリをデプロイする。テーブルが無い間、画面は「未適用」と出します。

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

## まだ人が決めること

- 対象年を暦年にするか、シーズンにするか
- 期限の月日
- 未提出を、止める以外のどの強さで知らせるか
- 提出後に訂正を再開できるか

## 確認できたことと、できていないこと

単体テストと、空の PostgreSQL 16 にマイグレーションだけを入れた権限チェックは通りました。本番の Supabase では SQL を実行していません。公開ページの取得は、指定URLに対するサーバ取得までで、検索エンジン連携はありません。
