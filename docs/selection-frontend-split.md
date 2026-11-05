# セレクション画面の分割（準備のみ）

公開 URL は `https://www.sakamatch.com/selection` と `https://www.sakamatch.com/selection/[id]` のままです。`selection.sakamatch.com` には分けません。本番の Vercel プロジェクト、DNS、Supabase Auth、RLS、スキーマ、Edge Function、cron、秘密情報はこの変更だけでは動きません。

## ログインは1回

ハブとセレクションは別の Next.js プロセスですが、ブラウザから見えるホストはどちらも `www.sakamatch.com` です。セッションは次で共有します。

- 両方とも `app/lib/supabase.ts` の `createSakamatchBrowserClient` を使う
- サーバーは両方とも `createSharedServerClient` を使う
- `@supabase/ssr` 0.8.0 と `@supabase/supabase-js` 2.93.3
- Cookie 名は `sb-senspqsexmtrwjfsdadv-auth-token`（長いセッションは `.0`, `.1`）
- `cookieOptions` も `storageKey` も渡さない。`Domain` は付けない（ホスト専用のまま）
- `Path=/`、`SameSite=Lax` はライブラリ既定のまま
- セレクションへの移動は、分割が有効なときだけフルページ読み込みにする。別ビルドの RSC 遷移でセッション表示が壊れないようにするため
- ハブはセレクション用リクエストで `getUser()` しない。更新はセレクション側の1回だけ。同じリクエストで二回更新すると refresh token が壊れてログアウトになる
- セッション Cookie がある利用者をハブはログインへ戻さない
- セレクション側がログインへ戻すときは、セレクションのデプロイホストではなくハブのホスト（本番では `www.sakamatch.com`）
- `x-forwarded-host` がセレクション自身の Host と同じときは使わない。ハブ経由の Host だけをログイン先にする

ログアウトは同じ Cookie を消します。セレクションのタブは `SIGNED_OUT` を受けてハブの `/login` へ移ります。

## 構成

| 場所 | 役割 |
| --- | --- |
| リポジトリ直下 | 既存ハブ。`app/selection` は残す |
| `apps/selection` | 独立デプロイする Next.js。画面実装はハブのソースをそのまま描画する |
| `SELECTION_ASSET_PREFIX` = `/selection-static` | セレクションの JS/CSS。ハブの `/_next` とは混ぜない |

`SELECTION_FRONTEND_ROUTING` がちょうど `1` で、かつ `SELECTION_APP_ORIGIN` が検証を通ったビルドだけ、ハブが次を書き換えます。

- `/selection`
- `/selection/:path*`
- `/selection-static/:path*`

それ以外（`/`, `/match`, `/chat`, `/teams`, `/api/cron/selection-crawler` を含む）はハブのままです。フラグが無い、`true` などの別の値、オリジンが空、http、パス付き、`www.sakamatch.com`、`sakamatch.com`、`selection.sakamatch.com`、ハブ自身のホスト、プレースホルダのときは書き換えを出しません。そのビルドは今までどおり `app/selection` を出します。

`basePath` は使いません。マニフェスト、アイコン、`/sw.js` はオリジン直下のままにするためです。

## 環境変数（値は書かない）

### 既存ハブ `soccerhub-app`（scope `kazuokiokamoto-fbs-projects`）

ビルド時に読む。変更したらハブを再デプロイするまで効きません。

| 名前 | いつ |
| --- | --- |
| `SELECTION_FRONTEND_ROUTING` | 有効化するときだけ `1`。それ以外は未設定 |
| `SELECTION_APP_ORIGIN` | セレクションプロジェクトの `https://` オリジン。パス、クエリ、ユーザー情報は付けない |

ダッシュボードに次は置かない。ハブの `next.config.ts` がビルド結果から埋め込みます。手で置くと画面遷移と書き換えがずれます。

- `NEXT_PUBLIC_SELECTION_ZONE_ACTIVE`
- `NEXT_PUBLIC_APP_ZONE`

ハブに既にある Supabase の公開変数はそのままです。`SELECTION_SECRET`、`CRON_SECRET`、service role、Web Push の秘密はセレクション側へコピーしません。

### 新しいプロジェクト（例: `soccerhub-selection`）

Root Directory は `apps/selection`。Framework は Next.js。このアプリは npm workspace なので、依存関係はリポジトリ直下の lockfile から入れます。Install Command は `cd ../.. && npm install`、Build Command は `cd ../.. && npm run build -w soccerhub-selection`。出力の `.next` は `apps/selection` にできます。本番ドメインは付けません。`www.sakamatch.com` も `selection.sakamatch.com` も付けません。

