// @ts-nocheck
// audit-selection-sources/index.ts
// selection_events から「年またぎ」等の疑わしい組織を検出し、
// Serper検索結果のタイトル/スニペットに出現する年度を集計して、
// DBの年と食い違いがあれば data_quality_flags に記録する。
// (Claude APIは使わず、Serperのみで完結させるルールベース版)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY")!;
const SERPER_ENDPOINT = "https://google.serper.dev/search";

const BATCH_SIZE = 15;

function nowIso() { return new Date().toISOString(); }
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
}

async function serperSearch(query: string): Promise<SerperResult[]> {
  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "jp", hl: "ja", num: 10 }),
  });
  if (!res.ok) throw new Error(`Serper API error: HTTP ${res.status}`);
  const data = await res.json();
  return (data.organic || []) as SerperResult[];
}

// 疑わしい (organization_name, source_url) の組み合わせを検出
async function findSuspiciousSources(limit: number) {
  const { data: rows, error } = await supabase
    .from("selection_events")
    .select("organization_name, source_url, event_date")
    .not("event_date", "is", null);
  if (error) throw error;

  const grouped = new Map<string, Set<number>>();
  for (const r of rows || []) {
    const key = `${r.organization_name}|||${r.source_url}`;
    const year = new Date(r.event_date).getFullYear();
    if (!grouped.has(key)) grouped.set(key, new Set());
    grouped.get(key)!.add(year);
  }

  // 既にフラグ済みのものは除外(重複記録を避ける)
  const { data: existingFlags } = await supabase
    .from("data_quality_flags")
    .select("organization_name, source_url");
  const flaggedKeys = new Set(
    (existingFlags || []).map((f: any) => `${f.organization_name}|||${f.source_url}`)
  );

  const suspicious = [];
  for (const [key, years] of grouped.entries()) {
    if (years.size > 1 && !flaggedKeys.has(key)) {
      const [organization_name, source_url] = key.split("|||");
      suspicious.push({ organization_name, source_url, years: Array.from(years).sort() });
    }
  }

  return suspicious.slice(0, limit);
}

// タイトル・スニペットから「20XX年度」「20XX年」の年数字を全て抽出
function extractYearsFromText(text: string): number[] {
  const years: number[] = [];
  const patterns = [/20(\d{2})年度/g, /20(\d{2})年/g];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      years.push(2000 + Number(m[1]));
    }
  }
  return years;
}

// 検索結果全体から、最も頻出する年を「実際の年度」として推定
function detectDominantYear(results: SerperResult[]): { year: number | null; evidence: string } {
  const counts = new Map<number, number>();
  const evidences: string[] = [];

  for (const r of results.slice(0, 5)) {
    const text = `${r.title} ${r.snippet || ""}`;
    const years = extractYearsFromText(text);
    for (const y of years) {
      counts.set(y, (counts.get(y) || 0) + 1);
    }
    if (years.length > 0) evidences.push(`"${r.title}" → ${years.join(",")}`);
  }

  if (counts.size === 0) return { year: null, evidence: "検索結果から年度を抽出できず" };

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { year: sorted[0][0], evidence: evidences.join(" / ") };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || BATCH_SIZE), 30);

    const suspicious = await findSuspiciousSources(batchSize);
    if (suspicious.length === 0) {
      return json({ ok: true, message: "no suspicious sources found", processed: 0 });
    }

    const results = [];
    for (const item of suspicious) {
      try {
        const query = `"${item.organization_name}" セレクション`;
        const searchResults = await serperSearch(query);
        const { year: detectedYear, evidence } = detectDominantYear(searchResults);

        const mismatch =
          detectedYear !== null && !item.years.includes(detectedYear);

        const { error: insertError } = await supabase
          .from("data_quality_flags")
          .insert({
            organization_name: item.organization_name,
            source_url: item.source_url,
            flag_type: mismatch ? "year_mismatch_confirmed" : "year_mismatch_unconfirmed",
            db_years: item.years,
            detected_year_from_search: detectedYear,
            search_evidence: evidence,
            reviewed: false,
            created_at: nowIso(),
          });

        if (insertError) throw new Error(`insert error: ${JSON.stringify(insertError)}`);

        results.push({
          organizationName: item.organization_name,
          dbYears: item.years,
          detectedYear,
          mismatch,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ organizationName: item.organization_name, status: "error", error: message });
      }

      await sleep(300);
    }

    return json({ ok: true, processed: suspicious.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});
