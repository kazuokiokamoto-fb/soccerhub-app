import type { SelectionSource } from "./types.ts";
import {
  isBlockedFile,
  isBlockedPath,
  isInstagramUrl,
  isPdfUrl,
  isSitemapUrl,
  looksLikeArticleUrl,
} from "./url.ts";

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

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
  "入会セレクション",
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
  "練習体験",
  "体験会",
  "無料体験",
  "無料体験会",
  "セレクション練習会",
  "トレーニング体験",
  "GK練習会",
  "open training",
  "選手募集",
  "参加者募集",
  "部員募集",
  "団員募集",
  "メンバー募集",
  "クラブ生募集",
  "アカデミー生募集",
  "ジュニアユース募集",
  "ユース募集",
  "ゴールキーパー募集",
  "GK募集",
  "FP募集",
  "育成選手募集",
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
  "入会",
  "入会受付",
  "入会案内",
  "新年度",
  "新中1",
  "現小学6年生",
  "現小6",
  "新小学6年生",
  "次年度",
  "活動希望選手",
  "活動希望者",
  "希望選手",
  "来年度入団希望",
  "入団希望者",
  "所属希望者",
  "セレクション実施",
  "実施要項",
  "募集要項",
];

const TARGET_WORDS = [
  "年長",
  "年中",
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
  "スペシャルクラス",
  "GK",
  "ＧＫ",
  "ゴールキーパー",
  "キーパー",
  "女子",
  "女子選手",
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
  "スケジュール",
  "開催日時",
  "開催",
  "実施",
  "時間",
  "開始",
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
  "パートナー",
  "スポンサー",
  "ホームタウン",
  "イベント情報",
  "イベント開催",
  "グッズ",
  "オンラインショップ",
  "スクールコーチ",
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
  "クリニック",
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
  "member",
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
  return text.replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

function isTopTitle(pageTitle: string) {
  const title = normalizeText(pageTitle).toLowerCase();

  return (
    title.includes(" top") ||
    title.endsWith("top") ||
    title.includes("トップ") ||
    title.includes("top｜") ||
    title.includes("top |")
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
    /\/academy\/topics\/\d+/.test(lower)
  );
}

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
  return Math.max(...years) < currentYear;
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
    /\d{1,2}\/\d{1,2}/.test(text) ||
    includesCurrentOrNextYear(text)
  );
}

function isIndexLikeUrl(url: string) {
  const lower = url.toLowerCase();
  const normalized = lower.endsWith("/") ? lower : `${lower}/`;

  try {
    const u = new URL(normalized);
    const path = u.pathname;

    if (
      path === "/" ||
      path === "/news/" ||
      path === "/info/" ||
      path === "/information/" ||
      path === "/topics/" ||
      path === "/academy/" ||
      path === "/school/" ||
      path === "/junior/" ||
      path === "/junior-youth/" ||
      path === "/youth/" ||
      path === "/event/" ||
      path === "/events/"
    ) {
      return true;
    }
  } catch {
    // ignore
  }

  return (
    normalized.includes("/category/") ||
    normalized.includes("/tag/") ||
    normalized.includes("/page/")
  );
}

function isHardBlockedUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());
  return HARD_BLOCK_PATH_WORDS.some((word) => lower.includes(word));
}

function isSelectionLikeUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  if (SELECTION_URL_WORDS.some((word) => lower.includes(word))) return true;
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
  if (isIndexLikeUrl(url)) return false;
  if (isHardBlockedUrl(url)) return false;

  return isSelectionLikeUrl(url) || looksLikeArticleUrl(url);
}

export function getSelectionKeywordStats(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName?: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName = "" } = params;

  const titleText = normalizeText(`${sourceName} ${pageTitle}`);
  const bodyText = normalizeText(rawText);
  const allText = `${titleText} ${bodyText}`;
  const lowerAllText = allText.toLowerCase();

  const strongCount =
    countMatches(allText, STRONG_SELECTION_WORDS) +
    countMatches(lowerAllText, ["selection", "tryout", "trial"]);

  const recruitCount = countMatches(allText, RECRUIT_INTENT_WORDS);
  const targetCount = countMatches(allText, TARGET_WORDS);
  const playerCount = countMatches(allText, PLAYER_CONTEXT_WORDS);
  const scheduleCount = countMatches(allText, SCHEDULE_WORDS);
  const applicationCount = countMatches(allText, APPLICATION_WORDS);
  const venueCount = countMatches(allText, VENUE_WORDS);
  const detailCount = countMatches(allText, DETAIL_WORDS);
  const negativeCount = countMatches(allText, NEGATIVE_WORDS);

  const titleStrongCount =
    countMatches(titleText, STRONG_SELECTION_WORDS) +
    countMatches(titleText.toLowerCase(), ["selection", "tryout", "trial"]);

  const titleRecruitCount = countMatches(titleText, RECRUIT_INTENT_WORDS);

  const keywordCount =
    strongCount * 3 +
    recruitCount * 2 +
    targetCount +
    playerCount +
    scheduleCount +
    applicationCount +
    venueCount +
    detailCount +
    titleStrongCount * 4 +
    titleRecruitCount * 3;

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
    hasDate: hasDateContext(allText),
    hasEnded: hasEndedText(allText),
    hasOldYearOnly: hasOldYearOnly(`${pageTitle} ${rawText.slice(0, 2500)}`),
    isGoodDetailUrl: isGoodDetailUrl(pageUrl),
    isSelectionLikeUrl: isSelectionLikeUrl(pageUrl),
    isStrongArticleUrl: isStrongArticleUrl(pageUrl),
    isIndexLikeUrl: isIndexLikeUrl(pageUrl),
    isHardBlockedUrl: isHardBlockedUrl(pageUrl),
    isTopTitle: isTopTitle(pageTitle),
  };
}

