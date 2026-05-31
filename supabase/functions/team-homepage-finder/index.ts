// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 5;

function clean(v: string) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeOfficialUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    const sharedHosts = [
      "wixsite.com",
      "jimdosite.com",
      "jimdofree.com",
      "amebaownd.com",
      "webnode.jp",
      "sports-joy.com",
      "footballnavi.jp",
      "teams.one",
    ];

    if (sharedHosts.some((h) => host.includes(h))) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return `${u.protocol}//${u.hostname}/${parts[0]}/`;
      }
    }

    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return url;
  }
}

function isBadUrl(url: string) {
  const s = String(url || "").toLowerCase();
  const host = hostOf(url);

  const badHosts = [
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "line.me",
    "lin.ee",
    "google.com",
    "google.co.jp",
    "yahoo.co.jp",
    "wikipedia.org",
    "jfa.jp",
    "tokyofa.or.jp",
    "kanagawa-fa.gr.jp",
    "saitamafa.or.jp",
    "chiba-fa.gr.jp",
    "ibaraki-fa.jp",
    "tfa.or.jp",
    "gunma-fa.com",
    "kanto-cy.com",
    "tokyo-cy.jp",
    "kanagawa-cy.com",
    "saitama-cy.com",
    "chiba-cy.com",
    "ibaraki-cy.com",
    "tochigi-cy.com",
    "gunma-cy.com",
    "saitama-u12.com",
  ];

  if (!s.startsWith("http")) return true;
  if (badHosts.some((h) => host.includes(h))) return true;

  const badExt = [".pdf", ".xlsx", ".xls", ".doc", ".docx", ".ppt", ".pptx", ".zip"];
  if (badExt.some((x) => s.includes(x))) return true;

  const badPaths = [
    "/result",
    "/results",
    "/schedule",
    "/ranking",
    "/standings",
    "/tournament",
    "/league",
    "/news",
    "/notice",
    "/topics",
    "/entry",
    "/match",
    "/game",
  ];

  if (badPaths.some((p) => s.includes(p))) return true;

  return false;
}

function looseName(name: string) {
  return clean(name)
    .toLowerCase()
    .replace(/[　\s・.．\-ー_＿]/g, "")
    .replace(/footballclub/g, "fc")
    .replace(/soccerclub/g, "sc")
    .replace(/フットボールクラブ/g, "fc")
    .replace(/サッカークラブ/g, "sc")
    .replace(/ＦＣ/g, "fc")
    .replace(/ＳＣ/g, "sc");
}

function scoreCandidate(teamName: string, prefecture: string | null, item: any) {
  const title = clean(item.title || "");
  const link = clean(item.link || "");
  const snippet = clean(item.snippet || "");
  const textRaw = `${title} ${link} ${snippet}`;
  const text = textRaw.toLowerCase();
  const host = hostOf(link);

  if (!link || isBadUrl(link)) return -999;

  let score = 0;

  const teamLoose = looseName(teamName);
  const textLoose = looseName(textRaw);

  if (textLoose.includes(teamLoose)) score += 80;
  if (title && looseName(title).includes(teamLoose)) score += 60;
  if (prefecture && textRaw.includes(prefecture)) score += 10;

  if (text.includes("公式")) score += 35;
  if (text.includes("official")) score += 30;
  if (text.includes("ホームページ")) score += 25;
  if (text.includes("ホーム")) score += 10;

  if (text.includes("サッカー")) score += 15;
  if (text.includes("フットボール")) score += 12;
  if (text.includes("ジュニアユース")) score += 15;
  if (text.includes("ユース")) score += 10;
  if (text.includes("少年団")) score += 12;
  if (text.includes("スクール")) score += 8;
  if (text.includes("fc") || text.includes("sc")) score += 8;

  if (host.includes("wixsite.com")) score += 10;
  if (host.includes("jimdo")) score += 10;
  if (host.includes("amebaownd.com")) score += 10;
  if (host.includes("footballnavi.jp")) score += 15;
  if (host.includes("sports-joy.com")) score += 10;

  if (text.includes("試合結果")) score -= 40;
  if (text.includes("大会")) score -= 35;
  if (text.includes("リーグ")) score -= 25;
  if (text.includes("速報")) score -= 30;
  if (text.includes("掲示板")) score -= 40;
  if (text.includes("選手権")) score -= 20;
  if (text.includes("トーナメント")) score -= 20;

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
    `"${teamName}" 公式`,
    `"${teamName}" サッカー 公式`,
    `"${teamName}" ホームページ`,
    `"${teamName}" ${prefecture ?? ""} サッカー`,
    `"${teamName}" ジュニアユース`,
    `"${teamName}" 少年団`,
  ];

  const map = new Map<string, any>();

  for (const q of queries) {
    const result = await searchSerper(q);
    const organic = result?.organic ?? [];

    for (const item of organic) {
      const score = scoreCandidate(teamName, prefecture ?? null, item);
      if (score < 45) continue;

      const officialUrl = normalizeOfficialUrl(item.link);
      const key = officialUrl;

      const current = map.get(key);
      if (!current || score > current.score) {
        map.set(key, {
          official_url: officialUrl,
          found_url: item.link,
          title: item.title,
          snippet: item.snippet,
          score,
          query: q,
        });
      }
    }
  }

  const candidates = [...map.values()].sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
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

  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 20);
  const prefecture = body.prefecture ?? null;

  let query = supabase
    .from("team_directory")
    .select("id,team_name,prefecture,category,official_url,status")
    .or("official_url.is.null,status.eq.needs_url,status.is.null")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (prefecture) {
    query = query.eq("prefecture", prefecture);
  }

  const { data: teams, error } = await query;

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let checked = 0;
  let found = 0;
  let insertedHomepages = 0;
  let insertedSources = 0;
  let notFound = 0;

  const results: any[] = [];
  const errors: any[] = [];

  for (const team of teams ?? []) {
    checked++;

    try {
      const homepage = await findOfficialHomepage(team.team_name, team.prefecture);

      if (!homepage?.official_url) {
        notFound++;

        await supabase
          .from("team_directory")
          .update({
            status: "url_not_found",
          })
          .eq("id", team.id);

        results.push({
          team_name: team.team_name,
          status: "not_found",
        });

        continue;
      }

      found++;

      await supabase
        .from("team_directory")
        .update({
          official_url: homepage.official_url,
          status: "url_found",
        })
        .eq("id", team.id);

      const { error: hpError } = await supabase.from("team_homepages").insert({
        team_directory_id: team.id,
        team_name: team.team_name,
        prefecture: team.prefecture,
        official_url: homepage.official_url,
        homepage_status: "active",
        last_checked_at: new Date().toISOString(),
      });

      if (!hpError) insertedHomepages++;

      const { error: sourceError } = await supabase.from("selection_sources").insert({
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
        found_url: homepage.found_url,
        title: homepage.title,
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
    limit,
    prefecture,
    checked,
    found,
    notFound,
    insertedHomepages,
    insertedSources,
    results,
    errors,
  });
});