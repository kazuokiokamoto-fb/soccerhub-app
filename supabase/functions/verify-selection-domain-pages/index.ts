// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TARGET_SOURCE_TYPES = [
  "duckduckgo_html_refined",
  "summary_extracted_link",
  "official_link_from_summary",
];

const MAX_PAGES_PER_DOMAIN = 180;
const MAX_QUEUE = 600;
const FETCH_TIMEOUT_MS = 12000;

const BAD_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
  "junior-soccer.jp",
  "jmty.jp",
  "labola.jp",
  "net-menber.com",
  "circle-book.com",
  "求人ボックス.com",
  "mykoho.jp",
  "commu-chika.jp",
  "clubkatsudo.com",
  "sposuru.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "maps.google",
  "google.com",
  "forms.gle",
];

const BAD_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4", ".mov", ".avi",
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
  "選手募集",
  "新入団",
  "入団",
  "入部",
  "募集",
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
];

const BAD_URL_PARTS = [
  "/category/",
  "/tag/",
  "/archive/",
  "/archives/",
  "/author/",
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
  "/news/page/",
  "?ym=",
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
    if ((u.protocol !== "http:") && (u.protocol !== "https:")) return "";
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
  if (BAD_URL_PARTS.some((x) => u.includes(x))) return true;
  return false;
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

function looksMojibake(text: string) {
  return /�/.test(String(text || ""));
}

function getTitle(html: string, fallback: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);

  return String(fallback || "セレクション情報").slice(0, 120);
}

function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const href = decodeHtml(m[1] || "").trim();
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) continue;
    links.add(canonicalUrl(normalized));
  }

  return Array.from(links);
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
  };

  try {
    const res = await fetch(url, { signal: controller.signal, headers });
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

  const strong = countMatches(text, STRONG_WORDS);
  const detail = countMatches(text, DETAIL_WORDS);
  const soccer = countMatches(text, SOCCER_WORDS);
  const negative = countMatches(text, NEGATIVE_WORDS);

  let score = 0;

  score += strong.count * 32;
  score += detail.count * 18;
  score += soccer.count * 5;

  if (includesAny(title, STRONG_WORDS)) score += 45;
  if (includesAny(title, DETAIL_WORDS)) score += 20;

  if (includesAny(url, ["selection", "tryout"])) score += 25;

  // 詳細ページ・募集ページを加点
  if (includesAny(url, [
    "recruit",
    "recruitment",
    "member",
    "entry",
    "form",
    "trial",
    "taiken",
    "nyubu",
    "join",
    "boshu",
    "selection",
    "tryout",
  ])) {
    score += 35;
  }

  if (includesAny(title, [
    "募集",
    "申込",
    "申し込み",
    "入部",
    "体験",
    "セレクション",
    "選考会",
    "練習会",
  ])) {
    score += 35;
  }

  score -= negative.count * 25;

  if (page.text.length < 250) score -= 35;
  if (page.text.length > 1200) score += 15;

  // トップページは、全ページの要素が混ざって勝ちやすいので強めに減点
  if (
    path === "/" ||
    path === "" ||
    path === "/index.html" ||
    path === "/index.htm" ||
    path === "/index"
  ) {
    score -= 120;
  }

  // お知らせ・最新情報・一覧ページは詳細ページではないことが多いので減点
  if (includesAny(title, ["最新情報", "news", "お知らせ", "トップ", "home"])) {
    score -= 80;
  }

  if (includesAny(text, ["ニュース一覧", "記事一覧", "一覧"])) score -= 35;
  if (includesAny(text, ["開催日", "対象", "会場", "申込"])) score += 40;
  if (includesAny(text, ["募集終了", "受付終了", "締め切りました"])) score -= 25;

  if (strong.count === 0) score -= 80;
  if (soccer.count === 0) score -= 30;

  return {
    score,
    strongMatched: strong.matched,
    detailMatched: detail.matched,
    soccerMatched: soccer.matched,
    negativeMatched: negative.matched,
  };
}

async function crawlDomain(startUrl: string) {
  const start = normalizeUrl(startUrl);
  const startHost = hostOf(start);
  if (!start || !startHost) throw new Error("invalid start url");
  if (isBadUrl(start)) throw new Error("bad start url");

  const queue = [canonicalUrl(start)];
  const queued = new Set(queue);
  const visited = new Set<string>();
  const pages: any[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES_PER_DOMAIN && visited.size < MAX_QUEUE) {
    const url = queue.shift()!;
    if (!url || visited.has(url)) continue;
    visited.add(url);

    if (isBadUrl(url)) continue;
    if (hostOf(url) !== startHost) continue;

    try {
      const html = await fetchHtml(url);
      const title = getTitle(html, url);
      const text = stripTags(html);

      if (!looksMojibake(title) && text.length >= 80) {
        pages.push({ url, title, text, html });
      }

      const links = extractLinks(html, url);

      for (const link of links) {
        if (queued.size >= MAX_QUEUE) break;
        if (queued.has(link)) continue;
        if (visited.has(link)) continue;
        if (isBadUrl(link)) continue;
        if (hostOf(link) !== startHost) continue;

        queued.add(link);
        queue.push(link);
      }
    } catch (_) {
      // ページ単位のfetch失敗は無視
    }

    await new Promise((resolve) => setTimeout(resolve, 180));
  }

  return pages;
}

