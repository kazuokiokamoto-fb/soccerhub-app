// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SelectionSource = {
  id: string;
  name: string;
  base_url: string;
  organization_type: string;
  source_rank: string | null;
  enabled: boolean;
};

type CandidatePage = {
  pageUrl: string;
  pageTitle: string;
  rawText: string;
  html: string;
  status: number;
  contentType: string;
  pdf: boolean;
  priority: number;
  reason: string;
};

const MAX_PAGES_PER_SOURCE = 100;
const MAX_EVENTS_PER_SOURCE = 5;

const CRAWL_ENTRY_PATHS = [
  "",
  "/",
  "/news/",
  "/info/",
  "/information/",
  "/topics/",
  "/academy/",
  "/academy/news/",
  "/academy/info/",
  "/academy/topics/",
  "/academy/selection/",
  "/academy/recruit/",
  "/school/",
  "/school/news/",
  "/junior-youth/",
  "/junior_youth/",
  "/jy/",
  "/youth/",
  "/recruit/",
  "/selection/",
  "/tryout/",
  "/trial/",
  "/entry/",
  "/join/",
  "/member/",
  "/taiken/",
  "/experience/",
  "/sitemap.xml",
  "/sitemap_index.xml",
];

const KEYWORDS = [
  "セレクション",
  "選考会",
  "追加セレクション",
  "GKセレクション",
  "ゴールキーパーセレクション",
  "トライアウト",
  "選手募集",
  "参加者募集",
  "団員募集",
  "部員募集",
  "メンバー募集",
  "クラブ生募集",
  "スクール生募集",
  "アカデミー生募集",
  "ジュニアユース募集",
  "ユース募集",
  "ジュニア募集",
  "新入団",
  "入団",
  "加入",
  "新加入",
  "応募",
  "申込",
  "申し込み",
  "エントリー",
  "練習参加",
  "練習会",
  "体験練習",
  "体験練習会",
  "体験会",
  "無料体験会",
  "随時募集",
  "selection",
  "tryout",
  "trial",
  "recruit",
  "recruitment",
  "entry",
  "join",
];

const EXCLUDE_KEYWORDS = [
  "試合結果",
  "大会結果",
  "順位表",
  "戦績",
  "マッチレポート",
  "代表メンバー",
  "日本代表",
  "ハイライト",
  "チケット",
  "グッズ",
  "観戦",
  "会社概要",
  "プライバシー",
  "個人情報",
  "利用規約",
  "訪問スクール",
  "スクール訪問",
  "出張スクール",
  "訪問指導",
  "巡回指導",
  "派遣指導",
  "幼稚園訪問",
  "保育園訪問",
  "小学校訪問",
];

const PREFECTURES = [
  "東京都",
  "神奈川県",
  "埼玉県",
  "千葉県",
  "茨城県",
  "栃木県",
  "群馬県",
  "山梨県",
];

const CITIES = [
  "世田谷区",
  "杉並区",
  "練馬区",
  "大田区",
  "目黒区",
  "渋谷区",
  "新宿区",
  "中野区",
  "板橋区",
  "足立区",
  "江戸川区",
  "江東区",
  "品川区",
  "町田市",
  "調布市",
  "府中市",
  "三鷹市",
  "武蔵野市",
  "八王子市",
  "立川市",
  "横浜市",
  "川崎市",
  "相模原市",
  "藤沢市",
  "大和市",
  "厚木市",
  "さいたま市",
  "川口市",
  "所沢市",
  "越谷市",
  "川越市",
  "千葉市",
  "船橋市",
  "市川市",
  "柏市",
  "松戸市",
  "浦安市",
  "流山市",
  "つくば市",
  "水戸市",
  "宇都宮市",
  "前橋市",
  "高崎市",
];

function stripHtml(html: string) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(html: string) {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function sameHost(url: string, baseUrl: string) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

function isPdfUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?");
}

function isSitemapUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("sitemap") && lower.includes(".xml");
}

function isInstagramUrl(url: string) {
  return url.toLowerCase().includes("instagram.com/");
}

