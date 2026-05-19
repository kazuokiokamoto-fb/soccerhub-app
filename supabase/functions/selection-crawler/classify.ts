import type { SelectionSource } from "./types.ts";
import {
  getUrlDepth,
  isBlockedFile,
  isBlockedPath,
  isInstagramUrl,
  isPdfUrl,
  isSitemapUrl,
  isThinPath,
  looksLikeArticleUrl,
} from "./url.ts";

export function shouldExtractExternalLinks(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName } = params;
  const text = `${sourceName} ${pageTitle} ${rawText}`;

  if (!looksLikeArticleUrl(pageUrl)) return false;

  return (
    text.includes("セレクション") ||
    text.includes("選考会") ||
    text.includes("トライアウト") ||
    text.includes("選手募集") ||
    text.includes("参加者募集") ||
    text.includes("スクール生募集") ||
    text.includes("ジュニアユース募集") ||
    text.includes("ユース募集") ||
    text.includes("練習参加") ||
    text.includes("体験練習") ||
    text.includes("体験練習会") ||
    text.includes("詳しくはこちら") ||
    text.includes("詳細はこちら") ||
    text.includes("お申し込み") ||
    text.includes("申込")
  );
}

export function isTargetPage(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName } = params;

  const text = `${sourceName} ${pageTitle} ${rawText}`;
  const lowerText = text.toLowerCase();

  if (isInstagramUrl(pageUrl)) return false;
  if (isSitemapUrl(pageUrl)) return false;
  if (isBlockedFile(pageUrl)) return false;
  if (!isPdfUrl(pageUrl) && isBlockedPath(pageUrl)) return false;

  const isArticle = isPdfUrl(pageUrl) || looksLikeArticleUrl(pageUrl);

  const hasStrongKeyword =
    text.includes("セレクション") ||
    text.includes("選考会") ||
    text.includes("トライアウト") ||
    text.includes("GKセレクション") ||
    text.includes("ゴールキーパーセレクション") ||
    lowerText.includes("selection") ||
    lowerText.includes("tryout");

  const hasRecruitKeyword =
    text.includes("選手募集") ||
    text.includes("参加者募集") ||
    text.includes("団員募集") ||
    text.includes("部員募集") ||
    text.includes("メンバー募集") ||
    text.includes("クラブ生募集") ||
    text.includes("スクール生募集") ||
    text.includes("ジュニアユース募集") ||
    text.includes("ユース募集") ||
    text.includes("新入団") ||
    text.includes("入団") ||
    text.includes("加入");

  const hasTrainingTrialIntent =
    text.includes("練習参加") ||
    text.includes("体験練習") ||
    text.includes("体験練習会") ||
    text.includes("無料体験会");

  const hasCategoryContext =
    text.includes("U-") ||
    text.includes("Ｕ-") ||
    text.includes("ジュニアユース") ||
    text.includes("ユース") ||
    text.includes("ジュニア") ||
    text.includes("小学生") ||
    text.includes("中学生") ||
    text.includes("新中") ||
    text.includes("小学") ||
    text.includes("中学") ||
    text.includes("高校") ||
    text.includes("年長") ||
    text.includes("年中");

  const hasApplicationContext =
    text.includes("申込") ||
    text.includes("申し込み") ||
    text.includes("応募") ||
    text.includes("エントリー") ||
    text.includes("フォーム") ||
    text.includes("締切") ||
    text.includes("募集");

  const hasDate =
    /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(text) ||
    /\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{1,2}\/\d{1,2}/.test(text);

  if (hasStrongKeyword && isArticle) return true;

  if (
    hasRecruitKeyword &&
    hasCategoryContext &&
    (isArticle || hasDate || hasApplicationContext)
  ) {
    return true;
  }

  if (
    hasTrainingTrialIntent &&
    hasCategoryContext &&
    (isArticle || hasDate || hasApplicationContext)
  ) {
    return true;
  }

  if (isPdfUrl(pageUrl) && (hasStrongKeyword || hasRecruitKeyword)) return true;

  return false;
}

export function getPagePriority(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
}) {
  const { rawText, pageTitle, pageUrl } = params;

  const text = `${pageTitle} ${rawText}`;

  let score = 0;
  let reason = "general";

  if (looksLikeArticleUrl(pageUrl)) {
    score += 60;
    reason = "article_url";
  }

  if (isPdfUrl(pageUrl)) {
    score += 50;
    reason = "pdf";
  }

  if (
    text.includes("セレクション") ||
    text.includes("選考会") ||
    text.includes("トライアウト") ||
    text.includes("GKセレクション") ||
    text.includes("ゴールキーパーセレクション")
  ) {
    score += 40;
    reason = "selection_keyword";
  }

  if (
    text.includes("選手募集") ||
    text.includes("参加者募集") ||
    text.includes("ジュニアユース募集") ||
    text.includes("ユース募集")
  ) {
    score += 25;
    reason = "recruit_keyword";
  }

  if (
    /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(text) ||
    /\d{1,2}月\d{1,2}日/.test(text)
  ) {
    score += 20;
  }

  if (
    text.includes("U-") ||
    text.includes("ジュニアユース") ||
    text.includes("ユース") ||
    text.includes("小学生") ||
    text.includes("中学生")
  ) {
    score += 10;
  }

  score += Math.min(getUrlDepth(pageUrl) * 5, 20);

  if (isThinPath(pageUrl)) {
    score -= 100;
    reason = "thin_path";
  }

  return {
    priority: score,
    reason,
  };
}

export function normalizeSourceRank(source: SelectionSource, rawText: string) {
  const text = `${source.name} ${rawText}`;
  const current = source.source_rank;

  if (current) return current;

  if (source.organization_type === "j_club") return "J下部";
  if (text.includes("Jリーグ") || text.includes("J下部")) return "J下部";
  if (text.includes("T1")) return "T1";
  if (text.includes("T2")) return "T2";
  if (text.includes("T3")) return "T3";
  if (text.includes("T4")) return "T4";
  if (text.includes("東京都1部") || text.includes("都1部")) return "県1部";
  if (text.includes("東京都2部") || text.includes("都2部")) return "県2部";
  if (text.includes("東京都3部") || text.includes("都3部")) return "県3部";
  if (text.includes("GKスクール")) return "GKスクール";
  if (text.includes("スクール")) return "サッカースクール";
  if (text.includes("少年団")) return "少年団";
  if (text.includes("女子") || text.includes("レディース")) return "女子クラブ";

  return "地域クラブ";
}