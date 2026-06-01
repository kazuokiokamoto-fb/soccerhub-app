// @ts-nocheck

/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TeamSeed = {
  name: string;
  area?: string;
  prefecture?: string;
  organization_type?: string;
  source_rank?: string;
  urls: string[];
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRA_KEYWORDS = [
  "サッカー協会",
  "少年サッカー連盟",
  "4種委員会",
  "4種リーグ",
  "地区サッカー協会",
  "クラブユースサッカー連盟",
  "クラブユース",
  "ジュニアサッカー",
  "ジュニアユース",
  "少年団",
  "チーム一覧",
  "加盟チーム",
  "登録チーム",
  "参加チーム",
];

function normalizeUrl(url: string) {
  try {
    const u = new URL(String(url ?? "").trim());
    u.hash = "";

    if (
      (u.pathname === "" || u.pathname === "/") &&
      !u.search
    ) {
      u.pathname = "/";
    }

    return u.toString();
  } catch {
    return String(url ?? "").trim();
  }
}

function cleanText(value: any) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessOrganizationType(seed: TeamSeed) {
  if (seed.organization_type) return seed.organization_type;
  if (seed.name.includes("スクール")) return "school";
  if (seed.name.includes("アカデミー")) return "club_team";
  if (seed.name.includes("クラブユース")) return "club_team";
  if (seed.name.includes("少年団")) return "club_team";
  return "club_team";
}

function guessSourceRank(seed: TeamSeed) {
  if (seed.source_rank) return seed.source_rank;
  if (seed.name.includes("JFA")) return "その他";
  if (seed.name.includes("スクール")) return "スクール";
  if (seed.name.includes("クラブユース")) return "街クラブ";
  return "その他";
}

function buildSourceRows(seed: TeamSeed) {
  return seed.urls
    .map((url) => normalizeUrl(url))
    .filter(Boolean)
    .map((url) => ({
      name: cleanText(seed.name),
      base_url: url,
      organization_type: guessOrganizationType(seed),
      source_rank: guessSourceRank(seed),
      enabled: true,
    }));
}

/**
 * selection_sources に追加する既知ソース。
 * これは「セレクション情報収集用」です。
 * team_directory_seeds とは別テーブルです。
 */
const TEAM_SEEDS: TeamSeed[] = [
  {
    name: "FCヴィアージャ",
    prefecture: "神奈川県",
    organization_type: "club_team",
    source_rank: "街クラブ",
    urls: [
      "https://www.fcviagem.com/",
      "https://www.fcviagem.com/%E3%82%BB%E3%83%AC%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3-%EF%BD%8A%EF%BD%99-%E3%82%B9%E3%83%9A%E3%82%B7%E3%83%A3%E3%83%AB%E3%82%AF%E3%83%A9%E3%82%B9/",
    ],
  },
  {
    name: "プレジール入間",
    prefecture: "埼玉県",
    organization_type: "club_team",
    source_rank: "街クラブ",
    urls: [
      "https://plaisir-sc.com/",
      "https://jryouth.plaisir-sc.com/",
      "https://junior.plaisir-sc.com/",
      "https://school.plaisir-sc.com/",
    ],
  },
  {
    name: "malvaサッカースクール",
    prefecture: "関東",
    organization_type: "school",
    source_rank: "スクール",
    urls: [
      "https://malva-fc.jp/",
      "https://malva-fc.jp/taiken/",
      "https://malva-fc.jp/notice/",
    ],
  },
  {
    name: "SOLTILO FAMILIA SOCCER SCHOOL",
    prefecture: "関東",
    organization_type: "school",
    source_rank: "スクール",
    urls: [
      "https://soltilo.com/",
      "https://soltilo.com/news/",
    ],
  },
];

async function readJsonBody(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const body = await readJsonBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Missing Supabase env" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const limit = Math.max(1, Math.min(Number(body?.limit ?? 999), 999));
  const seeds = TEAM_SEEDS.slice(0, limit);
  const rows = seeds.flatMap(buildSourceRows);

  let inserted = 0;
  let skipped = 0;

  const errors: any[] = [];
  const insertedRows: any[] = [];
  const skippedRows: any[] = [];

  for (const row of rows) {
    const { data: existing, error: existingError } = await supabase
      .from("selection_sources")
      .select("id,name,base_url")
      .eq("base_url", row.base_url)
      .maybeSingle();

    if (existingError) {
      errors.push({
        base_url: row.base_url,
        phase: "select_existing",
        error: existingError.message,
      });
      continue;
    }

    if (existing?.id) {
      skipped += 1;
      skippedRows.push(existing);
      continue;
    }

    const { data, error } = await supabase
      .from("selection_sources")
      .insert(row)
      .select("id,name,base_url,organization_type,source_rank,enabled")
      .single();

    if (error) {
      const message = String(error.message ?? "");

      if (
        message.includes("duplicate key value") ||
        message.includes("selection_sources") ||
        error.code === "23505"
      ) {
        skipped += 1;
        skippedRows.push({
          name: row.name,
          base_url: row.base_url,
          reason: "duplicate",
        });
        continue;
      }

      errors.push({
        base_url: row.base_url,
        phase: "insert",
        error: error.message,
        code: error.code,
      });
      continue;
    }

    inserted += 1;
    insertedRows.push(data);
  }

  return Response.json(
    {
      ok: errors.length === 0,
      mode: "selection_sources_seed_insert",
      seedCount: seeds.length,
      candidateUrlCount: rows.length,
      inserted,
      skipped,
      errors,
      insertedRows,
      skippedRows,
      extraKeywords: EXTRA_KEYWORDS,
    },
    { headers: CORS_HEADERS },
  );
});