function isBlockedFile(url: string) {
  const lower = url.toLowerCase();

  if (isSitemapUrl(url)) return false;

  return (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp") ||
    lower.includes(".gif") ||
    lower.includes(".css") ||
    lower.includes(".js") ||
    lower.includes(".json") ||
    lower.includes(".xml") ||
    lower.includes(".svg") ||
    lower.includes(".ico") ||
    lower.includes(".zip") ||
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes("swiper") ||
    lower.includes("style.css")
  );
}

function isBlockedPath(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    lower.includes("/staff") ||
    lower.includes("/coach") ||
    lower.includes("coach_staff") ||
    lower.includes("/concept") ||
    lower.includes("/profile") ||
    lower.includes("/academy/coach") ||
    lower.includes("/academy/staff") ||
    lower.includes("/academy/profile") ||
    lower.includes("/player") ||
    lower.includes("/schedule") ||
    lower.includes("/result") ||
    lower.includes("/standings") ||
    lower.includes("/ticket") ||
    lower.includes("/goods") ||
    lower.includes("/privacy") ||
    lower.includes("/company") ||
    lower.includes("/feed") ||
    lower.includes("/contact") ||
    lower.includes("/inquiry") ||
    lower.includes("/login") ||
    lower.includes("/admin") ||
    lower.includes("visitschool") ||
    lower.includes("visit-school") ||
    lower.includes("visit_school") ||
    lower.includes("school-visit") ||
    lower.includes("school_visit")
  );
}

function isThinPath(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();

    const thinPaths = [
      "/selection/",
      "/trial/",
      "/tryout/",
      "/entry/",
      "/recruit/",
      "/join/",
      "/member/",
      "/academy/selection/",
      "/academy/recruit/",
      "/academy/entry/",
      "/academy/trial/",
      "/academy/tryout/",
      "/school/",
      "/academy/",
      "/news/",
      "/topics/",
      "/info/",
      "/information/",
    ];

    return thinPaths.includes(path);
  } catch {
    return false;
  }
}

function getUrlDepth(url: string) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function looksLikeArticleUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();

    if (isThinPath(url)) return false;

    if (
      /\/news\/.+/.test(path) ||
      /\/topics\/.+/.test(path) ||
      /\/info\/.+/.test(path) ||
      /\/information\/.+/.test(path) ||
      /\/blog\/.+/.test(path) ||
      /\/post\/.+/.test(path) ||
      /\/article\/.+/.test(path)
    ) {
      return true;
    }

    if (
      (path.includes("selection") ||
        path.includes("tryout") ||
        path.includes("trial") ||
        path.includes("recruit") ||
        path.includes("entry")) &&
      getUrlDepth(url) >= 2
    ) {
      return true;
    }

    if (/\d{4}/.test(path) && getUrlDepth(url) >= 2) return true;

    return false;
  } catch {
    return false;
  }
}

function buildSeedUrls(baseUrl: string) {
  const urls = new Set<string>();

  try {
    const base = new URL(baseUrl);
    urls.add(normalizeUrl(base.toString()));

    for (const path of CRAWL_ENTRY_PATHS) {
      const u = new URL(path, base.origin);
      urls.add(normalizeUrl(u.toString()));
    }

    if (base.pathname && base.pathname !== "/") {
      const cleanPath = base.pathname.endsWith("/")
        ? base.pathname
        : `${base.pathname}/`;

      const nested = [
        cleanPath,
        `${cleanPath}news/`,
        `${cleanPath}info/`,
        `${cleanPath}topics/`,
        `${cleanPath}selection/`,
        `${cleanPath}recruit/`,
        `${cleanPath}entry/`,
        `${cleanPath}join/`,
        `${cleanPath}member/`,
        `${cleanPath}school/`,
        `${cleanPath}sitemap.xml`,
      ];

      for (const path of nested) {
        const u = new URL(path, base.origin);
        urls.add(normalizeUrl(u.toString()));
      }
    }
  } catch {
    urls.add(baseUrl);
  }

  return Array.from(urls).slice(0, 50);
}

