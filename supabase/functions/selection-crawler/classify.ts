import type { SelectionSource } from "./types.ts";
import {
  isBlockedFile,
  isBlockedPath,
  isInstagramUrl,
  isPdfUrl,
  isSitemapUrl,
  looksLikeArticleUrl,
} from "./url.ts";

function countMatches(text: string, words: string[]) {
  let count = 0;

  for (const word of words) {
    if (text.includes(word)) count += 1;
  }

  return count;
}

const STRONG_SELECTION_WORDS = [
  "セレクション",
  "追加セレクション",
  "最終セレクション",
  "一次セレクション",
  "二次セレクション",
  "三次セレクション",
  "GKセレクション",
  "FPセレクション",
  "ゴールキーパーセレクション",
  "入団セレクション",
  "選考会",
  "入団選考会",
  "トライアウト",
  "tryout",
  "selection",
];

const RECRUIT_INTENT_WORDS = [
  ...STRONG_SELECTION_WORDS,
  "練習会",
  "合同練習会",
  "練習参加",
  "体験練習",
  "体験練習会",
  "体験会",
  "無料体験会",
  "セレクション練習会",
  "GK練習会",
  "選手募集",
  "参加者募集",
  "部員募集",
  "団員募集",
  "メンバー募集",
  "クラブ生募集",
  "アカデミー生募集",
  "ジュニアユース募集",
  "ユース募集",
  "GK募集",
  "FP募集",
  "追加募集",
  "新規募集",
  "募集開始",
  "募集案内",
  "募集について",
  "募集のお知らせ",
  "新入団",
  "入団",
  "入団募集",
  "加入",
  "加入募集",
  "新年度",
  "新中1",
  "現小学6年生",
  "現小6",
  "新小学6年生",
  "次年度",
  "活動希望選手",
  "活動希望者",
  "来年度入団希望",
  "入団希望者",
  "所属希望者",
  "セレクション実施",
  "実施要項",
  "募集要項",
];

const TARGET_WORDS = [
  "小学",
  "小学生",
  "新小学",
  "現小学",
  "新小",
  "現小",
  "中学",
  "中学生",
  "新中",
  "現中",
  "高校",
  "高校生",
  "U6",
  "U7",
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U-6",
  "U-7",
  "U-8",
  "U-9",
  "U-10",
  "U-11",
  "U-12",
  "U-13",
  "U-14",
  "U-15",
  "U-16",
  "U-17",
  "U-18",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "アカデミー",
  "スクール",
  "GK",
  "ＧＫ",
  "ゴールキーパー",
  "女子",
  "レディース",
  "ガールズ",
];

const PLAYER_CONTEXT_WORDS = [
  "入団",
  "加入",
  "新入団",
  "現小学",
  "現小",
  "新中",
  "現中",
  "FP",
  "GK",
  "ＧＫ",
  "ゴールキーパー",
  "セレクション",
  "練習会",
  "体験練習",
  "ジュニアユース",
  "ユース",
  "アカデミー",
  "スクール",
  "U-13",
  "U13",
  "U-15",
  "U15",
];

const SCHEDULE_WORDS = [
  "開催日",
  "実施日",
  "日時",
  "日程",
  "開催日時",
  "開催",
  "実施",
  "時間",
  "受付",
  "受付開始",
  "受付時間",
  "集合",
];

const APPLICATION_WORDS = [
  "申込",
  "申し込み",
  "応募",
  "エントリー",
  "応募フォーム",
  "申込フォーム",
  "専用フォーム",
  "Googleフォーム",
  "フォーム",
  "応募方法",
  "申込方法",
  "受付",
  "受付中",
  "締切",
  "締め切り",
  "応募締切",
  "申込締切",
  "先着",
];

const VENUE_WORDS = [
  "会場",
  "場所",
  "開催場所",
  "実施場所",
  "グラウンド",
  "ピッチ",
  "コート",
  "人工芝",
  "天然芝",
  "アクセス",
  "住所",
];

const DETAIL_WORDS = [
  "対象",
  "対象者",
  "募集対象",
  "参加対象",
  "定員",
  "参加費",
  "費用",
  "料金",
  "持ち物",
  "内容",
  "参加条件",
  "受験資格",
  "募集人数",
  "合格",
  "合否",
  "雨天",
  "中止",
];

