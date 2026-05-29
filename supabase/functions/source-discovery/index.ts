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

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function cleanText(value: any) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function guessOrganizationType(seed: TeamSeed) {
  if (seed.organization_type) return seed.organization_type;
  if (seed.name.includes("スクール")) return "school";
  if (seed.name.includes("アカデミー")) return "club_team";
  return "club_team";
}

function guessSourceRank(seed: TeamSeed) {
  if (seed.source_rank) return seed.source_rank;
  if (seed.name.includes("JFA")) return "その他";
  if (seed.name.includes("スクール")) return "スクール";
  return "その他";
}

function buildSourceRows(seed: TeamSeed) {
  return seed.urls.map((url) => ({
    name: cleanText(seed.name),
    base_url: normalizeUrl(url),
    organization_type: guessOrganizationType(seed),
    source_rank: guessSourceRank(seed),
    enabled: true,
  }));
}

/**
 * まずはここに関東チームを増やしていきます。
 * urls は公式サイト・募集ページ・スクールページなど、分かる範囲でOKです。
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
  const body = await readJsonBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Missing env" },
      { status: 500 },
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
      errors.push({
        base_url: row.base_url,
        error: error.message,
      });
      continue;
    }

    inserted += 1;
    insertedRows.push(data);
  }

  return Response.json({
    ok: errors.length === 0,
    seedCount: seeds.length,
    candidateUrlCount: rows.length,
    inserted,
    skipped,
    errors,
    insertedRows,
    skippedRows,
  });
});