function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /href=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());

      if (isInstagramUrl(abs)) continue;
      if (isBlockedFile(abs)) continue;

      const pdf = isPdfUrl(abs);
      const sitemap = isSitemapUrl(abs);

      if (!pdf && !sitemap && !sameHost(abs, baseUrl)) continue;
      if (!pdf && !sitemap && isBlockedPath(abs)) continue;

      links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links);
}

function extractSitemapUrls(xml: string, baseUrl: string) {
  const urls = new Set<string>();
  const re = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(xml))) {
    const loc = String(match[1] ?? "")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .trim();

    if (!loc) continue;

    try {
      const abs = normalizeUrl(new URL(loc, baseUrl).toString());

      if (isInstagramUrl(abs)) continue;
      if (isBlockedFile(abs) && !isSitemapUrl(abs)) continue;
      if (!isPdfUrl(abs) && !isSitemapUrl(abs) && !sameHost(abs, baseUrl)) {
        continue;
      }
      if (!isPdfUrl(abs) && !isSitemapUrl(abs) && isBlockedPath(abs)) continue;

      urls.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(urls);
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "SakaMatchBot/1.0 (+https://www.sakamatch.com/; public selection info crawler)",
      accept:
        "text/html,application/xhtml+xml,application/xml,text/xml,application/pdf",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/pdf") || isPdfUrl(url)) {
    const arrayBuffer = await res.arrayBuffer();

    return {
      status: res.status,
      html: "",
      contentType,
      finalUrl: res.url || url,
      pdfBuffer: arrayBuffer,
    };
  }

  const html = await res.text();

  return {
    status: res.status,
    html,
    contentType,
    finalUrl: res.url || url,
    pdfBuffer: null,
  };
}

async function extractPdfTextFromBuffer(buffer: ArrayBuffer) {
  return "";
}

function safeDate(value?: string | null) {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?$/);
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;

  if (!valid) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function extractCategories(text: string) {
  const found = new Set<string>();

  const normalized = String(text ?? "")
    .replace(/Ｕ/g, "U")
    .replace(/－/g, "-")
    .replace(/ー/g, "-")
    .replace(/\s+/g, "");

  if (/未就学|幼児|年中|年長|キッズ/.test(normalized)) found.add("未就学");
  if (/年長/.test(normalized)) found.add("年長");

  if (/U-?6|年長/.test(normalized)) found.add("U-6");
  if (/U-?7|小学1年|小1|1年生|新小学1年|新小1/.test(normalized)) found.add("U-7");
  if (/U-?8|小学2年|小2|2年生|新小学2年|新小2/.test(normalized)) found.add("U-8");
  if (/U-?9|小学3年|小3|3年生|新小学3年|新小3/.test(normalized)) found.add("U-9");
  if (/U-?10|小学4年|小4|4年生|新小学4年|新小4/.test(normalized)) found.add("U-10");
  if (/U-?11|小学5年|小5|5年生|新小学5年|新小5/.test(normalized)) found.add("U-11");
  if (/U-?12|小学6年|小6|6年生|新小学6年|新小6/.test(normalized)) found.add("U-12");

  if (/U-?13|中学1年|中1|新中学1年|新中1/.test(normalized)) found.add("U-13");
  if (/U-?14|中学2年|中2|新中学2年|新中2/.test(normalized)) found.add("U-14");
  if (/U-?15|中学3年|中3|新中学3年|新中3/.test(normalized)) found.add("U-15");

  if (/U-?16|高校1年|高1|新高校1年|新高1/.test(normalized)) found.add("U-16");
  if (/U-?17|高校2年|高2|新高校2年|新高2/.test(normalized)) found.add("U-17");
  if (/U-?18|高校3年|高3|新高校3年|新高3|ユース/.test(normalized)) found.add("U-18");

  if (/ジュニアユース/.test(normalized)) found.add("ジュニアユース");
  if (/ユース/.test(normalized)) found.add("ユース");
  if (/スクール生|スクール/.test(normalized)) found.add("スクール生");
  if (/GK|ＧＫ|ゴールキーパー/.test(normalized)) found.add("GK");
  if (/女子|レディース|ガールズ/.test(normalized)) found.add("女子");

  return Array.from(found);
}

