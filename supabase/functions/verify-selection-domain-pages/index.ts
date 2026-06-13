// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("VERIFY START NEWS-FIRST FALLBACK-DIRECT v5 ONE-BY-ONE");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ROWS = 9999;
const MAX_RUN_MS = 45_000;
const FETCH_TIMEOUT_MS = 12000;
const MIN_ACCEPT_SCORE = 70;

const MAX_DIRECT_CANDIDATES = 8;
const MAX_NEWS_LISTS = 4;
const MAX_NEWS_ARTICLES = 100;
const MAX_SELECTION_EVENTS_PER_TEAM = 2;
const RECRAWL_HOURS = 20;

const BAD_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "maps.google",
  "google.com",
  "forms.gle",
  "docs.google.com",
];

const BAD_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4", ".mov", ".avi",
];

const HARD_BAD_URL_PARTS = [
  "/feed",
  "/rss",
  "/contact",
  "/privacy",
  "/company",
  "/about",
  "/access",
  "/schedule",
  "/calendar",
  "/result",
  "/results",
];

const STRONG_WORDS = [
  "セレクション",
  "選考会",
  "トライアウト",
  "tryout",
  "selection",
  "練習会",
  "体験練習会",
  "体験会",
  "練習参加",
  "練習体験",
  "体験参加",
  "体験受付",
  "選手募集",
  "参加者募集",
  "新入団",
  "入団",
  "入部",
  "募集",
  "追加募集",
  "GK募集",
  "ゴールキーパー募集",
  "入団希望",
  "入団希望者",
  "現小学6年生",
  "新中学1年生",
  "新中一",
  "ジュニアユース説明会",
  "説明会",
];

const CORE_SELECTION_WORDS = [
  "セレクション",
  "選考会",
  "トライアウト",
  "tryout",
  "selection",
  "練習会",
  "体験練習会",
  "体験会",
  "練習参加",
  "練習体験",
  "体験参加",
  "選手募集",
  "新入団",
  "入団希望",
  "入団希望者",
  "現小学6年生",
  "新中学1年生",
  "新中一",
  "ジュニアユース説明会",
  "GK募集",
  "ゴールキーパー募集",
];

const DETAIL_WORDS = [
  "開催日",
  "実施日",
  "日程",
  "対象",
  "募集対象",
  "会場",
  "参加費",
  "費用",
  "申込",
  "申し込み",
  "応募",
  "受付",
  "締切",
  "〆切",
  "エントリー",
  "googleフォーム",
  "Googleフォーム",
  "フォーム",
  "持ち物",
  "定員",
  "集合",
];

const SOCCER_WORDS = [
  "サッカー",
  "soccer",
  "football",
  "フットボール",
  "fc",
  "f.c",
  "sc",
  "クラブ",
  "ユース",
  "ジュニアユース",
  "u-12",
  "u12",
  "u-13",
  "u13",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "女子",
  "レディース",
  "社会人",
  "シニア",
];

const NEGATIVE_WORDS = [
  "ニュース一覧",
  "カテゴリ",
  "カテゴリー",
  "アーカイブ",
  "タグ",
  "チーム紹介",
  "クラブ紹介",
  "トップページ",
  "ホーム",
  "お問い合わせ",
  "問い合わせ",
  "会社概要",
  "プライバシーポリシー",
  "利用規約",
  "キックオフイベント",
  "イベント開催",
  "ファンイベント",
  "観戦",
  "チケット",
  "グッズ",
  "試合結果",
  "マッチレポート",
  "リーグ戦",
  "大会結果",
  "ボランティア",
];

const LIST_PAGE_WORDS = [
  "バックナンバー",
  "ニュース一覧",
  "記事一覧",
  "お知らせ一覧",
  "一覧",
  "カテゴリ",
  "カテゴリー",
  "アーカイブ",
  "検索結果",
];

const DIRECT_URL_WORDS = [
  "selection",
  "tryout",
  "trial",
  "recruit",
  "recruitment",
  "member",
  "join",
  "entry",
  "taiken",
  "nyudan",
  "nyubu",
  "boshu",
  "schooltrial",
];

