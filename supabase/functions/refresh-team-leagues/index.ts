// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { parseTokyoCY } from "./extractors/tokyo-cy.ts";
import { parseKantoCY } from "./extractors/kanto-cy.ts";
import { parseSaitamaCY } from "./extractors/saitama-cy.ts";
import { parseGenericTable } from "./extractors/generic-table.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FETCH_TIMEOUT_MS = 15000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(name: string) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()【】\[\]]/g, "")
    .trim();
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
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) throw new Error(`fetch failed ${res.status}`);

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function getSeason(body: any) {
  return Number(body.season || new Date().getFullYear());
}

async function loadLeagueSources(
  limit: number,
  onlySourceId?: string,
  prefecture?: string,
) {
  let q = supabase
    .from("league_sources")
    .select("*")
    .eq("enabled", true)
    .order("league_rank", { ascending: true });

  if (onlySourceId) {
    q = q.eq("id", onlySourceId);
  }

  if (prefecture) {
    q = q.eq("prefecture", prefecture);
  }

  q = q.limit(limit);

  const { data, error } = await q;

  if (error) throw error;
  return data || [];
}

async function parseTeams(source: any, html: string) {
  const url = source.source_url || "";

  if (url.includes("tokyo-cy.jp")) {
    return await parseTokyoCY(html, source.league_name);
  }

  if (url.includes("kanto-cy.com")) {
    return await parseKantoCY(html, source.league_name);
  }

  if (url.includes("saitama-cy.com")) {
    return await parseSaitamaCY(html, source.league_name);
  }

  return await parseGenericTable(html, source.league_name);
}

async function findExistingTeam(teamName: string, category: string, prefecture: string) {
  const normalizedName = normalizeName(teamName);

  const { data, error } = await supabase
    .from("team_master")
    .select("*")
    .eq("normalized_name", normalizedName)
    .eq("category", category)
    .eq("prefecture", prefecture)
    .limit(1);

  if (error) throw error;

  return data?.[0] || null;
}

async function upsertTeamMaster(params: {
  teamName: string;
  prefecture: string;
  category: string;
  leagueName: string;
  leagueRank: number;
  season: number;
  sourceUrl: string;
}) {
  const normalizedName = normalizeName(params.teamName);

  const existing = await findExistingTeam(
    params.teamName,
    params.category,
    params.prefecture,
  );

  if (existing?.id) {
    const { data, error } = await supabase
      .from("team_master")
      .update({
        team_name: params.teamName,
        current_league_name: params.leagueName,
        current_league_rank: params.leagueRank,
        current_season: params.season,
        source_url: params.sourceUrl,
        last_verified_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("team_master")
    .insert({
      team_name: params.teamName,
      normalized_name: normalizedName,
      prefecture: params.prefecture,
      category: params.category,
      gender: "boys",
      official_url: null,
      homepage_status: null,
      current_league_name: params.leagueName,
      current_league_rank: params.leagueRank,
      current_season: params.season,
      source_url: params.sourceUrl,
      last_verified_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function upsertLeagueHistory(params: {
  teamId: string;
  season: number;
  leagueName: string;
  leagueRank: number;
  prefecture: string;
  category: string;
  sourceUrl: string;
}) {
  const { data: existing, error: findError } = await supabase
    .from("team_league_history")
    .select("id")
    .eq("season", params.season)
    .eq("team_id", params.teamId)
    .eq("category", params.category)
    .eq("league_name", params.leagueName)
    .limit(1);

  if (findError) throw findError;

  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("team_league_history")
      .update({
        league_rank: params.leagueRank,
        prefecture: params.prefecture,
        source_url: params.sourceUrl,
      })
      .eq("id", existing[0].id);

    if (error) throw error;
    return "updated";
  }

  const { error } = await supabase
    .from("team_league_history")
    .insert({
      team_id: params.teamId,
      season: params.season,
      league_name: params.leagueName,
      league_rank: params.leagueRank,
      prefecture: params.prefecture,
      category: params.category,
      source_url: params.sourceUrl,
      created_at: nowIso(),
    });

  if (error) throw error;
  return "inserted";
}

async function processLeagueSource(source: any, season: number) {
  const html = await fetchHtml(source.source_url);
  const parsedTeams = await parseTeams(source, html);

  const saved = [];
  const errors = [];

  for (const team of parsedTeams) {
    try {
      const teamName = team.teamName || team.team_name;
      if (!teamName) continue;

      const master = await upsertTeamMaster({
        teamName,
        prefecture: source.prefecture,
        category: source.category,
        leagueName: source.league_name,
        leagueRank: source.league_rank,
        season,
        sourceUrl: source.source_url,
      });

      const historyStatus = await upsertLeagueHistory({
        teamId: master.id,
        season,
        leagueName: source.league_name,
        leagueRank: source.league_rank,
        prefecture: source.prefecture,
        category: source.category,
        sourceUrl: source.source_url,
      });

      saved.push({
        team_name: teamName,
        team_id: master.id,
        history: historyStatus,
      });
    } catch (e) {
      errors.push({
        team,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    source_id: source.id,
    league_name: source.league_name,
    league_rank: source.league_rank,
    source_url: source.source_url,
    parsedCount: parsedTeams.length,
    savedCount: saved.length,
    errorCount: errors.length,
    saved,
    errors,
  };
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok");
    }

    const body = await req.json().catch(() => ({}));
    const season = getSeason(body);

    const limit = Number(body.limit || body.maxSources || 20);
    const onlySourceId = body.onlySourceId;
    const prefecture = body.prefecture;

    const sources = await loadLeagueSources(
      limit,
      onlySourceId,
      prefecture,
    );

    const results = [];
    let totalParsed = 0;
    let totalSaved = 0;
    let totalErrors = 0;

    for (const source of sources) {
      try {
        const result = await processLeagueSource(source, season);
        results.push(result);

        totalParsed += result.parsedCount;
        totalSaved += result.savedCount;
        totalErrors += result.errorCount;
      } catch (e) {
        results.push({
          source_id: source.id,
          league_name: source.league_name,
          source_url: source.source_url,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });

        totalErrors++;
      }
    }

    return json({
      ok: true,
      mode: "refresh-team-leagues",
      season,
      sourceCount: sources.length,
      totalParsed,
      totalSaved,
      totalErrors,
      results,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});