function extractPrefecture(text: string) {
  return PREFECTURES.find((v) => text.includes(v)) ?? null;
}

function extractCity(text: string) {
  return CITIES.find((v) => text.includes(v)) ?? null;
}

function extractDateNearKeyword(text: string) {
  const keywordIndexes = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b);

  for (const idx of keywordIndexes) {
    const part = text.slice(Math.max(0, idx - 300), idx + 1200);
    const date = extractDate(part);
    if (date) return date;
  }

  return extractDate(text);
}

function extractDate(text: string) {
  const year = new Date().getFullYear();

  const full = text.match(/(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})日?/);
  if (full) {
    return `${full[1]}-${String(full[2]).padStart(2, "0")}-${String(
      full[3]
    ).padStart(2, "0")}`;
  }

  const md =
    text.match(/(\d{1,2})月(\d{1,2})日/) ||
    text.match(/(\d{1,2})\/(\d{1,2})/);

  if (md) {
    return `${year}-${String(md[1]).padStart(2, "0")}-${String(md[2]).padStart(
      2,
      "0"
    )}`;
  }

  return null;
}

function extractDeadline(text: string) {
  const words = [
    "申込期限",
    "申込締切",
    "応募締切",
    "締切",
    "〆切",
    "申込み期限",
    "募集締切",
  ];

  for (const word of words) {
    const idx = text.indexOf(word);
    if (idx >= 0) {
      return extractDate(text.slice(idx, idx + 220));
    }
  }

  return null;
}

function titleFromUrl(pageUrl: string, fallback: string) {
  try {
    const u = new URL(pageUrl);
    const file = decodeURIComponent(
      u.pathname.split("/").filter(Boolean).pop() || ""
    );

    if (file) return file.replace(/\.pdf$/i, "").slice(0, 120);
  } catch {
    // ignore
  }

  return fallback;
}

function containsKeyword(text: string) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function buildTitle(
  pageTitle: string,
  sourceName: string,
  text: string,
  pageUrl: string
) {
  if (isPdfUrl(pageUrl)) {
    return `${sourceName} ${titleFromUrl(pageUrl, "PDF募集資料")}`.slice(0, 120);
  }

  if (pageTitle && containsKeyword(pageTitle)) return pageTitle.slice(0, 120);

  const keyword = KEYWORDS.find((k) => text.includes(k)) ?? "募集情報";
  return `${sourceName} ${keyword}`.slice(0, 120);
}

function buildSummary(text: string) {
  const idx = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];

  if (idx == null) return text.slice(0, 180);
  return text.slice(Math.max(0, idx - 80), idx + 360).trim();
}

function normalizeDuplicateText(text?: string | null) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .replace(/[\s　]/g, "")
    .replace(/-|－|ー/g, "")
    .replace(/[()（）【】［］]/g, "")
    .trim();
}

function buildDuplicateKey(params: {
  title?: string | null;
  organizationName?: string | null;
  eventDate?: string | null;
}) {
  return [
    normalizeDuplicateText(params.organizationName),
    normalizeDuplicateText(params.title),
    params.eventDate ?? "date_unknown",
  ].join("|");
}

function displayStatusFromDates(
  eventDate: string | null,
  deadline: string | null,
  rawText: string
) {
  const today = new Date().toISOString().slice(0, 10);

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";
  if (!eventDate && rawText.includes("随時募集")) return "随時募集";
  if (!eventDate) return "日付未取得";

  return "募集中";
}