export function isSelectionDetailPage(text: string) {
  const stats = getSelectionKeywordStats({
    rawText: text,
    pageTitle: "",
    pageUrl: "https://example.com/news/00000000/",
  });

  return (
    stats.recruitCount >= 1 &&
    (stats.scheduleCount >= 1 || stats.applicationCount >= 1 || stats.hasDate) &&
    (stats.targetCount >= 1 || stats.playerCount >= 1) &&
    (stats.venueCount >= 1 ||
      stats.detailCount >= 1 ||
      stats.applicationCount >= 1)
  );
}

export function shouldExtractExternalLinks(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const stats = getSelectionKeywordStats(params);

  if (!looksLikeArticleUrl(params.pageUrl) && !stats.isSelectionLikeUrl) {
    return false;
  }

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

  if (isInstagramUrl(pageUrl)) return false;
  if (isSitemapUrl(pageUrl)) return false;
  if (!isPdfUrl(pageUrl) && isBlockedFile(pageUrl)) return false;
  if (!isPdfUrl(pageUrl) && isBlockedPath(pageUrl)) return false;

  const stats = getSelectionKeywordStats({
    rawText,
    pageTitle,
    pageUrl,
    sourceName,
  });

  if (stats.isTopTitle && !stats.isStrongArticleUrl) return false;
  if (stats.isHardBlockedUrl && !stats.isStrongArticleUrl) return false;
  if (stats.isIndexLikeUrl) return false;
  if (stats.hasOldYearOnly) return false;

  const text = `${sourceName} ${pageTitle} ${rawText}`;

  if (stats.negativeCount >= 1 && !isSelectionDetailPage(text)) {
    return false;
  }

  if (stats.isStrongArticleUrl && stats.strongCount >= 1) {
    return true;
  }

  if (stats.isGoodDetailUrl && stats.strongCount >= 1) {
    return true;
  }

  if (
    stats.isGoodDetailUrl &&
    stats.recruitCount >= 2 &&
    (stats.targetCount >= 1 || stats.playerCount >= 1) &&
    (stats.scheduleCount >= 1 || stats.applicationCount >= 1 || stats.hasDate)
  ) {
    return true;
  }

  if (
    stats.recruitCount >= 2 &&
    (stats.scheduleCount >= 1 || stats.applicationCount >= 1 || stats.hasDate) &&
    (stats.targetCount >= 1 || stats.playerCount >= 1)
  ) {
    return true;
  }

  if (isPdfUrl(pageUrl) && stats.recruitCount >= 1 && stats.targetCount >= 1) {
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

  if (stats.hasOldYearOnly) {
    return {
      priority: -999,
      reason: "old_year_only",
      keywordCount: stats.keywordCount,
    };
  }

  if (stats.isTopTitle && !stats.isStrongArticleUrl) {
    return {
      priority: -999,
      reason: "top_title",
      keywordCount: stats.keywordCount,
    };
  }

  if (stats.isHardBlockedUrl && !stats.isStrongArticleUrl) {
    return {
      priority: -999,
      reason: "hard_blocked_url",
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

  if (stats.negativeCount >= 1 && stats.strongCount === 0) {
    return {
      priority: -999,
      reason: "negative_context",
      keywordCount: stats.keywordCount,
    };
  }

  let reason = "keyword_count";

  if (stats.isStrongArticleUrl && stats.strongCount >= 1) {
    reason = "strong_article_url_with_strong_keyword";
  } else if (stats.isSelectionLikeUrl && stats.strongCount >= 1) {
    reason = "selection_like_url_with_strong_keyword";
  } else if (stats.isSelectionLikeUrl) {
    reason = "selection_like_url";
  } else if (stats.strongCount >= 1) {
    reason = "strong_keyword";
  }

  return {
    priority: stats.keywordCount,
    reason,
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
    .replace(/メニュー|MENU|トップ|HOME/g, "")
    .trim();

  const base = title ? `${title}｜${body}` : body;

  if (base.length <= maxLength) return base;

  return `${base.slice(0, maxLength).trim()}…`;
}

export function normalizeSourceRank(source: SelectionSource, rawText: string) {
  const text = `${source.name} ${rawText}`;
  const current = source.source_rank;

  if (current) return current;

  if (source.organization_type === "j_club") return "J下部";

  if (text.includes("Jリーグ") || text.includes("J下部")) return "J下部";
  if (text.includes("T1") || text.includes("1部")) return "T1 / 1部";
  if (text.includes("T2") || text.includes("2部")) return "T2 / 2部";
  if (text.includes("T3") || text.includes("3部")) return "T3 / 3部";
  if (text.includes("T4") || text.includes("4部")) return "T4 / 4部";

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