async function findBestSelectionPage(candidate: any) {
  const pages = await crawlDomain(candidate.url);

  const scored = pages
    .map((page) => {
      const s = scorePage(page);
      return { ...page, verifiedScore: s.score, scoreDetail: s };
    })
    .sort((a, b) => b.verifiedScore - a.verifiedScore);

  const best = scored[0] || null;

  return {
    best,
    pagesCount: pages.length,
    topPages: scored.slice(0, 10).map((p) => ({
      url: p.url,
      title: p.title,
      verifiedScore: p.verifiedScore,
      strongMatched: p.scoreDetail.strongMatched,
      detailMatched: p.scoreDetail.detailMatched,
      negativeMatched: p.scoreDetail.negativeMatched,
    })),
  };
}

function toDateString(d: Date | null) {
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPastDate(date: string | null) {
  if (!date) return false;
  const today = toDateString(new Date())!;
  return date < today;
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

    let y = baseYear;
    let d = validDate(y, month, day);

    if (
      d &&
      d.getTime() <
        new Date(currentYear, now.getMonth(), now.getDate()).getTime() -
          1000 * 60 * 60 * 24 * 60
    ) {
      d = validDate(y + 1, month, day);
    }

    if (d) dates.push(d);
  }

  return Array.from(
    new Map(dates.map((d) => [toDateString(d), d])).values(),
  ).sort((a, b) => a.getTime() - b.getTime());
}