function isTargetPage(params: {
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
  if (!isPdfUrl(pageUrl) && isThinPath(pageUrl)) return false;

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

function getPagePriority(params: {
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

function normalizeSourceRank(source: SelectionSource, rawText: string) {
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

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("column")
  );
}

function removeOptionalCrawlerColumns(payload: any) {
  const copy = { ...payload };
  delete copy.source_type;
  delete copy.pdf_url;
  delete copy.instagram_url;
  delete copy.external_url;
  delete copy.extraction_status;
  delete copy.extraction_error;
  delete copy.page_priority;
  delete copy.priority_reason;
  return copy;
}

async function notifyNewSelectionEvent(
  supabase: any,
  eventId: string,
  title: string
) {
  const notificationTitle = "新しいセレクション情報";
  const notificationBody = `${title} が追加されました`;
  const targetUrl = `/selection/${eventId}`;

  const { data: teams, error } = await supabase
    .from("teams")
    .select("owner_id")
    .not("owner_id", "is", null)
    .limit(500);

  if (error) {
    await supabase.from("selection_notification_logs").insert({
      selection_event_id: eventId,
      notification_type: "push",
      title: notificationTitle,
      body: notificationBody,
      target_url: targetUrl,
      success: false,
      error_message: error.message,
    });
    return;
  }

  const userIds = Array.from(
    new Set((teams ?? []).map((t: any) => t.owner_id).filter(Boolean))
  );

  for (const userId of userIds) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "selection_event",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        is_read: false,
      });

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id: userId,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: true,
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: false,
        error_message: message,
      });
    }
  }
}

async function saveCandidateEvent(params: {
  supabase: any;
  source: SelectionSource;
  candidate: CandidatePage;
}) {
  const { supabase, source, candidate } = params;

  const { pageUrl, pageTitle, rawText, html, status, pdf, priority, reason } =
    candidate;

  const title = buildTitle(pageTitle, source.name, rawText, pageUrl);
  const eventDate = safeDate(extractDateNearKeyword(rawText));
  const deadline = safeDate(extractDeadline(rawText));
  const checksum = await sha256(rawText);

  const { data: pageRow, error: pageError } = await supabase
    .from("selection_crawl_pages")
    .insert({
      source_id: source.id,
      page_url: pageUrl,
      page_title: pageTitle,
      http_status: status,
      raw_html: html.slice(0, 500000),
      raw_text: rawText.slice(0, 500000),
      checksum,
    })
    .select("id")
    .single();

  if (pageError) throw pageError;

  const duplicateKey = buildDuplicateKey({
    title,
    organizationName: source.name,
    eventDate,
  });

  const contentHash = await sha256(
    `${title}|${eventDate ?? "date_unknown"}|${pageUrl}`
  );

  const payload = {
    source_id: source.id,
    crawl_page_id: pageRow?.id ?? null,
    title,
    organization_name: source.name,
    organization_type: source.organization_type || "other",
    source_rank: normalizeSourceRank(source, rawText),
    target_categories: extractCategories(rawText),
    gender:
      rawText.includes("女子") ||
      rawText.includes("レディース") ||
      rawText.includes("ガールズ")
        ? "girls"
        : "any",
    prefecture: extractPrefecture(rawText),
    city: extractCity(rawText),
    event_date: eventDate,
    application_deadline: deadline,
    source_url: pageUrl,
    official_url: pageUrl,
    summary: pdf
      ? buildSummary(rawText) ||
        "PDF募集資料を検出しました。詳細は公式PDFをご確認ください。"
      : buildSummary(rawText),
    memo: eventDate
      ? "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。"
      : "※日付未取得の募集情報です。開催日・申込条件は必ず公式サイトでご確認ください。",
    fetched_at: new Date().toISOString(),
    raw_text: rawText.slice(0, 500000),
    content_hash: contentHash,
    duplicate_key: duplicateKey,
    status: "published",
    display_status: displayStatusFromDates(eventDate, deadline, rawText),
    is_featured: source.organization_type === "j_club",
    last_seen_at: new Date().toISOString(),

    source_type: pdf ? "pdf" : "web",
    pdf_url: pdf ? pageUrl : null,
    instagram_url: null,
    external_url: pdf ? pageUrl : null,
    extraction_status: eventDate ? "success" : "date_missing",
    extraction_error: eventDate ? null : "event_date not found",
    page_priority: priority,
    priority_reason: reason,
  };

  let existing: any = null;

  const { data: existingByUrl, error: existingByUrlError } = await supabase
    .from("selection_events")
    .select("id")
    .eq("source_url", pageUrl)
    .maybeSingle();

  if (existingByUrlError) throw existingByUrlError;

  existing = existingByUrl;

  if (!existing?.id) {
    const { data: existingByDuplicateKey, error: existingByDuplicateKeyError } =
      await supabase
        .from("selection_events")
        .select("id")
        .eq("duplicate_key", duplicateKey)
        .maybeSingle();

    if (existingByDuplicateKeyError) throw existingByDuplicateKeyError;

    existing = existingByDuplicateKey;
  }

  if (existing?.id) {
    let { error: updateError } = await supabase
      .from("selection_events")
      .update(payload)
      .eq("id", existing.id);

    if (updateError && isMissingColumnError(updateError)) {
      const fallbackPayload = removeOptionalCrawlerColumns(payload);

      const retry = await supabase
        .from("selection_events")
        .update(fallbackPayload)
        .eq("id", existing.id);

      updateError = retry.error;
    }

    if (updateError) throw updateError;

    return { inserted: false, updated: true, pageSaved: true };
  }

  let { data: insertedEvent, error: insertError } = await supabase
    .from("selection_events")
    .insert(payload)
    .select("id,title")
    .single();

  if (insertError && isMissingColumnError(insertError)) {
    const fallbackPayload = removeOptionalCrawlerColumns(payload);

    const retry = await supabase
      .from("selection_events")
      .insert(fallbackPayload)
      .select("id,title")
      .single();

    insertedEvent = retry.data;
    insertError = retry.error;
  }

  if (insertError) throw insertError;

  if (insertedEvent?.id) {
    await notifyNewSelectionEvent(
      supabase,
      insertedEvent.id,
      insertedEvent.title || title
    );
  }

  return { inserted: true, updated: false, pageSaved: true };
}