const NEWS_LIST_WORDS = [
  "news",
  "topics",
  "topic",
  "information",
  "info",
  "notice",
  "entry",
  "blog",
  "post",
  "posts",
  "article",
  "articles",
  "お知らせ",
  "ニュース",
  "最新情報",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", `"`)
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripTags(html: string) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactText(text: string, max = 12000) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanForDb(text: string, max = 20000) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\u2028/g, " ")
    .replace(/\u2029/g, " ")
    .slice(0, max);
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeUrl(url: string, base?: string) {
  try {
    const u = new URL(url, base);
    u.hash = "";
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("fbclid");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function normalizeSelectionUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("fbclid");
    return u.toString().replace(/\/$/, "");
  } catch {
    return String(url || "").replace(/\/$/, "");
  }
}

async function isBlacklistedSelectionUrl(url: string) {
  const urlNorm = normalizeSelectionUrl(url);

  const { data, error } = await supabase
    .from("selection_event_blacklist")
    .select("id")
    .eq("url_norm", urlNorm)
    .limit(1);

  if (error) {
    console.error("blacklist check error:", error);
    return false;
  }

  return (data || []).length > 0;
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function isBadDomain(url: string) {
  const h = hostOf(url);
  return BAD_DOMAINS.some((d) => h.includes(d));
}

function isBadUrl(url: string) {
  const u = String(url || "").toLowerCase();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return true;
  if (isBadDomain(u)) return true;
  if (BAD_EXTENSIONS.some((x) => u.split("?")[0].endsWith(x))) return true;
  if (HARD_BAD_URL_PARTS.some((x) => u.includes(x))) return true;
  return false;
}

function sameHost(url: string, startUrl: string) {
  return hostOf(url) === hostOf(startUrl);
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function countMatches(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  let count = 0;
  const matched: string[] = [];

  for (const word of words) {
    const w = word.toLowerCase();
    if (t.includes(w)) {
      matched.push(word);
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      count += Math.min((t.match(re) || []).length, 8);
    }
  }

  return { count, matched };
}

function getTitle(html: string, fallback: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);

  return String(fallback || "セレクション情報").slice(0, 120);
}

function extractLinks(html: string, baseUrl: string) {
  const links: any[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const href = decodeHtml(m[1] || "").trim();
    const label = stripTags(m[2] || "").trim();

    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) continue;

    const url = canonicalUrl(normalized);
    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ url, label });
  }

  return links;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    const ct = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    if (!ct.includes("text/html") && !ct.includes("application/xhtml+xml") && !ct.includes("text/plain")) {
      throw new Error(`not html: ${ct}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function scorePage(page: any) {
  const title = page.title || "";
  const url = page.url || "";
  const path = pathOf(url);
  const text = compactText(`${title} ${url} ${page.text}`, 40000);

  const core = countMatches(text, CORE_SELECTION_WORDS);
  const strong = countMatches(text, STRONG_WORDS);
  const detail = countMatches(text, DETAIL_WORDS);
  const soccer = countMatches(text, SOCCER_WORDS);
  const negative = countMatches(text, NEGATIVE_WORDS);

  let score = 0;

  score += core.count * 80;
  score += strong.count * 20;
  score += detail.count * 12;
  score += soccer.count * 5;

  if (includesAny(title, CORE_SELECTION_WORDS)) score += 100;
  if (includesAny(title, STRONG_WORDS)) score += 45;
  if (includesAny(title, DETAIL_WORDS)) score += 20;

  if (includesAny(url, ["selection", "tryout", "trial"])) score += 50;
  if (includesAny(url, DIRECT_URL_WORDS)) score += 35;

  score -= negative.count * 45;

  if (page.text.length < 250) score -= 35;
  if (page.text.length > 1200) score += 15;

  if (path === "/" || path === "" || path === "/index.html" || path === "/index.htm" || path === "/index") {
    score -= 150;
  }

  if (includesAny(title, ["最新情報", "news", "お知らせ", "トップ", "home", "バックナンバー"])) {
    score -= 100;
  }

  if (includesAny(text, ["ニュース一覧", "記事一覧", "一覧"])) score -= 70;
  if (includesAny(text, ["開催日", "対象", "会場", "申込"])) score += 40;

  if (core.count === 0) score -= 300;
  if (strong.count === 0) score -= 80;
  if (soccer.count === 0) score -= 30;

  return {
    score,
    coreMatched: core.matched,
    strongMatched: strong.matched,
    detailMatched: detail.matched,
    soccerMatched: soccer.matched,
    negativeMatched: negative.matched,
  };
}

function isListPage(page: any) {
  const title = String(page.title || "");
  const url = String(page.url || "");
  const path = pathOf(url);
  const textHead = compactText(String(page.text || ""), 2000);

  if (url.includes("page=")) return true;
  if (path === "/entry" || path === "/entry/") return true;
  if (path === "/news" || path === "/news/") return true;
  if (path === "/topics" || path === "/topics/") return true;
  if (path === "/information" || path === "/information/") return true;
  if (path === "/info" || path === "/info/") return true;
  if (includesAny(title, LIST_PAGE_WORDS)) return true;
  if (includesAny(textHead, ["ニュース一覧", "記事一覧", "バックナンバー"])) return true;

  return false;
}

function isDirectCandidateLink(link: any) {
  const hay = `${link.url} ${link.label}`;
  return includesAny(hay, [...DIRECT_URL_WORDS, ...CORE_SELECTION_WORDS]);
}

function isNewsListLink(link: any) {
  const hay = `${link.url} ${link.label}`.toLowerCase();
  const path = pathOf(link.url);

  if (includesAny(hay, NEWS_LIST_WORDS)) return true;
  if (path === "/news" || path === "/news/") return true;
  if (path === "/entry" || path === "/entry/") return true;
  if (path === "/topics" || path === "/topics/") return true;
  if (path === "/information" || path === "/information/") return true;
  if (path === "/info" || path === "/info/") return true;

  return false;
}

function looksArticleUrl(url: string) {
  const u = String(url || "").toLowerCase();
  const path = pathOf(u);

  if (path === "/" || path === "") return false;
  if (u.includes("page=")) return false;
  if (isBadUrl(url)) return false;

  if (/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/.test(u)) return true;
  if (/\/view\/\d+/.test(u)) return true;
  if (/\/news\/[^/]+/.test(u)) return true;
  if (/\/entry\/[^/]+/.test(u)) return true;
  if (/\/posts?\/[^/]+/.test(u)) return true;
  if (/\/articles?\/[^/]+/.test(u)) return true;
  if (/\/topics?\/[^/]+/.test(u)) return true;

  return false;
}

function extractPublishedDateFromUrlOrText(url: string, text: string) {
  const raw = `${url} ${text || ""}`;

  let m = raw.match(/(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (m) return toDateString(validDate(Number(m[1]), Number(m[2]), Number(m[3])));

  m = raw.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (m) return toDateString(validDate(Number(m[1]), Number(m[2]), Number(m[3])));

  m = raw.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return toDateString(validDate(Number(m[1]), Number(m[2]), Number(m[3])));

  return null;
}

function dateSortValue(date: string | null) {
  return date ? Number(date.replaceAll("-", "")) : 0;
}

function dedupeByUrl(items: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const item of items) {
    const url = canonicalUrl(item.url || "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...item, url });
  }

  return out;
}

async function loadPage(url: string, fallbackTitle = "") {
  const html = await fetchHtml(url);
  const title = getTitle(html, fallbackTitle || url);
  const text = stripTags(html);
  const publishedDate = extractPublishedDateFromUrlOrText(url, `${title} ${text.slice(0, 1200)}`);

  return { url, title, text, html, publishedDate };
}

async function evaluateCandidatePage(link: any, type: string) {
  const page = await loadPage(link.url, link.label || link.url);
  const s = scorePage(page);
  const fullText = compactText(`${page.title} ${page.url} ${page.text}`, 40000);
  const hasCore = includesAny(fullText, CORE_SELECTION_WORDS);
  const listPage = isListPage(page);

  return {
    page: {
      ...page,
      publishedDate: page.publishedDate || link.publishedDate || null,
      verifiedScore: s.score,
      scoreDetail: s,
      candidateType: type,
    },
    debug: {
      type,
      url: page.url,
      title: page.title,
      publishedDate: page.publishedDate || link.publishedDate || null,
      score: s.score,
      hasCore,
      isListPage: listPage,
      coreMatched: s.coreMatched,
      detailMatched: s.detailMatched,
      negativeMatched: s.negativeMatched,
    },
    accepted: hasCore && !listPage && s.score >= MIN_ACCEPT_SCORE,
  };
}

async function collectCandidatePages(homepage: any) {
  const startUrl = homepage.official_url;
  const startHost = hostOf(startUrl);

  if (!startUrl || !startHost) throw new Error("invalid homepage url");
  if (isBadUrl(startUrl)) throw new Error("bad homepage url");

  const top = await loadPage(startUrl, homepage.team_name || startUrl);
  const topLinks = extractLinks(top.html, startUrl)
    .filter((link) => sameHost(link.url, startUrl))
    .filter((link) => !isBadUrl(link.url));

  const newsListLinks = dedupeByUrl(
    topLinks
      .filter(isNewsListLink)
      .slice(0, MAX_NEWS_LISTS),
  );

  const directLinks = dedupeByUrl(
    topLinks
      .filter(isDirectCandidateLink)
      .filter((link) => !isNewsListLink(link))
      .slice(0, MAX_DIRECT_CANDIDATES),
  );

  const articleLinksFromTop = topLinks
    .filter((link) => looksArticleUrl(link.url))
    .map((link, index) => ({
      ...link,
      order: index,
      publishedDate: extractPublishedDateFromUrlOrText(link.url, link.label),
    }));

  let articleLinks: any[] = [...articleLinksFromTop];

  for (const newsList of newsListLinks) {
    try {
      const listPage = await loadPage(newsList.url, newsList.label || newsList.url);
      const links = extractLinks(listPage.html, newsList.url)
        .filter((link) => sameHost(link.url, startUrl))
        .filter((link) => !isBadUrl(link.url))
        .filter((link) => looksArticleUrl(link.url))
        .map((link, index) => ({
          ...link,
          order: index,
          publishedDate: extractPublishedDateFromUrlOrText(link.url, `${link.label} ${listPage.text.slice(0, 600)}`),
        }));

      articleLinks.push(...links);
    } catch (_) {}

    await sleep(200);
  }

  articleLinks = dedupeByUrl(articleLinks)
    .sort((a, b) => {
      const bd = dateSortValue(b.publishedDate);
      const ad = dateSortValue(a.publishedDate);
      if (bd !== ad) return bd - ad;
      return Number(a.order || 0) - Number(b.order || 0);
    })
    .slice(0, MAX_NEWS_ARTICLES);

  const selectedPages: any[] = [];
  const debug: any[] = [];

  for (const link of articleLinks) {
    if (selectedPages.length >= MAX_SELECTION_EVENTS_PER_TEAM) break;

    try {
      const evaluated = await evaluateCandidatePage(link, "news");
      debug.push(evaluated.debug);

      if (evaluated.accepted) {
        selectedPages.push(evaluated.page);
      }
    } catch (_) {}

    await sleep(200);
  }

  if (selectedPages.length < MAX_SELECTION_EVENTS_PER_TEAM) {
    for (const link of directLinks) {
      if (selectedPages.length >= MAX_SELECTION_EVENTS_PER_TEAM) break;

      try {
        const evaluated = await evaluateCandidatePage(link, "direct");
        debug.push(evaluated.debug);

        if (evaluated.accepted) {
          selectedPages.push(evaluated.page);
        }
      } catch (_) {}

      await sleep(200);
    }
  }

  const finalCandidates = dedupeByUrl(selectedPages)
    .sort((a, b) => {
      const ad = dateSortValue(a.publishedDate || extractEventDate(`${a.title} ${a.text}`));
      const bd = dateSortValue(b.publishedDate || extractEventDate(`${b.title} ${b.text}`));
      if (bd !== ad) return bd - ad;
      return (b.verifiedScore || 0) - (a.verifiedScore || 0);
    })
    .slice(0, MAX_SELECTION_EVENTS_PER_TEAM);

  return {
    topUrl: top.url,
    directLinksCount: directLinks.length,
    newsListsCount: newsListLinks.length,
    articleLinksCount: articleLinks.length,
    pagesCount: 1 + newsListLinks.length + articleLinks.length + directLinks.length,
    selectedPages: finalCandidates,
    topPages: debug.slice(0, 30),
  };
}

function toDateString(d: Date | null) {
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y) return null;
  if (dt.getMonth() + 1 !== m) return null;
  if (dt.getDate() !== d) return null;
  return dt;
}

function extractDates(text: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const dates: Date[] = [];
  const raw = String(text || "");
  let m;

  const jpFull = /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/g;
  while ((m = jpFull.exec(raw)) !== null) {
    const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) dates.push(d);
  }

  const slashFull = /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/g;
  while ((m = slashFull.exec(raw)) !== null) {
    const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) dates.push(d);
  }

  const fiscal = raw.match(/(20\d{2})年度/);
  const baseYear = fiscal ? Number(fiscal[1]) : currentYear;

  const jpShort = /(\d{1,2})月\s*(\d{1,2})日/g;
  while ((m = jpShort.exec(raw)) !== null) {
    const month = Number(m[1]);
    const day = Number(m[2]);

    let d = validDate(baseYear, month, day);

    if (
      d &&
      d.getTime() <
        new Date(currentYear, now.getMonth(), now.getDate()).getTime() -
          1000 * 60 * 60 * 24 * 60
    ) {
      d = validDate(baseYear + 1, month, day);
    }

    if (d) dates.push(d);
  }

  return Array.from(new Map(dates.map((d) => [toDateString(d), d])).values())
    .sort((a, b) => a.getTime() - b.getTime());
}

