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
];

const BAD_DOMAINS = [
  "instagram.com",
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

const SUMMARY_DOMAINS = [
  "juniorsoccer-news.com",
  "soccerplayer.net",
  "goal-selection.net",
  "soccer-selection.com",
  "j-s-weekly.com",
  "junior-soccer.jp",
];

const STRONG_WORDS = [
  "セレクション",
  "選考会",
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

const EVENT_PAGE_WORDS = [
  "セレクション",
  "選考会",
  "体験練習会",
  "体験会",
  "練習会",
  "練習参加",
  "練習体験",
  "選手募集",
  "新入団",
  "入団",
  "入部",
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

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function isLikelyTopPage(url: string) {
  const p = pathOf(url);
  return p === "/" || p === "" || p === "/index.html" || p === "/index.htm" || p === "/index";
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function matchedWords(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.filter((w) => t.includes(w.toLowerCase()));
}

function isBadDomain(url: string) {
  const h = hostOf(url);
  return BAD_DOMAINS.some((d) => h.includes(d));
}

function isSummaryDomain(url: string) {
  const h = hostOf(url);
  return SUMMARY_DOMAINS.some((d) => h.includes(d));
}

function getTitle(html: string, fallback: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);

  return String(fallback || "セレクション情報").slice(0, 120);
}

function toDateString(d: Date | null) {
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const unique = Array.from(
    new Map(dates.map((d) => [toDateString(d), d])).values(),
  ).sort((a, b) => a.getTime() - b.getTime());

  return unique;
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
  ) {
    return "girls";
  }

  if (t.includes("男子") || t.includes("boys")) {
    return "boys";
  }

  return "any";
}

function displayStatus(eventDate: string | null, deadline: string | null, text: string) {
  const today = toDateString(new Date())!;

  if (
    text.includes("募集終了") ||
    text.includes("受付終了") ||
    text.includes("締め切りました")
  ) {
    return "申込終了";
  }

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";
  if (!eventDate) return "日程未定";

  return "募集中";
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
  };

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    if (res.ok) return await res.text();

    if (url.startsWith("http://")) {
      const httpsUrl = url.replace("http://", "https://");

      const retry = await fetch(httpsUrl, {
        signal: controller.signal,
        headers,
      });

      if (retry.ok) return await retry.text();

      throw new Error(`fetch failed ${res.status}, retry https failed ${retry.status}`);
    }

    throw new Error(`fetch failed ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function claimCandidates(limit: number) {
  const { data, error } = await supabase
    .from("selection_page_candidates")
    .select("*")
    .in("source_type", TARGET_SOURCE_TYPES)
    .gte("score", 100)
    .or("verified_status.is.null,verified_status.eq.pending,verified_status.eq.unchecked")
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).filter((row) => {
    if (!row?.url) return false;

    if (isBadDomain(row.url)) return false;

    const title = String(row.title || "");
    const lowerTitle = title.toLowerCase();
    const url = String(row.url || "").toLowerCase();

    if (
      title.includes("お問い合わせ") ||
      title.includes("問合せ") ||
      title.includes("問い合わせ") ||
      lowerTitle.includes("contact") ||
      title.includes("Instagram") ||
      title.includes("インスタ") ||
      title.includes("Facebook") ||
      title.includes("公式サイト") ||
      title.includes("オフィシャルサイト") ||
      title.includes("公式Web") ||
      title.endsWith("HP")
    ) {
      return false;
    }

    if (
      url.includes("/contact") ||
      url.includes("/inquiry") ||
      url.includes("/toiawase")
    ) {
      return false;
    }

    if (isLikelyTopPage(row.url)) return false;

    return true;
  });
}

async function upsertEvent(candidate: any, html: string) {
  const pageText = stripTags(html);
  const title = getTitle(html, candidate.title || "");
  const fullText = compactText(`${title} ${candidate.title || ""} ${candidate.snippet || ""} ${pageText}`, 30000);

  if (!includesAny(fullText, EVENT_PAGE_WORDS)) {
    await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "rejected",
        verified_score: Number(candidate.score || 0),
        verified_reason: "no_event_page_word",
        checked_at: nowIso(),
        page_text: pageText.slice(0, 15000),
        updated_at: nowIso(),
      })
      .eq("id", candidate.id);

    return {
      status: "rejected",
      reason: "no_event_page_word",
      verifiedScore: Number(candidate.score || 0),
    };
  }

  const strong = matchedWords(fullText, STRONG_WORDS);
  const soccer = matchedWords(fullText, SOCCER_WORDS);

  let verifiedScore = Number(candidate.score || 0);

  verifiedScore += strong.length * 10;
  verifiedScore += soccer.length * 4;

  if (isSummaryDomain(candidate.url)) verifiedScore -= 40;
  if (includesAny(fullText, ["募集終了", "受付終了", "締め切りました"])) verifiedScore -= 30;
  if (!includesAny(fullText, STRONG_WORDS)) verifiedScore -= 100;
  if (!includesAny(fullText, SOCCER_WORDS)) verifiedScore -= 60;

  if (verifiedScore < 80) {
    await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "rejected",
        verified_score: verifiedScore,
        verified_reason: "low_verified_score",
        checked_at: nowIso(),
        page_text: pageText.slice(0, 15000),
        updated_at: nowIso(),
      })
      .eq("id", candidate.id);

    return { status: "rejected", reason: "low_verified_score", verifiedScore };
  }

  const eventDate = extractEventDate(fullText);
  const deadline = extractDeadline(fullText);
  const categories = extractCategories(fullText);
  const gender = extractGender(fullText);
  const statusText = displayStatus(eventDate, deadline, fullText);
  const hash = await sha256(`${candidate.url}|${title}|${eventDate || ""}|${deadline || ""}`);

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
    official_url: candidate.url,
    summary: compactText(pageText, 240),
    description: compactText(pageText, 1200),
    memo: `candidate_id:${candidate.id}`,
    image_url: null,
    fetched_at: nowIso(),
    raw_text: pageText.slice(0, 20000),
    content_hash: hash,
    status: "active",
    display_status: statusText,
    is_featured: false,
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    source_type: "verified_candidate",
    pdf_url: null,
    instagram_url: null,
    external_url: candidate.url,
    extraction_status: "verified",
    extraction_error: null,
    duplicate_key: hash,
    source_rank: null,
  };

  const { data: existing, error: existingError } = await supabase
    .from("selection_events")
    .select("id")
    .eq("duplicate_key", hash)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("selection_events")
      .update(eventRow)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("selection_events")
      .insert({
        ...eventRow,
        created_at: nowIso(),
      });

    if (error) throw error;
  }

  await supabase
    .from("selection_page_candidates")
    .update({
      verified_status: "accepted",
      verified_score: verifiedScore,
      verified_reason: `event_date:${eventDate || "none"},deadline:${deadline || "none"}`,
      checked_at: nowIso(),
      page_text: pageText.slice(0, 15000),
      updated_at: nowIso(),
    })
    .eq("id", candidate.id);

  return {
    status: "accepted",
    verifiedScore,
    eventDate,
    deadline,
    displayStatus: statusText,
    categories,
  };
}

async function runOne(candidate: any) {
  try {
    const html = await fetchHtml(candidate.url);
    const result = await upsertEvent(candidate, html);

    return {
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      score: candidate.score,
      ...result,
    };
  } catch (e) {
    await supabase
      .from("selection_page_candidates")
      .update({
        verified_status: "error",
        verified_score: 0,
        verified_reason: String(e?.message || e).slice(0, 500),
        checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", candidate.id);

    return {
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      status: "error",
      error: String(e?.message || e),
    };
  }
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const batchSize = Math.min(Number(body.batchSize || body.limit || 5), 10);
    const maxBatches = Math.min(Number(body.maxBatches || 1), 10);

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

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return json({
      ok: true,
      mode: "verify-selection-candidates",
      batchSize,
      maxBatches,
      totalClaimed,
      totalAccepted,
      totalRejected,
      totalErrors,
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