serve(async (req) => {
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") || "0");
  const limit = Number(url.searchParams.get("limit") || "1");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: sources, error } = await supabase
    .from("selection_sources")
    .select("id,name,base_url,organization_type,source_rank,enabled")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .range(offset, offset);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let fetchedPages = 0;
  let savedPages = 0;
  let insertedEvents = 0;
  let updatedEvents = 0;
  const errors: string[] = [];

  for (const source of (sources ?? []) as SelectionSource[]) {
    const { data: log } = await supabase
      .from("selection_fetch_logs")
      .insert({ source_id: source.id, success: false })
      .select("id")
      .single();

    const logId = log?.id;

    let sourceFetchedPages = 0;
    let sourceInsertedEvents = 0;
    let sourceUpdatedEvents = 0;
    let sourceSavedPages = 0;

    try {
      const seedUrls = buildSeedUrls(source.base_url);
      const queue = [...seedUrls];
      const visited = new Set<string>();
      const candidates: CandidatePage[] = [];

      while (queue.length > 0 && visited.size < MAX_PAGES_PER_SOURCE) {
        let pageUrl = normalizeUrl(queue.shift() || "");
        if (!pageUrl) continue;
        if (visited.has(pageUrl)) continue;
        if (isInstagramUrl(pageUrl)) continue;
        if (!isPdfUrl(pageUrl) && !isSitemapUrl(pageUrl) && isBlockedFile(pageUrl)) continue;
        if (!isPdfUrl(pageUrl) && !isSitemapUrl(pageUrl) && isBlockedPath(pageUrl)) continue;

        visited.add(pageUrl);

        let fetched: any = null;

        try {
          fetched = await fetchHtml(pageUrl);
        } catch {
          continue;
        }

        const finalUrl = normalizeUrl(fetched.finalUrl || pageUrl);

        if (finalUrl !== pageUrl) {
          if (visited.has(finalUrl)) continue;
          pageUrl = finalUrl;
          visited.add(pageUrl);
        }

        fetchedPages += 1;
        sourceFetchedPages += 1;

        const pdf = isPdfUrl(pageUrl) || fetched.contentType?.includes("pdf");
        const sitemap =
          isSitemapUrl(pageUrl) ||
          fetched.contentType?.includes("xml") ||
          fetched.contentType?.includes("text/xml");

        const html = fetched.html || "";

        if (sitemap && html) {
          const sitemapLinks = extractSitemapUrls(html, pageUrl);

          for (const link of sitemapLinks) {
            if (!visited.has(link) && queue.length < MAX_PAGES_PER_SOURCE * 5) {
              queue.push(link);
            }
          }

          continue;
        }

        let rawText = "";
        let pageTitle = "";

        if (pdf) {
          pageTitle = titleFromUrl(pageUrl, "PDF募集資料");

          const pdfText = fetched.pdfBuffer
            ? await extractPdfTextFromBuffer(fetched.pdfBuffer)
            : "";

          rawText = [source.name, pageTitle, pdfText, pageUrl]
            .filter(Boolean)
            .join(" ");

          if (!rawText.trim()) {
            rawText = `${source.name} PDF募集資料 ${pageUrl}`;
          }
        } else {
          rawText = stripHtml(html);
          pageTitle = getTitle(html);

          const foundLinks = extractLinks(html, pageUrl);
          for (const link of foundLinks) {
            if (!visited.has(link) && queue.length < MAX_PAGES_PER_SOURCE * 5) {
              queue.push(link);
            }
          }
        }

        const target = isTargetPage({
          rawText,
          pageTitle,
          pageUrl,
          sourceName: source.name,
        });

        if (!target) continue;
        if (!pdf && isThinPath(pageUrl)) continue;

        const priority = getPagePriority({
          rawText,
          pageTitle,
          pageUrl,
        });

        if (priority.priority <= 0) continue;

        candidates.push({
          pageUrl,
          pageTitle,
          rawText,
          html,
          status: fetched.status,
          contentType: fetched.contentType,
          pdf,
          priority: priority.priority,
          reason: priority.reason,
        });
      }

      const uniqueByDuplicateKey = new Map<string, CandidatePage>();

      for (const candidate of candidates) {
        const title = buildTitle(
          candidate.pageTitle,
          source.name,
          candidate.rawText,
          candidate.pageUrl
        );
        const eventDate = safeDate(extractDateNearKeyword(candidate.rawText));

        const key = buildDuplicateKey({
          title,
          organizationName: source.name,
          eventDate,
        });

        const existing = uniqueByDuplicateKey.get(key);

        if (!existing || candidate.priority > existing.priority) {
          uniqueByDuplicateKey.set(key, candidate);
        }
      }

      const selectedCandidates = Array.from(uniqueByDuplicateKey.values())
        .sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return b.pageUrl.length - a.pageUrl.length;
        })
        .slice(0, MAX_EVENTS_PER_SOURCE);

      for (const candidate of selectedCandidates) {
        const result = await saveCandidateEvent({
          supabase,
          source,
          candidate,
        });

        if (result.pageSaved) {
          savedPages += 1;
          sourceSavedPages += 1;
        }

        if (result.inserted) {
          insertedEvents += 1;
          sourceInsertedEvents += 1;
        }

        if (result.updated) {
          updatedEvents += 1;
          sourceUpdatedEvents += 1;
        }
      }

      await supabase
        .from("selection_sources")
        .update({ last_crawled_at: new Date().toISOString() })
        .eq("id", source.id);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: true,
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
            error_message:
              candidates.length > 0
                ? null
                : "No target candidates found",
          })
          .eq("id", logId);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      errors.push(`${source.name}: ${message}`);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: message,
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
          })
          .eq("id", logId);
      }
    }
  }

  return Response.json({
    ok: errors.length === 0,
    sourceCount: sources?.length ?? 0,
    offset,
    nextOffset: sources?.length ? offset + 1 : null,
    remainingLimit: Math.max(limit - 1, 0),
    fetchedPages,
    savedPages,
    insertedEvents,
    updatedEvents,
    errors,
  });
});