function extractDeadline(text: string) {
  const lines = compactText(text, 20000).split(/。|\.|\n/).map((v) => v.trim()).filter(Boolean);
  const deadlineLines = lines.filter((line) =>
    line.includes("締切") ||
    line.includes("〆切") ||
    line.includes("申込期限") ||
    line.includes("申し込み期限") ||
    line.includes("応募期限") ||
    line.includes("受付期限") ||
    line.includes("受付締切")
  );

  for (const line of deadlineLines) {
    const dates = extractDates(line);
    if (dates.length > 0) return toDateString(dates[0]);
  }

  return null;
}

function extractEventDate(text: string) {
  const lines = compactText(text, 20000).split(/。|\.|\n/).map((v) => v.trim()).filter(Boolean);
  const eventLines = lines.filter((line) =>
    line.includes("開催日") ||
    line.includes("実施日") ||
    line.includes("日程") ||
    line.includes("セレクション") ||
    line.includes("選考会") ||
    line.includes("練習会") ||
    line.includes("体験会")
  );

  for (const line of eventLines) {
    const dates = extractDates(line);
    if (dates.length > 0) return toDateString(dates[0]);
  }

  const all = extractDates(text);
  return all.length > 0 ? toDateString(all[0]) : null;
}

function extractApplicationStartDate(text: string) {
  const lines = compactText(text, 20000).split(/。|\.|\n/).map((v) => v.trim()).filter(Boolean);
  const startLines = lines.filter((line) =>
    line.includes("受付開始") ||
    line.includes("申込開始") ||
    line.includes("申し込み開始") ||
    line.includes("応募開始")
  );

  for (const line of startLines) {
    const dates = extractDates(line);
    if (dates.length > 0) return toDateString(dates[0]);
  }

  return null;
}

