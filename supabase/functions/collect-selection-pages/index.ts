// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const POSITIVE_KEYWORDS = [
  "セレクション",
  "選考会",
  "追加セレクション",
  "体験練習会",
  "練習会",
  "新入団",
  "新入団募集",
  "入団募集",
  "団員募集",
  "選手募集",
  "ジュニアユース",
  "U-15",
  "U15",
  "U-18",
  "U18",
  "GKセレクション",
];

const NEGATIVE_KEYWORDS = [
  "試合結果",
  "大会結果",
  "速報",
  "組み合わせ",
  "トーナメント",
  "日程表",
  "星取表",
  "順位表",
  "メンバー表",
  "チーム一覧",
  "加盟チーム",
  "pdf",
];

const BLOCKED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".zip",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeText(s: string | null | undefined) {
  return String(s || "").toLowerCase();
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

function stripTags(s: string) {
  return decodeHtml(String(s || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function matchedWords(text: string, words: string[]) {
  const t = normalizeText(text);
  return words.filter((w) => t.includes(w.toLowerCase()));
}

function isBlockedUrl(url: string) {
  const u = normalizeText(url);

  if (!u.startsWith("http://") && !u.startsWith("https://")) return true;
  if (BLOCKED_EXTENSIONS.some((ext) => u.includes(ext))) return true;

  const blockedHosts = [
    "duckduckgo.com",
    "google.com",
    "youtube.com",
    "youtu.be",
    "maps.google",
    "translate.google",
  ];

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (blockedHosts.some((h) => host.includes(h))) return true;
  } catch {
    return true;
  }

  return false;
}

function extractDuckUrl(href: string) {
  let url = decodeHtml(href || "").trim();

  if (!url) return null;

  if (url.startsWith("//duckduckgo.com/l/?")) {
    url = "https:" + url;
  }

  if (url.includes("duckduckgo.com/l/?")) {
    try {
      const u = new URL(url);
      const uddg = u.searchParams.get("uddg");
      if (uddg) url = decodeURIComponent(uddg);
    } catch {
      return null;
    }
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  return url.split("#")[0];
}

function classifyCandidate(item: {
  title: string;
  url: string;
  snippet: string;
}) {
  const text = `${item.title} ${item.url} ${item.snippet}`;
  const lower = normalizeText(text);

  if (isBlockedUrl(item.url)) {
    return {
      ok: false,
      score: 0,
      matched: [],
      excluded_reason: "blocked_file_or_url",
    };
  }

  const positives = matchedWords(lower, POSITIVE_KEYWORDS);
  const negatives = matchedWords(lower, NEGATIVE_KEYWORDS);

  let score = positives.length * 10;

  if (lower.includes("セレクション")) score += 30;
  if (lower.includes("選考会")) score += 25;
  if (lower.includes("体験練習会")) score += 20;
  if (lower.includes("練習会")) score += 12;
  if (lower.includes("新入団")) score += 18;
  if (lower.includes("募集")) score += 12;
  if (lower.includes("ジュニアユース")) score += 10;
  if (lower.includes("u-15") || lower.includes("u15")) score += 10;
  if (lower.includes("u-18") || lower.includes("u18")) score += 10;

  if (lower.includes("試合結果")) score -= 30;
  if (lower.includes("大会結果")) score -= 30;
  if (lower.includes("チーム一覧")) score -= 25;
  if (lower.includes("加盟チーム")) score -= 20;

  if (negatives.length >= 2 && positives.length === 0) {
    return {
      ok: false,
      score,
      matched: positives,
      excluded_reason: `negative_keywords:${negatives.join(",")}`,
    };
  }

  const ok = score >= 20 && positives.length > 0;

  return {
    ok,
    score,
    matched: positives,
    excluded_reason: ok ? null : "low_score_or_no_positive_keyword",
  };
}

async function duckDuckGoSearch(query: string) {
  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", query);
  url.searchParams.set("kl", "jp-jp");

  const res = await fetch(url.toString(), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  const html = await res.text();

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: ${res.status}`);
  }

  const results: any[] = [];
  const seen = new Set<string>();

  const blockRe = /<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  const blocks = html.match(blockRe) || [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = extractDuckUrl(linkMatch[1]);
    if (!href) continue;
    if (isBlockedUrl(href)) continue;
    if (seen.has(href)) continue;

    const title = stripTags(linkMatch[2]);
    const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[\s\S]*?>([\s\S]*?)<\/a>/i)
      || block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/i);

    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : stripTags(block).slice(0, 400);

    seen.add(href);

    results.push({
      title,
      url: href,
      snippet,
    });

    if (results.length >= 10) break;
  }

  return results;
}

async function claimJobs(limit: number) {
  const { data, error } = await supabase
    .from("selection_search_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function runOneJob(job: any) {
  const { error: startError } = await supabase
    .from("selection_search_jobs")
    .update({
      status: "running",
      tried_count: Number(job.tried_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (startError) throw startError;

  try {
    const results = await duckDuckGoSearch(job.query);

    let saved = 0;
    let rejected = 0;

    for (const r of results) {
      const judged = classifyCandidate(r);

      if (!judged.ok) {
        rejected++;
        continue;
      }

      const row = {
        prefecture: job.prefecture,
        municipality: job.municipality,
        query: job.query,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source_type: "duckduckgo_html",
        status: "candidate",
        matched_keywords: judged.matched,
        excluded_reason: judged.excluded_reason,
        score: judged.score,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("selection_page_candidates")
        .upsert(row, { onConflict: "url" });

      if (upsertError) {
        console.error("upsert error", upsertError);
      } else {
        saved++;
      }
    }

    const { error: doneError } = await supabase
      .from("selection_search_jobs")
      .update({
        status: "done",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (doneError) throw doneError;

    return {
      job_id: job.id,
      query: job.query,
      saved,
      rejected,
      total: results.length,
    };
  } catch (e) {
    const nextTried = Number(job.tried_count || 0) + 1;

    const { error: failError } = await supabase
      .from("selection_search_jobs")
      .update({
        status: nextTried >= 3 ? "failed" : "pending",
        last_error: String(e?.message || e),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (failError) console.error(failError);

    return {
      job_id: job.id,
      query: job.query,
      error: String(e?.message || e),
    };
  }
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Number(body.limit || 1), 3);

    const jobs = await claimJobs(limit);

    const results = [];

    for (const job of jobs) {
      const r = await runOneJob(job);
      results.push(r);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return json({
      ok: true,
      mode: "duckduckgo_html",
      claimed: jobs.length,
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