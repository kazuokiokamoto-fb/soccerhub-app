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

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
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
  "trial",
];

const RECRUIT_INTENT_WORDS = [
  ...STRONG_SELECTION_WORDS,

  "練習会",
  "合同練習会",
  "練習参加",
  "練習参加型",
  "練習参加受付",
  "体験練習",
  "体験練習会",
  "練習体験",
  "体験会",
  "無料体験",
  "無料体験会",
  "セレクション練習会",
  "トレーニング体験",
  "フィールドプレイヤー練習会",
  "GK練習会",
  "open training",

  "選手募集",
  "参加者募集",
  "部員募集",
  "団員募集",
  "メンバー募集",
  "クラブ生募集",
  "スクール生募集",
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

  "チャレンジャー募集",
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

  "Ｕ-１２",
  "Ｕ-１３",
  "Ｕ-１５",
  "Ｕ−１２",
  "Ｕ−１３",
  "Ｕ−１５",

  "ジュニア",
  "ジュニアユース",
  "ジュニアユースU15",
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
  "フィールドプレイヤー",
  "フィールドプレーヤー",
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
  "キックオフ",
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
  "最寄駅",
  "現地",
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
  "SOCIO",
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
  "サポートスタッフ",
  "設営撤収",
  "ゲーム",
  "リーグ戦",
  "クラブユース選手権",
  "大会結果",
  "活動報告",
  "レポート",
  "キャンペーン",
  "SOCIO",
  "年間チケット",
  "OFFICIAL MEMBERSHIP",
];

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

  const years = Array.from(text.matchAll(/20\d{2}/g)).map((m) =>
    Number(m[0])
  );

  if (years.length === 0) return false;

  const newestYear = Math.max(...years);

  return newestYear < currentYear;
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

function hasNegativeContext(text: string) {
  return hasAny(text, NEGATIVE_WORDS);
}

function isIndexLikeUrl(url: string) {
  const normalized = url.endsWith("/") ? url : `${url}/`;

  return (
    normalized.endsWith("/news/") ||
    normalized.endsWith("/match/") ||
    normalized.endsWith("/academy/") ||
    normalized.endsWith("/school/") ||
    normalized.endsWith("/information/") ||
    normalized.endsWith("/topics/") ||
    normalized.endsWith("/info/") ||
    normalized.includes("/category/") ||
    normalized.includes("/tag/") ||
    normalized.includes("/page/")
  );
}

function hasSelectionIntent(text: string, lowerText: string) {
  return (
    hasAny(text, RECRUIT_INTENT_WORDS) ||
    lowerText.includes("selection") ||
    lowerText.includes("tryout") ||
    lowerText.includes("trial") ||
    lowerText.includes("open training")
  );
}

function hasStrongSelectionIntent(text: string, lowerText: string) {
  return (
    hasAny(text, STRONG_SELECTION_WORDS) ||
    lowerText.includes("selection") ||
    lowerText.includes("tryout") ||
    lowerText.includes("trial")
  );
}

function hasRecruitIntent(text: string) {
  return hasAny(text, RECRUIT_INTENT_WORDS);
}

function hasTrainingIntent(text: string) {
  return hasAny(text, [
    "体験会",
    "練習会",
    "練習参加",
    "体験練習",
    "体験練習会",
    "無料体験会",
    "合同練習会",
    "トレーニング体験",
  ]);
}

function hasCategoryContext(text: string) {
  return hasAny(text, TARGET_WORDS);
}

function hasPlayerContext(text: string) {
  return hasAny(text, PLAYER_CONTEXT_WORDS);
}

function hasApplicationContext(text: string) {
  return hasAny(text, APPLICATION_WORDS);
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

export function isSelectionDetailPage(text: string) {
  const recruitIntent = hasAny(text, RECRUIT_INTENT_WORDS);
  const scheduleInfo = hasAny(text, SCHEDULE_WORDS);
  const applicationInfo = hasAny(text, APPLICATION_WORDS);
  const targetInfo = hasAny(text, TARGET_WORDS);
  const playerInfo = hasAny(text, PLAYER_CONTEXT_WORDS);
  const venueInfo = hasAny(text, VENUE_WORDS);
  const detailInfo = hasAny(text, DETAIL_WORDS);

  return (
    recruitIntent &&
    (scheduleInfo || applicationInfo) &&
    (targetInfo || playerInfo) &&
    (venueInfo || detailInfo || applicationInfo)
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
  if (!isPdfUrl(pageUrl) && isIndexLikeUrl(pageUrl)) return false;
  if (hasOldYearOnly(text)) return false;

  const strongSelectionIntent = hasStrongSelectionIntent(text, lowerText);
  const selectionIntent = hasSelectionIntent(text, lowerText);
  const recruitIntent = hasRecruitIntent(text);
  const trainingIntent = hasTrainingIntent(text);
  const playerContext = hasPlayerContext(text);

  if (!selectionIntent && !recruitIntent && !trainingIntent) {
    return false;
  }

  if (hasNegativeContext(text) && !strongSelectionIntent) {
    return false;
  }

  if (!strongSelectionIntent && !playerContext) {
    return false;
  }

  if (isSelectionDetailPage(text)) {
    return true;
  }

  if (isPdfUrl(pageUrl) && (strongSelectionIntent || playerContext)) {
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

  if (isSelectionDetailPage(text)) {
    score += 80;
    reason = "selection_detail_page";
  }

  if (hasStrongSelectionIntent(text, lowerText)) {
    score += 60;
    reason = "strong_selection_keyword";
  }

  if (hasRecruitIntent(text)) {
    score += 25;
    reason = "recruit_keyword";
  }

  if (hasTrainingIntent(text)) {
    score += 30;
    reason = "training_keyword";
  }

  if (hasDateContext(text)) score += 20;
  if (hasCategoryContext(text)) score += 15;
  if (hasApplicationContext(text)) score += 15;
  if (hasPlayerContext(text)) score += 20;

  if (hasOldYearOnly(text)) {
    score -= 120;
    reason = "old_year_only";
  }

  if (hasNegativeContext(text) && !hasStrongSelectionIntent(text, lowerText)) {
    score -= 100;
    reason = "negative_context";
  }

  if (hasEndedText(text)) {
    score -= 80;
    reason = "ended_text";
  }

  score += Math.min(getUrlDepth(pageUrl) * 5, 20);

  if (isThinPath(pageUrl) || isIndexLikeUrl(pageUrl)) {
    score -= 100;
    reason = "thin_or_index_path";
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