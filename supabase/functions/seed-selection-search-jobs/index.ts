// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SEARCH_PATTERNS = [
  {
    keyword: "サッカー セレクション",
    buildQuery: (city: string) => `${city} サッカー セレクション`,
  },
  {
    keyword: "サッカー 選考会",
    buildQuery: (city: string) => `${city} サッカー 選考会`,
  },
  {
    keyword: "サッカー 体験練習会",
    buildQuery: (city: string) => `${city} サッカー 体験練習会`,
  },
  {
    keyword: "サッカー 練習会",
    buildQuery: (city: string) => `${city} サッカー 練習会`,
  },
  {
    keyword: "サッカー 新入団 募集",
    buildQuery: (city: string) => `${city} サッカー 新入団 募集`,
  },
  {
    keyword: "サッカー 選手募集",
    buildQuery: (city: string) => `${city} サッカー 選手募集`,
  },
  {
    keyword: "サッカー 団員募集",
    buildQuery: (city: string) => `${city} サッカー 団員募集`,
  },
  {
    keyword: "サッカー メンバー募集",
    buildQuery: (city: string) => `${city} サッカー メンバー募集`,
  },
  {
    keyword: "サッカー 部員募集",
    buildQuery: (city: string) => `${city} サッカー 部員募集`,
  },
  {
    keyword: "サッカー スクール 体験",
    buildQuery: (city: string) => `${city} サッカー スクール 体験`,
  },
  {
    keyword: "少年サッカー 団員募集",
    buildQuery: (city: string) => `${city} 少年サッカー 団員募集`,
  },
  {
    keyword: "女子サッカー 選手募集",
    buildQuery: (city: string) => `${city} 女子サッカー 選手募集`,
  },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parseCsv(text: string) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((v) => v.trim());

    const prefecture = cols[0];
    const city = cols[1];

    if (!prefecture || !city) continue;

    rows.push({
      prefecture,
      city,
    });
  }

  return rows;
}

async function seedJobsFromCsv(csvText: string, reset = false) {
  const municipalities = parseCsv(csvText);

  if (municipalities.length === 0) {
    throw new Error("CSVに自治体データがありません");
  }

  if (reset) {
    const { error } = await supabase
      .from("selection_search_jobs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) throw error;
  }

  const rows = [];

  for (const m of municipalities) {
    for (const p of SEARCH_PATTERNS) {
      rows.push({
        prefecture: m.prefecture,
        municipality: m.city,
        keyword: p.keyword,
        query: p.buildQuery(m.city),
        status: "pending",
        tried_count: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  let insertedOrUpserted = 0;
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("selection_search_jobs")
      .upsert(chunk, {
        onConflict: "prefecture,municipality,keyword",
        ignoreDuplicates: false,
      });

    if (error) throw error;

    insertedOrUpserted += chunk.length;
  }

  return {
    municipalities: municipalities.length,
    patterns: SEARCH_PATTERNS.length,
    jobs: rows.length,
    insertedOrUpserted,
  };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const csvText = body.csvText || "";
    const reset = Boolean(body.reset || false);

    if (!csvText) {
      return json(
        {
          ok: false,
          error: "csvText が空です。kanto_municipalities.csv の中身を渡してください。",
        },
        400,
      );
    }

    const result = await seedJobsFromCsv(csvText, reset);

    return json({
      ok: true,
      mode: "seed-selection-search-jobs",
      reset,
      ...result,
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