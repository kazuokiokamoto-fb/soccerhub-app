export const ERROR_TEXT: Record<string, string> = {
  unauthorized: "ログインが必要です。",
  not_manager: "このチームの管理者またはコーチだけが報告できます。",
  not_found: "対象が見つかりません。",
  schema_unavailable: "年次報告のテーブルはまだデータベースに適用されていません。",
  validation: "入力を確認してください。選手個人の情報は入れられません。",
  rate_limited: "公開ページの取得は、チームごとに1時間8回までです。",
  unsafe_url: "公開の https ページ以外は取得できません。",
  fetch_failed: "ページは取得できませんでした。候補は作っていません。",
  too_large: "ページが大きすぎたため、本文は保存していません。",
  unsupported_type: "HTMLまたはテキスト以外だったため、本文は保存していません。",
  timeout: "取得が時間内に終わりませんでした。",
  version_conflict: "別の保存が先に完了しました。読み込み直してください。",
  already_submitted_differs: "すでに別の内容で提出されています。確認者は変わっていません。",
  outcome_required: "提出するには、結果ありか公式戦なしかを選んでください。",
  lines_required: "結果ありで提出するには、報告に含める行が1つ必要です。",
  lines_forbidden: "公式戦なしで提出するには、含める行を外してください。",
  submitted: "提出済みの報告は変更できません。",
  read_failed: "読み込みに失敗しました。",
  write_failed: "保存に失敗しました。",
};

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? "処理できませんでした。";
}

export const EXTENT_TEXT: Record<string, string> = {
  manual_url_only: "URLを記録しただけで、ページはまだ取得していません。",
  page_fetched: "指定された公開URLを取得しました。自動検索ではありません。",
  fetch_failed: "取得に失敗しました。得点は作っていません。",
  no_automatic_search: "インターネット全体は検索していません。",
};

export const CONFIDENCE_TEXT: Record<string, string> = {
  not_evaluated: "照合していません。",
  team_and_year_seen: "ページ内にチーム名と対象年が見つかりました。",
  team_or_year_missing: "チーム名または対象年を確認できなかったため、得点は候補にしていません。",
  no_explicit_results: "チーム名と対象年は見ましたが、明示されたスコア行はありませんでした。",
};

export const STATE_TEXT: Record<string, string> = {
  draft: "下書き",
  in_review: "確認中",
  submitted: "提出済み",
};

export const OBLIGATION_TEXT: Record<string, string> = {
  year_unset: "対象年は未設定です。期限も未設定です。",
  not_started: "この年の報告はまだありません。",
  draft: "下書きのままです。提出されていません。",
  in_review: "確認中です。まだ提出されていません。",
  submitted_results: "チームが結果ありで提出済みです。",
  submitted_none: "チームが公式戦なしで提出済みです。",
};