| 名前 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ハブと同じ値 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ハブと同じ値 |
| `NEXT_PUBLIC_HUB_ORIGIN` | ログインの戻り先。本番は `https://www.sakamatch.com`。プレビューで試すときは、そのハブプレビューのオリジン。ビルドに埋め込まれるので、変えたら再デプロイする |

`NEXT_PUBLIC_APP_ZONE` はアプリ設定が `selection` に固定します。上書きしないでください。

Hobby のプロジェクト数にカウントされます。このリポジトリ変更はプロジェクトを作成しません。

## 有効化

1. セレクションプロジェクトを、このブランチ（マージ後は対象コミット）からデプロイする。
2. そのデプロイのオリジンに直接開き、`/selection` がハブの `/login` へ戻ることを見る。セレクションの `*.vercel.app` 上にログイン画面を出さない。
3. 一覧と詳細の HTML が返り、`/selection-static/_next/static/...` の JS が 200 になることを見る。
4. ハブの Production にだけ `SELECTION_FRONTEND_ROUTING=1` と `SELECTION_APP_ORIGIN` を入れる。Preview は空のままにする。
5. ハブを再デプロイする。これで初めて `www.sakamatch.com/selection` がセレクション側へ寄る。
6. 下の確認をしてから、プレビュー用のオリジンを別途足すかを決める。

## 確認

- 未ログインの `/selection` と `/selection/[id]` は、今までどおりハブの `/login?redirect=...` になる
- ハブで一度ログインしたあと、セレ一覧・詳細・通知の `/selection/[id]` でログイン画面がもう一度出ない
- セレクション表示中にトークンが更新されても、ホームやチャットはログイン済みのまま
- どちらかでログアウトすると、もう片方も次の表示では未ログイン。開いたままのセレクションタブは `/login` へ移る
- `/match`、`/chat`、`/teams`、`/api/cron/selection-crawler` のホストは変わらない
- `https://www.sakamatch.com/robots.txt` の disallow は変えない
- サービスワーカーは `/sw.js` のまま。`/selection` を別オリジンに開かない
- 応答がハブとセレクションの間で往復し続けない

## ロールバック

1. ハブの `SELECTION_FRONTEND_ROUTING` を外す（または `1` 以外にする）。
2. ハブを再デプロイする。書き換えが消え、既存の `app/selection` が再び応答する。
3. あるいは、フラグ無しでビルドされたハブのデプロイへ Instant Rollback する。フラグ付きのデプロイへ戻すと分割は続きます。
4. セレクションプロジェクトは残してよい。ハブが書き換えない限り公開トラフィックは来ません。
5. DNS、Cookie の Domain、Supabase Auth、RLS は触っていないので戻すものはありません。

## プレビュー

プレビューのハブは、Production の環境変数を見ません。フラグを Preview に置かない限り、プレビューは既存画面のままです。

試すときは、ハブの Preview にそのブランチのセレクションオリジンを入れ、セレクション側の `NEXT_PUBLIC_HUB_ORIGIN` をそのハブプレビューのオリジンにします。オリジンをハブ自身の URL にするとループ防止で書き換えは出ません。

## ローカル

セレクション:

```bash
# リポジトリ直下
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_HUB_ORIGIN=http://127.0.0.1:3000
npm run dev -w soccerhub-selection
```

ハブ（別ターミナル、リポジトリ直下）:

```bash
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SELECTION_FRONTEND_ROUTING=1
# SELECTION_APP_ORIGIN=http://127.0.0.1:3001
npm run dev
```

`http://127.0.0.1` は Vercel 上では拒否します。本番に http の書き換えは出ません。

## あわせて直したこと

`app/lib/server/patchNodeUrlParse.ts` は web-push が呼ぶ `url.parse` を WHATWG URL に差し替えている。相対パスまで `new URL` に渡すと、そのモジュールを読み込んだ Node プロセスは `/` を含む全リクエストで 500 になる。絶対 URL だけを差し替え、それ以外は Node のパーサに戻す。

## 範囲外

公式戦の年次報告は入れていません。DB も本番も変えていません。

リポジトリ上で分かっている接続点だけ:

- `/results` は「実績登録（あとで）」のプレースホルダ。ログイン必須で、robots も disallow
- チームは `category`、`level`、`strength_rank` を持ち、強さの説明は公式戦の試合強度の目安。結果の台帳ではない
- `TeamSchedule` は練習試合の予定（下書き / 確定）で、シーズン報告ではない
- マイグレーションにあるのはセキュリティ強化だけで、シーズンや公式戦結果のテーブル定義は無い
- 既存クローラはチームサイトとセレクション情報向けで、試合結果の収集ではない

収集した外部情報と、チームが確認した報告は別データにしてください。収集結果を自動で「確認済み」にしない。未提出を理由にアカウントや機能を止めない。その方針は別の決定が要ります。本番スキーマの調査はこの作業では行っていません。