function extractCategories(text: string) {
  const t = String(text || "").toLowerCase();
  const cats = new Set<string>();

  if (t.includes("u-12") || t.includes("u12") || t.includes("小学")) cats.add("u12");
  if (t.includes("u-13") || t.includes("u13") || t.includes("新中1") || t.includes("中学1")) cats.add("u13");
  if (t.includes("u-15") || t.includes("u15") || t.includes("ジュニアユース") || t.includes("中学生")) cats.add("u15");
  if (t.includes("u-18") || t.includes("u18") || t.includes("ユース") || t.includes("高校")) cats.add("u18");
  if (t.includes("社会人")) cats.add("adult");
  if (t.includes("女子") || t.includes("レディース")) cats.add("girls");
  if (t.includes("シニア")) cats.add("senior");

  return Array.from(cats);
}

function extractGender(text: string) {
  const t = String(text || "").toLowerCase();
  if (t.includes("女子") || t.includes("レディース") || t.includes("women") || t.includes("girls")) return "girls";
  if (t.includes("男子") || t.includes("boys")) return "boys";
  return "any";
}

function extractVenue(text: string) {
  const lines = String(text || "").split(/\n|。/).map((v) => v.trim()).filter(Boolean);
  const venueLine = lines.find((line) =>
    line.includes("会場") ||
    line.includes("場所") ||
    line.includes("グラウンド") ||
    line.includes("運動場") ||
    line.includes("競技場")
  );

  if (!venueLine) return { venueName: null, venueAddress: null };

  const cleaned = venueLine
    .replace(/^【?会場】?\s*[:：]?\s*/, "")
    .replace(/^【?場所】?\s*[:：]?\s*/, "")
    .slice(0, 120);

  const addressMatch = cleaned.match(/(東京都|神奈川県|埼玉県|千葉県|茨城県|栃木県|群馬県|山梨県)[^\s　、。)]{3,80}/);

  return {
    venueName: cleaned || null,
    venueAddress: addressMatch?.[0] || null,
  };
}