function extractDeadline(text: string) {
  const compact = compactText(text, 20000);
  const lines = compact.split(/。|\.|\n/).map((v) => v.trim()).filter(Boolean);

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
  const compact = compactText(text, 20000);
  const lines = compact.split(/。|\.|\n/).map((v) => v.trim()).filter(Boolean);

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

  const all = extractDates(compact);
  return all.length > 0 ? toDateString(all[0]) : null;
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

  if (
    t.includes("女子") ||
    t.includes("レディース") ||
    t.includes("women") ||
    t.includes("girls")
  ) return "girls";

  if (t.includes("男子") || t.includes("boys")) return "boys";

  return "any";
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

async function claimCandidates(limit: number) {
  const fetchLimit = Math.max(limit * 20, 60);

  const { data, error } = await supabase
    .from("selection_page_candidates")
    .select("*")
    .in("source_type", TARGET_SOURCE_TYPES)
    .gte("score", 28)
    .or("verified_status.is.null,verified_status.eq.pending,verified_status.eq.unchecked")
    .order("score", { ascending: false })
    .limit(fetchLimit);

  if (error) throw error;

  const acceptedRows = [];
  const rejectedIds = [];
  const seenHosts = new Set<string>();

  for (const row of data || []) {
    const url = row?.url || "";
    const host = hostOf(url);

    if (!url || !host || isBadUrl(url)) {
      rejectedIds.push(row.id);
      continue;
    }

    if (seenHosts.has(host)) {
      rejectedIds.push(row.id);
      continue;
    }

    seenHosts.add(host);
    acceptedRows.push(row);

    if (acceptedRows.length >= limit) break;
  }

  if (rejectedIds.length > 0) {
    const { error: rejectError } = await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "rejected",
        verified_score: 0,
        verified_reason: "domain_pre_reject_bad_or_duplicate_host",
        checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", rejectedIds);

    if (rejectError) throw new Error(`pre reject update failed: ${rejectError.message}`);
  }

  if (acceptedRows.length > 0) {
    const { error: claimError } = await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "processing",
        verified_reason: "domain_processing",
        checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", acceptedRows.map((r) => r.id));

    if (claimError) throw new Error(`claim update failed: ${claimError.message}`);
  }

  return acceptedRows;
}

async function rejectCandidate(candidate: any, reason: string, verifiedScore: number, pageText = "") {
  const { error } = await supabase
    .from("selection_page_candidates")
    .update({
      verified_status: "rejected",
      verified_score: verifiedScore,
      verified_reason: reason,
      checked_at: nowIso(),
      page_text: cleanForDb(pageText, 15000),
      updated_at: nowIso(),
    })
    .eq("id", candidate.id);

  if (error) throw new Error(`reject update failed: ${error.message}`);

  return { status: "rejected", reason, verifiedScore };
}

async function upsertBestPage(candidate: any, bestPage: any, pagesCount: number, topPages: any[]) {
  const pageText = bestPage.text || "";
  const title = bestPage.title || candidate.title || "セレクション情報";
  const fullText = compactText(`${title} ${candidate.title || ""} ${candidate.snippet || ""} ${pageText}`, 40000);

  if (looksMojibake(title)) {
    return await rejectCandidate(candidate, "mojibake_best_title", bestPage.verifiedScore || 0, pageText);
  }

  if (!includesAny(fullText, STRONG_WORDS)) {
    return await rejectCandidate(candidate, "best_page_no_selection_words", bestPage.verifiedScore || 0, pageText);
  }

  if ((bestPage.verifiedScore || 0) < 70) {
    return await rejectCandidate(candidate, "best_page_low_score", bestPage.verifiedScore || 0, pageText);
  }

  const eventDate = extractEventDate(fullText);
  const deadline = extractDeadline(fullText);

  if (isPastDate(eventDate) && (!deadline || isPastDate(deadline))) {
    return await rejectCandidate(candidate, `past_event_date:${eventDate}`, bestPage.verifiedScore || 0, pageText);
  }

  const categories = extractCategories(fullText);
  const gender = extractGender(fullText);
  const statusText = displayStatus(eventDate, deadline, fullText);

  const sourceRank =
    (await lookupSourceRankFromAliases(`${fullText} ${candidate.title || ""} ${title}`)) ||
    inferSourceRank(fullText, candidate.title || title);

  const hash = await sha256(`${bestPage.url}`);

  const eventRow = {
    source_id: null,
    crawl_page_id: null,
    title: title || candidate.title || "セレクション情報",
    organization_name: candidate.title || title || null,
    organization_type: "club_team",
    target_categories: categories,
    gender,
    prefecture: candidate.prefecture || null,
    city: candidate.municipality || null,
    area: [candidate.prefecture, candidate.municipality].filter(Boolean).join(" ") || null,
    venue_name: null,
    venue_address: null,
    event_date: eventDate,
    event_start_time: null,
    event_end_time: null,
    application_start_date: null,
    application_deadline: deadline,
    fee_amount: null,
    fee_note: null,
    source_url: candidate.url,
    official_url: bestPage.url,
    summary: cleanForDb(compactText(pageText, 180), 180),
    description: cleanForDb(compactText(pageText, 800), 800),
    raw_text: cleanForDb(pageText, 20000),
    memo: cleanForDb(
      `candidate_id:${candidate.id}\nstart_url:${candidate.url}\nbest_url:${bestPage.url}\npages_count:${pagesCount}\ntop_pages:${JSON.stringify(topPages).slice(0, 3000)}`,
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
    source_type: "verified_domain_best_page",
    pdf_url: null,
    instagram_url: null,
    external_url: bestPage.url,
    extraction_status: "verified",
    extraction_error: null,
    duplicate_key: hash,
    source_rank: sourceRank,
  };

  const { data: existing, error: existingError } = await supabase
    .from("selection_events")
    .select("id")
    .eq("source_url", candidate.url)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingError && existingError.code !== "PGRST116") throw existingError;

  if (existing?.id) {
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

  const { error: acceptedError } = await supabase
    .from("selection_page_candidates")
    .update({
      verified_status: "accepted",
      verified_score: bestPage.verifiedScore || 0,
      verified_reason: `domain_best_page:${bestPage.url},pages:${pagesCount},event_date:${eventDate || "none"},deadline:${deadline || "none"},rank:${sourceRank}`,
      checked_at: nowIso(),
      page_text: cleanForDb(pageText, 15000),
      updated_at: nowIso(),
    })
    .eq("id", candidate.id);

  if (acceptedError) throw new Error(`accepted update failed: ${acceptedError.message}`);

  return {
    status: "accepted",
    verifiedScore: bestPage.verifiedScore || 0,
    bestUrl: bestPage.url,
    eventDate,
    deadline,
    displayStatus: statusText,
    categories,
    sourceRank,
    pagesCount,
    topPages,
  };
}

async function runOne(candidate: any) {
  try {
    const found = await findBestSelectionPage(candidate);

    if (!found.best) {
      return await rejectCandidate(candidate, "no_pages_crawled_in_domain", 0, "");
    }

    const result = await upsertBestPage(candidate, found.best, found.pagesCount, found.topPages);

    return {
      id: candidate.id,
      title: candidate.title,
      startUrl: candidate.url,
      host: hostOf(candidate.url),
      candidateScore: candidate.score,
      ...result,
    };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e);

    const { error } = await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "error",
        verified_score: 0,
        verified_reason: message.slice(0, 500),
        checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", candidate.id);

    if (error) console.error("error update failed", error);

    return {
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      status: "error",
      error: message,
    };
  }
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const batchSize = Math.min(Number(body.batchSize || body.limit || 2), 5);
    const maxBatches = Math.min(Number(body.maxBatches || 1), 5);

    const results = [];
    let totalClaimed = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalErrors = 0;

    for (let batch = 0; batch < maxBatches; batch++) {
      const candidates = await claimCandidates(batchSize);

      if (candidates.length === 0) break;

      totalClaimed += candidates.length;

      for (const candidate of candidates) {
        const r = await runOne(candidate);
        results.push(r);

        if (r.status === "accepted") totalAccepted++;
        else if (r.status === "rejected") totalRejected++;
        else totalErrors++;

        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    return json({
      ok: true,
      mode: "verify-selection-domain-pages",
      batchSize,
      maxBatches,
      maxPagesPerDomain: MAX_PAGES_PER_DOMAIN,
      totalClaimed,
      totalAccepted,
      totalRejected,
      totalErrors,
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