const NEGATIVE_WORDS = [
  "試合結果",
  "試合情報",
  "MATCHDAY",
  "マッチデー",
  "観戦",
  "チケット",
  "ファンクラブ",
  "CLUB.T",
  "シーズンパスポート",
  "夢パス",
  "パートナー",
  "スポンサー",
  "ホームタウン",
  "イベント情報",
  "イベント開催",
  "グッズ",
  "オンラインショップ",
  "スタッフ募集",
  "アルバイト募集",
  "求人",
  "採用",
  "ボランティア",
  "サポーター",
  "リーグ戦",
  "大会結果",
  "活動報告",
  "レポート",
  "キャンペーン",
  "年間チケット",
  "フェス",
  "フェスティバル",
  "ビーチクリーン",
  "社会貢献",
  "social_action",
  "プロジェクト",
  "作文募集",
];

const HARD_BLOCK_PATH_WORDS = [
  "/about",
  "/club",
  "/company",
  "/concept",
  "/profile",
  "/partner",
  "/partners",
  "/sponsor",
  "/sponsors",
  "/social",
  "/social_action",
  "/respect",
  "/sdgs",
  "/staff",
  "/coach",
  "/coaches",
  "/recruit/staff",
  "/staff-recruit",
  "/goods",
  "/shop",
  "/ticket",
  "/fanclub",
  "/match",
  "/game",
  "/result",
  "/results",
  "/event",
  "/events",
];

const SELECTION_URL_WORDS = [
  "selection",
  "tryout",
  "trial",
  "recruit",
  "join",
  "entry",
  "academy-recruit",
  "player-recruit",
  "taiken",
  "experience",
  "open-training",
  "renshukai",
  "boshu",
  "nyudan",
  "u13",
  "u-13",
  "u15",
  "u-15",
];

function normalizeText(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function buildImportantText(
  pageTitle: string,
  rawText: string,
  sourceName = "",
) {
  const title = normalizeText(`${sourceName} ${pageTitle}`);
  const body = normalizeText(rawText);
  const keywordWindows: string[] = [];

  const keywords = [
    ...STRONG_SELECTION_WORDS,
    "募集",
    "申込",
    "応募",
    "エントリー",
    "スクール",
    "アカデミー",
    "U-15",
    "U-18",
    "U-12",
    "ジュニアユース",
    "ユース",
  ];

  for (const keyword of keywords) {
    const index = body.indexOf(keyword);

    if (index >= 0) {
      keywordWindows.push(
        body.slice(Math.max(0, index - 350), index + 1500),
      );
    }
  }

  return normalizeText(
    `${title} ${body.slice(0, 3000)} ${keywordWindows.join(" ")}`,
  );
}

function isHttpErrorPage(pageTitle: string, rawText: string) {
  const text = `${pageTitle} ${rawText}`.toLowerCase();

  return (
    text.includes("404 not found") ||
    text.includes("403 forbidden") ||
    text.includes("not found") ||
    text.includes("forbidden") ||
    pageTitle.includes("404") ||
    pageTitle.includes("403") ||
    pageTitle.includes("ページエラー") ||
    pageTitle.includes("お探しのページは見つかりません") ||
    pageTitle.includes("ページが見つかりません")
  );
}

function isTopTitle(pageTitle: string) {
  const title = normalizeText(pageTitle).toLowerCase();

  return (
    title.includes(" top") ||
    title.endsWith("top") ||
    title.includes("トップ") ||
    title.includes("ホーム")
  );
}

function isStrongArticleUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    /\/news\/\d+/.test(lower) ||
    /\/info\/\d+/.test(lower) ||
    /\/topics\/\d+/.test(lower) ||
    /\/academy\/news\/\d+/.test(lower) ||
    /\/academy\/info\/\d+/.test(lower) ||
    /\/academy\/topics\/\d+/.test(lower) ||
    /\/\d{5,}\/?$/.test(lower) ||
    /[?&]p=\d+/.test(lower)
  );
}

function hasOldYearOnly(text: string) {
  const currentYear = new Date().getFullYear();

  const years = Array.from(text.matchAll(/20\d{2}/g)).map((m) =>
    Number(m[0])
  );

  if (years.length === 0) return false;

  return Math.max(...years) < currentYear - 2;
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

function hasDateContext(text: string) {
  return (
    /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(text) ||
    /\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{1,2}\/\d{1,2}/.test(text)
  );
}

function isIndexLikeUrl(url: string) {
  const lower = url.toLowerCase();

  return (
    lower.includes("/category/") ||
    lower.includes("/tag/") ||
    lower.includes("/page/")
  );
}

function isTeamCategoryUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    lower.endsWith("/academy/") ||
    lower.endsWith("/school/") ||
    lower.endsWith("/junior/") ||
    lower.endsWith("/junioryouth/") ||
    lower.endsWith("/junior-youth/") ||
    lower.endsWith("/youth/") ||
    lower.endsWith("/academy/junior/") ||
    lower.endsWith("/academy/junioryouth/") ||
    lower.endsWith("/academy/junior-youth/") ||
    lower.endsWith("/academy/youth/") ||
    lower.endsWith("/academy/ladies/")
  );
}

function isHardBlockedUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return HARD_BLOCK_PATH_WORDS.some((word) => lower.includes(word));
}

function isSelectionLikeUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  if (SELECTION_URL_WORDS.some((word) => lower.includes(word))) {
    return true;
  }

  if (isStrongArticleUrl(lower)) return true;

  return (
    lower.includes("/news/") ||
    lower.includes("/academy/news/") ||
    lower.includes("/information/") ||
    lower.includes("/topics/") ||
    lower.includes("/info/")
  );
}

function isGoodDetailUrl(url: string) {
  if (isPdfUrl(url)) return true;
  if (isStrongArticleUrl(url)) return true;
  if (isHardBlockedUrl(url)) return false;

  return isSelectionLikeUrl(url) || looksLikeArticleUrl(url) || isTeamCategoryUrl(url);
}

export function getSelectionKeywordStats(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName?: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName = "" } = params;

  const titleText = normalizeText(`${sourceName} ${pageTitle}`);

  const importantText = buildImportantText(
    pageTitle,
    rawText,
    sourceName,
  );

  const lowerImportantText = importantText.toLowerCase();

  const strongCount =
    countMatches(importantText, STRONG_SELECTION_WORDS) +
    countMatches(lowerImportantText, ["selection", "tryout", "trial"]);

  const recruitCount = countMatches(
    importantText,
    RECRUIT_INTENT_WORDS,
  );

  const targetCount = countMatches(importantText, TARGET_WORDS);

  const playerCount = countMatches(
    importantText,
    PLAYER_CONTEXT_WORDS,
  );

  const scheduleCount = countMatches(
    importantText,
    SCHEDULE_WORDS,
  );

  const applicationCount = countMatches(
    importantText,
    APPLICATION_WORDS,
  );

  const venueCount = countMatches(
    importantText,
    VENUE_WORDS,
  );

  const detailCount = countMatches(
    importantText,
    DETAIL_WORDS,
  );

  const titleStrongCount =
    countMatches(titleText, STRONG_SELECTION_WORDS) +
    countMatches(titleText.toLowerCase(), [
      "selection",
      "tryout",
      "trial",
    ]);

  const titleRecruitCount = countMatches(
    titleText,
    RECRUIT_INTENT_WORDS,
  );

  const negativeCount = countMatches(
    `${titleText} ${importantText}`,
    NEGATIVE_WORDS,
  );

  const keywordCount =
    titleStrongCount * 10 +
    titleRecruitCount * 5 +
    strongCount * 4 +
    recruitCount * 2 +
    targetCount +
    playerCount +
    scheduleCount +
    applicationCount +
    venueCount +
    detailCount;

  return {
    keywordCount,
    strongCount,
    recruitCount,
    targetCount,
    playerCount,
    scheduleCount,
    applicationCount,
    venueCount,
    detailCount,
    negativeCount,
    titleStrongCount,
    titleRecruitCount,
    hasDate: hasDateContext(importantText),
    hasEnded: hasEndedText(importantText),
    hasOldYearOnly: hasOldYearOnly(
      `${pageTitle} ${importantText.slice(0, 5000)}`,
    ),
    isHttpErrorPage: isHttpErrorPage(pageTitle, rawText),
    isGoodDetailUrl: isGoodDetailUrl(pageUrl),
    isSelectionLikeUrl: isSelectionLikeUrl(pageUrl),
    isStrongArticleUrl: isStrongArticleUrl(pageUrl),
    isIndexLikeUrl: isIndexLikeUrl(pageUrl),
    isTeamCategoryUrl: isTeamCategoryUrl(pageUrl),
    isHardBlockedUrl: isHardBlockedUrl(pageUrl),
    isTopTitle: isTopTitle(pageTitle),
  };
}