function extractFee(text: string) {
  const t = String(text || "");

  if (t.includes("無料") || t.includes("参加費無料")) {
    return { feeAmount: 0, feeNote: "無料" };
  }

  const m = t.match(/(?:参加費|費用|料金)[^\d０-９]{0,10}([0-9０-９,，]+)\s*円/);
  if (!m?.[1]) return { feeAmount: null, feeNote: null };

  const amount = Number(
    m[1]
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[，,]/g, "")
  );

  return {
    feeAmount: Number.isFinite(amount) ? amount : null,
    feeNote: m[0].slice(0, 80),
  };
}

function extractTimeRange(text: string) {
  const t = String(text || "");
  const m = t.match(/(\d{1,2})[:：](\d{2})\s*[〜~\-－～]\s*(\d{1,2})[:：](\d{2})/);

  if (!m) return { eventStartTime: null, eventEndTime: null };

  return {
    eventStartTime: `${m[1].padStart(2, "0")}:${m[2]}`,
    eventEndTime: `${m[3].padStart(2, "0")}:${m[4]}`,
  };
}

async function lookupSourceRankFromAliases(text: string) {
  const { data, error } = await supabase
    .from("team_rank_aliases")
    .select("keyword, source_rank");

  if (error) return null;

  const t = String(text || "").toLowerCase();

  for (const row of data || []) {
    const keyword = String(row.keyword || "").toLowerCase();
    if (keyword && t.includes(keyword)) return row.source_rank;
  }

  return null;
}

