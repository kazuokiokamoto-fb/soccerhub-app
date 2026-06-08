// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TARGET_SOURCE_TYPES = [
  "summary_extracted_link",
  "duckduckgo_html_refined",
];

const SUMMARY_DOMAINS = [
  "junior-soccer.jp",
  "green-card.co.jp",
  "footballnavi.jp",
  "sgrum.com",
  "labola.jp",
  "net-menber.com",
  "circle-book.com",
  "jmty.jp",
  "sposuru.com",
  "clubkatsudo.com",
];

const BAD_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "lin.ee",
  "maps.google",
  "google.com",
  "forms.gle",
  "docs.google.com",
  "drive.google.com",
  "calendar.google.com",
  "gmail.com",
  "yahoo.co.jp",
  "bing.com",
  "note.com",
  "ameblo.jp",
  "blog.goo.ne.jp",
  "livedoor.blog",
  "fc2.com",
  "wikipedia.org",
];

const BAD_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".mov",
  ".avi",
];

const BAD_URL_PARTS = [
  "/contact",
  "/inquiry",
  "/toiawase",
  "/privacy",
  "/company",
  "/about",
  "/access",
  "/map",
  "/schedule",
  "/calendar",
  "/result",
  "/results",
  "/category/",
  "/tag/",
  "/archive/",
  "/archives/",
  "/author/",
  "/feed",
  "/rss",
  "mailto:",
  "tel:",
];

const TEAM_HINT_WORDS = [
  "fc",
  "f.c",
  "sc",
  "サッカー",
  "soccer",
  "football",
  "フットボール",
  "クラブ",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "u-12",
  "u12",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "academy",
  "アカデミー",
  "少年団",
  "レディース",
  "女子",
];

const SELECTION_HINT_WORDS = [
  "セレクション",
  "選考会",
  "トライアウト",
  "tryout",
  "selection",
  "練習会",
  "体験会",
  "体験練習会",
  "練習参加",
  "練習体験",
  "選手募集",
  "募集",
  "入団",
  "入部",
  "新入団",
];

const MAX_SOURCE_ROWS = 30;
const FETCH_TIMEOUT_MS = 12000;

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

function originOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return "";
  }
}

