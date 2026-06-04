// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Google Custom Search JSON API を使う場合
// 既存利用者向け。新規利用可否はGoogle側の状況に注意。
const GOOGLE_CSE_KEY = Deno.env.get("GOOGLE_CSE_KEY") || "";
const GOOGLE_CSE_CX = Deno.env.get("GOOGLE_CSE_CX") || "";

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
  "ゴールキーパーセレクション",
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
  "PDF",
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

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w.toLowerCase()));
}

function matchedWords(text: string, words: string[]) {
  const t = normalizeText(text);
  return words.filter((w) => t.includes(w.toLowerCase()));
}

function isBlockedUrl(url: string) {
  const u = normalizeText(url);
  if (BLOCKED_EXTENSIONS.some((ext) => u.includes(ext))) return true;

  const blockedHosts = [
    "youtube.com",
    "youtu.be",
    "maps.google",
    "google.com/maps",
  ];

  if (blockedHosts.some((h) => u.includes(h))) return true;

  return false;
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

  if (negatives.length >= 2 && positives.length === 0) {
    return {
      ok: false,
      score: 0,
      matched: positives,
      excluded_reason: `negative_keywords:${negatives.join(",")}`,
    };
  }

  let score = positives.length * 10;

  if (lower.includes("セレクション")) score += 30;
  if (lower.includes("選考会")) score += 25;
  if (lower.includes("体験練習会")) score += 20;
  if (lower.includes("新入団")) score += 18;
  if (lower.includes("募集")) score += 12;
  if (lower.includes("ジュニアユース")) score += 10;
  if (lower.includes("u-15") || lower.includes("u15")) score += 10;
  if (lower.includes("u-18") || lower.includes("u18")) score += 10;

  if (lower.includes("試合結果")) score -= 30;
  if (lower.includes("大会結果")) score -= 30;
  if (lower.includes("チーム一覧")) score -= 25;

  const ok = score >= 20 && positives.length > 0;

  return {
    ok,
    score,
    matched: positives,
    excluded_reason: ok ? null : "low_score_or_no_positive_keyword",
  };
}

async function googleSearch(query: string, start = 1) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) {
    throw new Error("GOOGLE_CSE_KEY / GOOGLE_CSE_CX is not set");
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GOOGLE_CSE_KEY);
  url.searchParams.set("cx", GOOGLE_CSE_CX);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  url.searchParams.set("start", String(start));
  url.searchParams.set("lr", "lang_ja");
  url.searchParams.set("safe", "off");

  const res = await fetch(url.toString());

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google search failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    title: item.title || "",
    url: item.link || "",
    snippet: item.snippet || "",
  }));
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
      tried_count: job.tried_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (startError) throw startError;

  try {
    const results = await googleSearch(job.query, 1);

    let saved = 0;
    let rejected = 0;

    for (const r of results) {
      if (!r.url) continue;

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
        source_type: "google_cse",
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
    const { error: failError } = await supabase
      .from("selection_search_jobs")
      .update({
        status: job.tried_count + 1 >= 3 ? "failed" : "pending",
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

    const limit = Math.min(Number(body.limit || 3), 10);

    const jobs = await claimJobs(limit);

    const results = [];

    for (const job of jobs) {
      const r = await runOneJob(job);
      results.push(r);
    }

    return json({
      ok: true,
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