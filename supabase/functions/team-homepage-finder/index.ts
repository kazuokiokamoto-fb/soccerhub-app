// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 20;

function clean(v: string) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
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
    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return url;
  }
}

function isBadUrl(url: string) {
  const s = url.toLowerCase();
  const host = hostOf(url);

  return (
    !s.startsWith("http") ||
    host.includes("instagram.com") ||
    host.includes("facebook.com") ||
    host.includes("twitter.com") ||
    host.includes("x.com") ||
    host.includes("youtube.com") ||
    host.includes("youtu.be") ||
    host.includes("line.me") ||
    host.includes("google.com") ||
    host.includes("yahoo.co.jp") ||
    host.includes("wikipedia.org") ||
    host.includes("jfa.jp") ||
    host.includes("tokyofa.or.jp") ||
    host.includes("kanagawa-fa.gr.jp") ||
    host.includes("saitamafa.or.jp") ||
    host.includes("chiba-fa.gr.jp") ||
    host.includes("ibaraki-fa.jp") ||
    host.includes("tfa.or.jp") ||
    host.includes("gunma-fa.com") ||
    host.includes("kanto-cy.com") ||
    host.includes("tokyo-cy.jp") ||
    host.includes("saitama-u12.com") ||
    s.includes(".pdf") ||
    s.includes(".xlsx") ||
    s.includes(".xls")
  );
}

function scoreCandidate(teamName: string, item: any) {
  const title = clean(item.title || "");
  const link = clean(item.link || "");
  const snippet = clean(item.snippet || "");
  const text = `${title} ${link} ${snippet}`.toLowerCase();
  const team = teamName.toLowerCase();

  if (!link || isBadUrl(link)) return -999;

  let score = 0;

  if (text.includes(team)) score += 50;
  if (text.includes("公式")) score += 25;
  if (text.includes("official")) score += 25;
  if (text.includes("サッカー")) score += 15;
  if (text.includes("ジュニアユース")) score += 15;
  if (text.includes("ユース")) score += 10;
  if (text.includes("スクール")) score += 8;
  if (text.includes("fc") || text.includes("sc")) score += 8;

  if (text.includes("試合結果")) score -= 20;
  if (text.includes("大会")) score -= 15;
  if (text.includes("リーグ")) score -= 10;
  if (text.includes("掲示板")) score -= 20;

  return score;
}

async function searchSerper(query: string) {
  const apiKey = Deno.env.get("SERPER_API_KEY");

  if (!apiKey) {
    throw new Error("Missing SERPER_API_KEY");
  }

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "jp",
      hl: "ja",
      num: 10,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper error ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

async function findOfficialHomepage(teamName: string, prefecture?: string | null) {
  const queries = [
    `${teamName} 公式 サッカー`,
    `${teamName} ホームページ サッカー`,
    `${teamName} ${prefecture ?? ""} サッカー`,
    `${teamName} ジュニアユース 公式`,
  ];

  const candidates: any[] = [];

  for (const q of queries) {
    const result = await searchSerper(q);
    const organic = result?.organic ?? [];

    for (const item of organic) {
      const score = scoreCandidate(teamName, item);
      if (score <= 0) continue;

      candidates.push({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        score,
        query: q,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;

  return {
    official_url: originOf(best.link),
    found_url: best.link,
    title: best.title,
    score: best.score,
    query: best.query,
  };
}

async function readBody(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  const body = await readBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRole =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRole) {
    return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const offset = Number(body.offset ?? 0);
  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 50);

  const { data: teams, error } = await supabase
    .from("team_directory")
    .select("id,team_name,prefecture,category")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let checked = 0;
  let found = 0;
  let insertedHomepages = 0;
  let insertedSources = 0;

  const results: any[] = [];
  const errors: any[] = [];

  for (const team of teams ?? []) {
    checked++;

    try {
      const homepage = await findOfficialHomepage(team.team_name, team.prefecture);

      if (!homepage?.official_url) {
        results.push({
          team_name: team.team_name,
          status: "not_found",
        });
        continue;
      }

      found++;

      const { error: hpError } = await supabase
        .from("team_homepages")
        .insert({
          team_directory_id: team.id,
          team_name: team.team_name,
          prefecture: team.prefecture,
          official_url: homepage.official_url,
          homepage_status: "active",
          last_checked_at: new Date().toISOString(),
        });

      if (!hpError) insertedHomepages++;

      const { error: sourceError } = await supabase
        .from("selection_sources")
        .insert({
          name: team.team_name,
          base_url: homepage.official_url,
          organization_type: team.category || "club_team",
          enabled: true,
          crawl_type: "web",
          crawl_interval_minutes: 1440,
          source_rank: null,
        });

      if (!sourceError) insertedSources++;

      results.push({
        team_name: team.team_name,
        official_url: homepage.official_url,
        score: homepage.score,
        status: "found",
      });
    } catch (e) {
      errors.push({
        team_name: team.team_name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    ok: true,
    offset,
    limit,
    checked,
    found,
    insertedHomepages,
    insertedSources,
    results,
    errors,
  });
});