function normalizeUrl(url: string, base?: string) {
  try {
    const u = new URL(url, base);
    u.hash = "";

    if (u.protocol !== "http:" && u.protocol !== "https:") return "";

    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_content");
    u.searchParams.delete("utm_term");
    u.searchParams.delete("fbclid");
    u.searchParams.delete("gclid");

    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function isSummaryDomain(url: string) {
  const h = hostOf(url);
  return SUMMARY_DOMAINS.some((d) => h.includes(d));
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

function getTitle(html: string, fallback: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);

  return String(fallback || "").slice(0, 120);
}

function extractAnchorLinks(html: string, baseUrl: string) {
  const links: any[] = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const rawHref = decodeHtml(m[1] || "").trim();
    const anchorText = stripTags(m[2] || "").slice(0, 200);
    const url = normalizeUrl(rawHref, baseUrl);

    if (!url) continue;

    links.push({
      url,
      anchorText,
    });
  }

  return links;
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
    if (
      !ct.includes("text/html") &&
      !ct.includes("application/xhtml+xml") &&
      !ct.includes("text/plain")
    ) {
      throw new Error(`not html: ${ct}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function scoreOfficialLink(link: any, sourceUrl: string, pageText: string) {
  const url = link.url || "";
  const host = hostOf(url);
  const sourceHost = hostOf(sourceUrl);
  const anchorText = link.anchorText || "";
  const hay = `${url} ${host} ${anchorText}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (!url || !host) return { score: -999, reasons: ["invalid_url"] };
  if (host === sourceHost) return { score: -999, reasons: ["same_domain"] };
  if (isSummaryDomain(url)) return { score: -999, reasons: ["summary_domain"] };
  if (isBadUrl(url)) return { score: -999, reasons: ["bad_url"] };

  if (includesAny(hay, TEAM_HINT_WORDS)) {
    score += 50;
    reasons.push("team_hint");
  }

  if (includesAny(hay, SELECTION_HINT_WORDS)) {
    score += 50;
    reasons.push("selection_hint");
  }

  if (
    anchorText.includes("公式") ||
    anchorText.toLowerCase().includes("official") ||
    anchorText.includes("ホームページ") ||
    anchorText.includes("HP") ||
    anchorText.includes("サイト")
  ) {
    score += 60;
    reasons.push("official_anchor");
  }

  if (
    hay.includes("fc") ||
    hay.includes("sc") ||
    hay.includes("u15") ||
    hay.includes("u-15") ||
    hay.includes("academy") ||
    hay.includes("club")
  ) {
    score += 20;
    reasons.push("url_team_like");
  }

  if (
    url.includes("jimdo") ||
    url.includes("jimdofree") ||
    url.includes("wixsite") ||
    url.includes("amebaownd") ||
    url.includes("webu.jp")
  ) {
    score += 15;
    reasons.push("common_team_site_builder");
  }

  if (
    anchorText.includes("お問い合わせ") ||
    anchorText.includes("問合せ") ||
    anchorText.includes("アクセス") ||
    anchorText.includes("地図")
  ) {
    score -= 30;
    reasons.push("bad_anchor");
  }

  if (
    url.includes("/contact") ||
    url.includes("/privacy") ||
    url.includes("/company") ||
    url.includes("/access")
  ) {
    score -= 50;
    reasons.push("bad_path");
  }

  if (score === 0 && includesAny(pageText, SELECTION_HINT_WORDS)) {
    score += 10;
    reasons.push("source_page_selection_related");
  }

  return { score, reasons };
}

function pickBestOfficialLinks(links: any[], sourceUrl: string, pageText: string) {
  const byHost = new Map<string, any>();

  for (const link of links) {
    const scored = scoreOfficialLink(link, sourceUrl, pageText);
    if (scored.score < 20) continue;

    const host = hostOf(link.url);
    if (!host) continue;

    const existing = byHost.get(host);

    const row = {
      url: originOf(link.url) || link.url,
      originalUrl: link.url,
      host,
      anchorText: link.anchorText || "",
      score: scored.score,
      reasons: scored.reasons,
    };

    if (!existing || row.score > existing.score) {
      byHost.set(host, row);
    }
  }

  return Array.from(byHost.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

async function claimSummaryRows(limit: number) {
  const { data, error } = await supabase
    .from("selection_page_candidates")
    .select("*")
    .gte("score", 20)
    .or("official_links_status.is.null,official_links_status.eq.unchecked,official_links_status.eq.pending")
    .order("score", { ascending: false })
    .limit(limit * 50);

  if (error) throw error;

  const rows = [];

  for (const row of data || []) {
    const url = row.url || "";

    if (!url) continue;
    if (isBadUrl(url)) continue;
    if (!isSummaryDomain(url)) continue;

    rows.push(row);

    if (rows.length >= limit) break;
  }

  if (rows.length > 0) {
    const { error: updateError } = await supabase
      .from("selection_page_candidates")
      .update({
        official_links_status: "processing",
        official_links_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", rows.map((r) => r.id));

    if (updateError) {
      throw new Error(`claim update failed: ${updateError.message}`);
    }
  }

  return rows;
}

async function insertCandidateIfMissing(sourceRow: any, official: any, sourcePageTitle: string, sourcePageText: string) {
  const url = official.url;

  const { data: existing, error: existingError } = await supabase
    .from("selection_page_candidates")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") throw existingError;

  if (existing?.id) {
    return {
      inserted: false,
      existingId: existing.id,
      url,
    };
  }

  const titleBase =
    official.anchorText ||
    sourceRow.title ||
    sourcePageTitle ||
    "公式サイト候補";

  const snippet = compactText(
    `summary_source:${sourceRow.url} anchor:${official.anchorText} reasons:${official.reasons.join(",")}`,
    500,
  );

  const insertRow = {
    query: cleanForDb(
      `${sourceRow.query || sourceRow.title || official.anchorText || "公式サイト"} ${official.url}`,
      500,
    ),
    
    title: cleanForDb(titleBase, 250),
    url,
    snippet: cleanForDb(snippet, 1000),
    source_type: "official_link_from_summary",
    score: Math.max(28, Math.min(official.score + Number(sourceRow.score || 0), 300)),
    prefecture: sourceRow.prefecture || null,
    municipality: sourceRow.municipality || null,
    verified_status: "unchecked",
    verified_score: null,
    verified_reason: null,
    checked_at: null,
    page_text: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("selection_page_candidates")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) throw error;

  return {
    inserted: true,
    id: data?.id,
    url,
  };
}

async function processOne(row: any) {
  try {
    const html = await fetchHtml(row.url);
    const title = getTitle(html, row.title || "");
    const pageText = stripTags(html);
    const links = extractAnchorLinks(html, row.url);
    const officialLinks = pickBestOfficialLinks(links, row.url, pageText);

    const insertedResults = [];

    for (const official of officialLinks) {
      const r = await insertCandidateIfMissing(row, official, title, pageText);
      insertedResults.push({
        ...r,
        score: official.score,
        anchorText: official.anchorText,
        reasons: official.reasons,
      });
    }

    const insertedCount = insertedResults.filter((r) => r.inserted).length;
    const existingCount = insertedResults.filter((r) => !r.inserted).length;

    const { error } = await supabase
      .from("selection_page_candidates")
      .update({
        official_links_status: "done",
        official_links_checked_at: nowIso(),
        official_links_count: officialLinks.length,
        official_links_inserted_count: insertedCount,
        official_links_reason: `links:${links.length},official:${officialLinks.length},inserted:${insertedCount},existing:${existingCount}`,
        updated_at: nowIso(),
      })
      .eq("id", row.id);

    if (error) throw error;

    return {
      status: "done",
      id: row.id,
      url: row.url,
      title,
      linksCount: links.length,
      officialLinksCount: officialLinks.length,
      insertedCount,
      existingCount,
      officialLinks: officialLinks.slice(0, 10),
      insertedResults: insertedResults.slice(0, 10),
    };
  } catch (e) {
    const { error } = await supabase
      .from("selection_page_candidates")
      .update({
        official_links_status: "error",
        official_links_checked_at: nowIso(),
        official_links_reason: String(e?.message || e).slice(0, 500),
        updated_at: nowIso(),
      })
      .eq("id", row.id);

    if (error) console.error("official link error update failed", error);

    return {
      status: "error",
      id: row.id,
      url: row.url,
      error: String(e?.message || e),
    };
  }
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const batchSize = Math.min(Number(body.batchSize || body.limit || 5), MAX_SOURCE_ROWS);
    const rows = await claimSummaryRows(batchSize);

    const results = [];
    let totalDone = 0;
    let totalErrors = 0;
    let totalInserted = 0;
    let totalExisting = 0;

    for (const row of rows) {
      const r = await processOne(row);
      results.push(r);

      if (r.status === "done") {
        totalDone++;
        totalInserted += Number(r.insertedCount || 0);
        totalExisting += Number(r.existingCount || 0);
      } else {
        totalErrors++;
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return json({
      ok: true,
      mode: "extract-official-links-from-summary",
      batchSize,
      totalClaimed: rows.length,
      totalDone,
      totalErrors,
      totalInserted,
      totalExisting,
      results,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
      },
      500,
    );
  }
});