function inferSourceRank(text: string, organizationName: string | null) {
  const t = `${text} ${organizationName || ""}`.toLowerCase();

  if (
    t.includes("鹿島アントラーズ") ||
    t.includes("水戸ホーリーホック") ||
    t.includes("浦和レッズ") ||
    t.includes("大宮アルディージャ") ||
    t.includes("柏レイソル") ||
    t.includes("ジェフユナイテッド") ||
    t.includes("fc東京") ||
    t.includes("東京ヴェルディ") ||
    t.includes("町田ゼルビア") ||
    t.includes("川崎フロンターレ") ||
    t.includes("横浜f・マリノス") ||
    t.includes("横浜fc") ||
    t.includes("湘南ベルマーレ") ||
    t.includes("栃木sc") ||
    t.includes("ザスパ群馬")
  ) return "j_academy";

  if (t.includes("女子") || t.includes("レディース") || t.includes("women") || t.includes("girls")) return "girls";
  if (t.includes("スクール") || t.includes("school")) return "school";

  if (
    t.includes("ジュニアユース") ||
    t.includes("u-15") ||
    t.includes("u15") ||
    t.includes("クラブユース") ||
    t.includes("ユース") ||
    t.includes("u-18") ||
    t.includes("u18")
  ) return "pref_2";

  if (t.includes("高校") || t.includes("高等学校") || t.includes("中学校") || t.includes("大学")) return "school";
  if (t.includes("academy") || t.includes("アカデミー")) return "pref_2";

  return "district";
}

