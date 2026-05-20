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

function getCurrentYears() {
  const year = new Date().getFullYear();

  return [
    String(year),
    String(year + 1),
    `${year}年`,
    `${year + 1}年`,
    `${year}年度`,
    `${year + 1}年度`,
  ];
}

function includesCurrentOrNextYear(text: string) {
  return getCurrentYears().some((value) => text.includes(value));
}

function hasOldYearOnly(text: string) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(text.matchAll(/20\d{2}/g)).map((m) => Number(m[0]));

  if (years.length === 0) return false;

  const hasCurrentOrFuture = years.some((y) => y >= currentYear);
  const hasOld = years.some((y) => y < currentYear);

  return hasOld && !hasCurrentOrFuture;
}

function hasEndedText(text: string) {
  return (
    text.includes("募集終了") ||
    text.includes("受付終了") ||
    text.includes("申込終了") ||
    text.includes("応募終了") ||
    text.includes("終了しました") ||
    text.includes("締め切りました")
  );
}

function hasSelectionIntent(text: string, lowerText: string) {
  return (
    text.includes("セレクション") ||
    text.includes("選考会") ||
    text.includes("トライアウト") ||
    text.includes("GKセレクション") ||
    text.includes("ゴールキーパーセレクション") ||
    lowerText.includes("selection") ||
    lowerText.includes("tryout") ||
    lowerText.includes("trial")
  );
}

function hasRecruitIntent(text: string) {
  return (
    text.includes("選手募集") ||
    text.includes("参加者募集") ||
    text.includes("団員募集") ||
    text.includes("部員募集") ||
    text.includes("メンバー募集") ||
    text.includes("クラブ生募集") ||
    text.includes("スクール生募集") ||
    text.includes("アカデミー生募集") ||
    text.includes("ジュニアユース募集") ||
    text.includes("ユース募集") ||
    text.includes("GK募集") ||
    text.includes("新入団") ||
    text.includes("入団") ||
    text.includes("加入") ||
    text.includes("新年度")
  );
}

function hasTrainingIntent(text: string) {
  return (
    text.includes("体験会") ||
    text.includes("練習会") ||
    text.includes("練習参加") ||
    text.includes("体験練習") ||
    text.includes("体験練習会") ||
    text.includes("無料体験会")
  );
}

function hasCategoryContext(text: string) {
  return (
    text.includes("U-") ||
    text.includes("Ｕ-") ||
    text.includes("U13") ||
    text.includes("U15") ||
    text.includes("ジュニアユース") ||
    text.includes("ユース") ||
    text.includes("ジュニア") ||
    text.includes("アカデミー") ||
    text.includes("スクール") ||
    text.includes("小学生") ||
    text.includes("中学生") ||
    text.includes("高校生") ||
    text.includes("新中") ||
    text.includes("現小") ||
    text.includes("小学") ||
    text.includes("中学") ||
    text.includes("高校") ||
    text.includes("年長") ||
    text.includes("年中") ||
    text.includes("GK") ||
    text.includes("ゴールキーパー")
  );
}

function hasApplicationContext(text: string) {
  return (
    text.includes("申込") ||
    text.includes("申し込み") ||
    text.includes("応募") ||
    text.includes("エントリー") ||
    text.includes("フォーム") ||
    text.includes("締切")
  );
}

function hasDateContext(text: string) {
  return (
    /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(text) ||
    /\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{1,2}\/\d{1,2}/.test(text) ||
    includesCurrentOrNextYear(text)
  );
}

export function shouldExtractExternalLinks(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName } = params;
  const text = `${sourceName} ${pageTitle} ${rawText}`;
  const lowerText = text.toLowerCase();

  if (!looksLikeArticleUrl(pageUrl)) return false;

  return (
    hasSelectionIntent(text, lowerText) ||
    hasRecruitIntent(text) ||
    hasTrainingIntent(text) ||
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

  if (hasOldYearOnly(text)) return false;

  const isArticle = isPdfUrl(pageUrl) || looksLikeArticleUrl(pageUrl);

  const selectionIntent = hasSelectionIntent(text, lowerText);
  const recruitIntent = hasRecruitIntent(text);
  const trainingIntent = hasTrainingIntent(text);
  const categoryContext = hasCategoryContext(text);
  const applicationContext = hasApplicationContext(text);
  const dateContext = hasDateContext(text);

  if (selectionIntent && (isArticle || dateContext || applicationContext)) {
    return true;
  }

  if (
    recruitIntent &&
    categoryContext &&
    (isArticle || dateContext || applicationContext)
  ) {
    return true;
  }

  if (
    trainingIntent &&
    categoryContext &&
    (isArticle || dateContext || applicationContext)
  ) {
    return true;
  }

  if (
    text.includes("募集") &&
    categoryContext &&
    applicationContext &&
    dateContext &&
    isArticle
  ) {
    return true;
  }

  if (isPdfUrl(pageUrl) && (selectionIntent || recruitIntent || trainingIntent)) {
    return true;
  }

  return false;
}

export function getPagePriority(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
}) {
  const { rawText, pageTitle, pageUrl } = params;

  const text = `${pageTitle} ${rawText}`;
  const lowerText = text.toLowerCase();

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

  if (hasSelectionIntent(text, lowerText)) {
    score += 50;
    reason = "selection_keyword";
  }

  if (hasRecruitIntent(text)) {
    score += 35;
    reason = "recruit_keyword";
  }

  if (hasTrainingIntent(text)) {
    score += 30;
    reason = "training_keyword";
  }

  if (
    text.includes("募集") &&
    hasCategoryContext(text) &&
    hasApplicationContext(text)
  ) {
    score += 10;
    reason = "broad_recruit_keyword";
  }

  if (hasDateContext(text)) score += 20;
  if (hasCategoryContext(text)) score += 15;
  if (hasApplicationContext(text)) score += 15;

  if (hasOldYearOnly(text)) {
    score -= 120;
    reason = "old_year_only";
  }

  if (hasEndedText(text)) {
    score -= 80;
    reason = "ended_text";
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

  if (text.includes("Jリーグ") || text.includes("J下部")) {
    return "J下部";
  }

  if (text.includes("T1") || text.includes("1部")) {
    return "T1 / 1部";
  }

  if (text.includes("T2") || text.includes("2部")) {
    return "T2 / 2部";
  }

  if (text.includes("T3") || text.includes("3部")) {
    return "T3 / 3部";
  }

  if (text.includes("T4") || text.includes("4部")) {
    return "T4 / 4部";
  }

  if (
    text.includes("地区リーグ") ||
    text.includes("県リーグ") ||
    text.includes("地域リーグ")
  ) {
    return "地区リーグ";
  }

  if (
    text.includes("女子") ||
    text.includes("レディース") ||
    text.includes("ガールズ")
  ) {
    return "女子";
  }

  if (text.includes("スクール") || text.includes("アカデミー")) {
    return "スクール";
  }

  return "その他";
}