export function shouldExtractExternalLinks(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  if (isHttpErrorPage(params.pageTitle, params.rawText)) {
    return false;
  }

  const stats = getSelectionKeywordStats(params);

  return (
    stats.strongCount >= 1 ||
    stats.recruitCount >= 2 ||
    params.rawText.includes("詳しくはこちら") ||
    params.rawText.includes("詳細はこちら") ||
    params.rawText.includes("お申し込み") ||
    params.rawText.includes("申込")
  );
}

export function isTargetPage(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName } = params;

  if (isHttpErrorPage(pageTitle, rawText)) return false;
  if (isInstagramUrl(pageUrl)) return false;
  if (isSitemapUrl(pageUrl)) return false;

  if (!isPdfUrl(pageUrl) && isBlockedFile(pageUrl)) {
    return false;
  }

  if (!isPdfUrl(pageUrl) && isBlockedPath(pageUrl)) {
    return false;
  }

  const stats = getSelectionKeywordStats({
    rawText,
    pageTitle,
    pageUrl,
    sourceName,
  });

  if (stats.isTopTitle && !stats.isStrongArticleUrl && !stats.isTeamCategoryUrl) {
    return false;
  }

  if (stats.isIndexLikeUrl) {
    return false;
  }

  if (stats.isHardBlockedUrl && !stats.isStrongArticleUrl) {
    return false;
  }

  if (stats.hasOldYearOnly && stats.titleStrongCount === 0 && stats.strongCount === 0) {
    return false;
  }

  if (stats.hasEnded && stats.strongCount === 0) {
    return false;
  }

  if (
    stats.negativeCount >= 2 &&
    stats.strongCount === 0 &&
    stats.recruitCount === 0
  ) {
    return false;
  }

  if (stats.titleStrongCount >= 1) {
    return true;
  }

  if (
    stats.strongCount >= 1 &&
    (
      stats.recruitCount >= 1 ||
      stats.keywordCount >= 18 ||
      stats.isTeamCategoryUrl
    )
  ) {
    return true;
  }

  if (
    stats.recruitCount >= 2 &&
    (
      stats.targetCount >= 1 ||
      stats.playerCount >= 1 ||
      stats.isTeamCategoryUrl
    )
  ) {
    return true;
  }

  if (
    stats.keywordCount >= 18 &&
    stats.isTeamCategoryUrl
  ) {
    return true;
  }

  if (
    stats.keywordCount >= 24 &&
    (
      stats.isStrongArticleUrl ||
      stats.isSelectionLikeUrl ||
      stats.isGoodDetailUrl
    )
  ) {
    return true;
  }

  if (
    isPdfUrl(pageUrl) &&
    stats.recruitCount >= 1 &&
    stats.targetCount >= 1
  ) {
    return true;
  }

  return false;
}

export function getPagePriority(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
}) {
  const stats = getSelectionKeywordStats(params);

  if (stats.isHttpErrorPage) {
    return {
      priority: -999,
      reason: "http_error_page",
      keywordCount: 0,
    };
  }

  if (
    stats.hasOldYearOnly &&
    stats.titleStrongCount === 0 &&
    stats.strongCount === 0
  ) {
    return {
      priority: -999,
      reason: "old_year_only",
      keywordCount: stats.keywordCount,
    };
  }

  if (stats.isIndexLikeUrl) {
    return {
      priority: -999,
      reason: "index_like_url",
      keywordCount: stats.keywordCount,
    };
  }

  if (
    stats.negativeCount >= 2 &&
    stats.strongCount === 0 &&
    stats.recruitCount === 0
  ) {
    return {
      priority: -999,
      reason: "negative_context",
      keywordCount: stats.keywordCount,
    };
  }

  return {
    priority: stats.keywordCount,
    reason: "keyword_count",
    keywordCount: stats.keywordCount,
  };
}

export function buildSelectionDescription(params: {
  rawText: string;
  pageTitle: string;
  maxLength?: number;
}) {
  const { rawText, pageTitle, maxLength = 160 } = params;

  const title = normalizeText(pageTitle);

  const body = normalizeText(rawText)
    .replace(title, "")
    .replace(/メニュー|MENU|トップ|HOME|ニュース|NEWS/g, "")
    .trim();

  const base = title ? `${title}｜${body}` : body;

  if (base.length <= maxLength) return base;

  return `${base.slice(0, maxLength).trim()}…`;
}

export function normalizeSourceRank(
  source: SelectionSource,
  rawText: string,
) {
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

  if (
    text.includes("スクール") ||
    text.includes("アカデミー")
  ) {
    return "スクール";
  }

  return "その他";
}