function displayStatus(eventDate: string | null, deadline: string | null, text: string) {
  const today = toDateString(new Date())!;

  if (
    text.includes("募集終了") ||
    text.includes("受付終了") ||
    text.includes("締め切りました")
  ) return "申込終了";

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";
  if (!eventDate) return "日付未取得";

  return "募集中";
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PROCESSING_STALE_MINUTES = 5;

async function claimHomepages(limit: number) {
  const cutoffIso = new Date(
    Date.now() - RECRAWL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const staleProcessingIso = new Date(
    Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("team_homepages")
    .select("*")
    .eq("homepage_status", "found")
    .not("official_url", "is", null)
    .or(
      `selection_search_status.is.null,selection_search_status.neq.processing,selection_search_checked_at.lt.${staleProcessingIso}`
    )
    .or(
      `last_selection_crawled_at.is.null,last_selection_crawled_at.lt.${cutoffIso}`
    )
    .order("last_selection_crawled_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = data || [];

  if (rows.length > 0) {
    const { error: updateError } = await supabase
      .from("team_homepages")
      .update({
        selection_search_status: "processing",
        selection_search_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", rows.map((r) => r.id));

    if (updateError) throw updateError;
  }

  return rows;
}

async function markHomepage(homepage: any, status: string, reason: string) {
  const { error } = await supabase
    .from("team_homepages")
    .update({
      selection_search_status: status,
      selection_search_reason: reason.slice(0, 1000),
      selection_search_checked_at: nowIso(),
      last_selection_crawled_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", homepage.id);

  if (error) throw error;
}

async function upsertSelectionPage(homepage: any, bestPage: any, pagesCount: number, topPages: any[]) {
  if (await isBlacklistedSelectionUrl(bestPage.url)) {
    return {
      status: "blacklisted",
      verifiedScore: bestPage.verifiedScore || 0,
      bestUrl: bestPage.url,
      title: bestPage.title || "",
      skipped: true,
    };
  }
  
  const pageText = bestPage.text || "";
  const title = bestPage.title || `${homepage.team_name} セレクション情報`;
  const fullText = compactText(`${title} ${homepage.team_name || ""} ${pageText}`, 40000);

  const eventDate = extractEventDate(fullText);
  const deadline = extractDeadline(fullText);
  const applicationStartDate = extractApplicationStartDate(fullText);
  const categories = extractCategories(fullText);
  const gender = extractGender(fullText);
  const statusText = displayStatus(eventDate, deadline, fullText);
  const venue = extractVenue(fullText);
  const fee = extractFee(fullText);
  const timeRange = extractTimeRange(fullText);

  const sourceRank =
    (await lookupSourceRankFromAliases(`${fullText} ${homepage.team_name || ""}`)) ||
    inferSourceRank(fullText, homepage.team_name || title);

  const hash = await sha256(`${homepage.id}:${bestPage.url}`);

  const { data: lockedRows, error: lockedError } = await supabase
    .from("selection_events")
    .select("id")
    .eq("manual_locked", true)
    .ilike("memo", `%homepage_id:${homepage.id}%`)
    .limit(1);

  if (lockedError) throw lockedError;

  if ((lockedRows || []).length > 0) {
    return {
      status: "manual_locked",
      verifiedScore: bestPage.verifiedScore || 0,
      bestUrl: bestPage.url,
      title,
      skipped: true,
    };
  }

  const eventRow = {
    source_id: null,
    crawl_page_id: null,
    title,
    organization_name: homepage.team_name || title || null,
    organization_type: "club_team",
    target_categories: categories,
    gender,
    prefecture: homepage.prefecture || null,
    city: null,
    area: homepage.prefecture || null,
    venue_name: venue.venueName,
    venue_address: venue.venueAddress,
    event_date: eventDate,
    event_start_time: timeRange.eventStartTime,
    event_end_time: timeRange.eventEndTime,
    application_start_date: applicationStartDate,
    application_deadline: deadline,
    fee_amount: fee.feeAmount,
    fee_note: fee.feeNote,
    source_url: homepage.official_url,
    official_url: bestPage.url,
    summary: cleanForDb(compactText(pageText, 180), 180),
    description: cleanForDb(compactText(pageText, 800), 800),
    raw_text: cleanForDb(pageText, 20000),
    memo: cleanForDb(
      `homepage_id:${homepage.id}\nteam_directory_id:${homepage.team_directory_id || ""}\nstart_url:${homepage.official_url}\nbest_url:${bestPage.url}\ncandidate_type:${bestPage.candidateType || ""}\npublished_date:${bestPage.publishedDate || ""}\npages_count:${pagesCount}\ntop_pages:${JSON.stringify(topPages).slice(0, 3000)}`,
      4000,
    ),
    image_url: null,
    fetched_at: nowIso(),
    content_hash: hash,
    status: "published",
    display_status: statusText,
    is_featured: false,
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    source_type: "team_homepage_selection_page",
    pdf_url: null,
    instagram_url: null,
    external_url: bestPage.url,
    extraction_status: "verified",
    extraction_error: null,
    duplicate_key: hash,
    source_rank: sourceRank,
  };

  const { data: existingRows, error: existingError } = await supabase
    .from("selection_events")
    .select("id, manual_locked")
    .eq("duplicate_key", hash)
    .limit(1);

  if (existingError) throw existingError;

  const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

  if (existing?.id) {
    if (existing.manual_locked) {
      return {
        status: "manual_locked",
        verifiedScore: bestPage.verifiedScore || 0,
        bestUrl: bestPage.url,
        title,
        skipped: true,
      };
    }

    const { error } = await supabase
      .from("selection_events")
      .update(eventRow)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("selection_events")
      .insert({ ...eventRow, created_at: nowIso() });

    if (error) throw error;
  }

  return {
    status: "accepted",
    verifiedScore: bestPage.verifiedScore || 0,
    bestUrl: bestPage.url,
    title,
    eventDate,
    deadline,
    displayStatus: statusText,
    categories,
    sourceRank,
  };
}

async function runOne(homepage: any) {
  try {
    const found = await collectCandidatePages(homepage);

    if (!found.selectedPages || found.selectedPages.length === 0) {
      await markHomepage(
        homepage,
        "selection_not_found",
        `no_selection_pages; direct:${found.directLinksCount},newsLists:${found.newsListsCount},articles:${found.articleLinksCount}`,
      );

      return {
        id: homepage.id,
        team_name: homepage.team_name,
        url: homepage.official_url,
        status: "rejected",
        reason: "no_selection_pages",
        ...found,
      };
    }

    const saved = [];

    for (const page of found.selectedPages) {
      const r = await upsertSelectionPage(homepage, page, found.pagesCount, found.topPages);

      if (r.status !== "blacklisted" && r.status !== "manual_locked") {
        saved.push(r);
      }
    }

    if (saved.length === 0) {
      await markHomepage(
        homepage,
        "selection_not_found",
        `all_candidates_skipped; pages:${found.pagesCount}`,
      );

      return {
        id: homepage.id,
        team_name: homepage.team_name,
        startUrl: homepage.official_url,
        status: "rejected",
        reason: "all_candidates_skipped",
        ...found,
      };
    }

    await markHomepage(
      homepage,
      "selection_found",
      `saved:${saved.length},best_urls:${saved.map((x) => x.bestUrl).join("|")},pages:${found.pagesCount}`,
    );

    return {
      id: homepage.id,
      team_name: homepage.team_name,
      startUrl: homepage.official_url,
      host: hostOf(homepage.official_url),
      status: "accepted",
      savedCount: saved.length,
      saved,
      ...found,
    };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e);

    await markHomepage(homepage, "selection_error", message);

    return {
      id: homepage.id,
      team_name: homepage.team_name,
      url: homepage.official_url,
      status: "error",
      error: message,
    };
  }
}

serve(async (req) => {
  console.log("REQUEST RECEIVED NEWS-FIRST FALLBACK-DIRECT v5 ONE-BY-ONE");

  try {
    const body = await req.json().catch(() => ({}));
    const maxJobs = Math.min(Number(body.maxJobs || body.batchSize || body.limit || MAX_ROWS), MAX_ROWS);
    const startedAt = Date.now();

    const results = [];
    let claimed = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalErrors = 0;
    let totalSavedEvents = 0;
    let stoppedReason = "completed";

    while (claimed < maxJobs) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        stoppedReason = "time_limit";
        break;
      }

      const remainingMs = MAX_RUN_MS - (Date.now() - startedAt);

      if (remainingMs < 8000) {
        stoppedReason = "not_enough_time_for_next";
        break;
      }

      const homepages = await claimHomepages(1);

      if (homepages.length === 0) {
        stoppedReason = "no_more_homepages";
        break;
      }

      claimed++;

      const homepage = homepages[0];
      const r = await runOne(homepage);
      results.push(r);

      if (r.status === "accepted") {
        totalAccepted++;
        totalSavedEvents += Number(r.savedCount || 0);
      } else if (r.status === "rejected") {
        totalRejected++;
      } else {
        totalErrors++;
      }

      await sleep(300);
    }

    return json({
      ok: true,
      mode: "crawl-team-homepages-news-first-fallback-direct-selection-pages-v5-one-by-one",
      maxJobs,
      maxRunMs: MAX_RUN_MS,
      elapsedMs: Date.now() - startedAt,
      stoppedReason,
      maxDirectCandidates: MAX_DIRECT_CANDIDATES,
      maxNewsLists: MAX_NEWS_LISTS,
      maxNewsArticles: MAX_NEWS_ARTICLES,
      maxSelectionEventsPerTeam: MAX_SELECTION_EVENTS_PER_TEAM,
      claimed,
      totalAccepted,
      totalRejected,
      totalErrors,
      totalSavedEvents,
      results,
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e);

    return json({ ok: false, error: message }, 500);
  }
});