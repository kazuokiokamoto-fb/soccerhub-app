// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ROWS = 20;
const FETCH_TIMEOUT_MS = 12000;

const BAD_DOMAINS = [
  "gekisaka.jp",
  "web.gekisaka.jp",
  "playerapp.tokyo",
  "web.playerapp.tokyo",
  "japan-football.net",
  "soccer-db.net",
  "transfermarkt",
  "wikipedia.org",
  "jfa.jp",
  "jfa.or.jp",
  "goal.com",
  "soccerdigestweb.com",
  "sports.yahoo.co.jp",
  "news.yahoo.co.jp",
  "prtimes.jp",
  "city.",
  ".lg.jp",
  "pref.",
  "ameblo.jp",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "lin.ee",
  "google.com",
  "forms.gle",
  "docs.google.com",
];

const BAD_URL_PARTS = [
  "/news/",
  "/result",
  "/results",
  "/schedule",
  "/calendar",
  "/ranking",
  "/standings",
  "/match",
  "/game",
  "/blog",
  "/category/",
  "/tag/",
  "/archive/",
  "/archives/",
  "/author/",
  "/feed",
  "/rss",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
];

const TEAM_WORDS = [
  "fc",
  "sc",
  "サッカー",
  "soccer",
  "football",
  "フットボール",
  "クラブ",
  "club",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "u-12",
  "u12",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "academy",
  "アカデミー",
  "少年団",
];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/\s+/g, "")
    .replace(/[・･\.\-ー＿_（）()［\]【】]/g, "");
}

function stripTags(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
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

function originOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isBadUrl(url: string) {
  const u = String(url || "").toLowerCase();
  const h = hostOf(u);

  if (!u.startsWith("http://") && !u.startsWith("https://")) return true;
  if (!h) return true;
  if (BAD_DOMAINS.some((d) => h.includes(d) || u.includes(d))) return true;
  if (BAD_URL_PARTS.some((p) => u.includes(p))) return true;

  return false;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractSearchLinks(html: string) {
  const links: string[] = [];

  const re = /href="([^"]+)"/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    let href = m[1];

    href = href.replace(/&amp;/g, "&");

    if (href.includes("uddg=")) {
      try {
        const u = new URL(href, "https://duckduckgo.com");
        const real = u.searchParams.get("uddg");
        if (real) href = decodeURIComponent(real);
      } catch {}
    }

    if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
    if (isBadUrl(href)) continue;

    const origin = originOf(href);
    if (origin && !links.includes(origin)) links.push(origin);
  }

  return links.slice(0, 20);
}

async function searchWeb(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  return extractSearchLinks(html);
}

function getTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  return `${stripTags(title)} ${stripTags(h1)}`.trim();
}

function scoreCandidate(url: string, html: string, team: any) {
  const teamName = team.team_name || "";
  const pref = team.prefecture || "";
  const host = hostOf(url);
  const title = getTitle(html);
  const text = stripTags(html).slice(0, 5000);

  const nTeam = normalizeText(teamName);
  const nHost = normalizeText(host);
  const nTitle = normalizeText(title);
  const nText = normalizeText(text);
  const hay = `${url} ${host} ${title} ${text}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (!nTeam || isBadUrl(url)) return { score: -999, reasons: ["bad_url"] };

  if (nTitle.includes(nTeam)) {
    score += 100;
    reasons.push("title_has_team_name");
  }

  if (nText.includes(nTeam)) {
    score += 60;
    reasons.push("body_has_team_name");
  }

  const teamParts = nTeam
    .split(/fc|sc|クラブ|サッカー|ジュニア|ユース/)
    .filter((x) => x.length >= 3);

  for (const p of teamParts.slice(0, 3)) {
    if (nTitle.includes(p)) {
      score += 35;
      reasons.push(`title_has_part:${p}`);
    }
    if (nHost.includes(p)) {
      score += 35;
      reasons.push(`host_has_part:${p}`);
    }
  }

  if (pref && hay.includes(pref.toLowerCase())) {
    score += 15;
    reasons.push("prefecture_hint");
  }

  if (TEAM_WORDS.some((w) => hay.includes(w.toLowerCase()))) {
    score += 25;
    reasons.push("team_words");
  }

  if (
    host.includes("footballnavi") ||
    host.includes("jimdo") ||
    host.includes("jimdofree") ||
    host.includes("wixsite") ||
    host.includes("sports") ||
    host.includes("fc-") ||
    host.includes("-fc") ||
    host.includes("sc-") ||
    host.includes("-sc")
  ) {
    score += 25;
    reasons.push("team_site_builder_or_host");
  }

  if (score < 90) {
    return { score, reasons: [...reasons, "below_threshold"] };
  }

  return { score, reasons };
}

async function claimTeams(limit: number) {
  const { data, error } = await supabase
    .from("team_directory")
    .select("*")
    .or("homepage_search_status.is.null,homepage_search_status.eq.unchecked,homepage_search_status.eq.retry")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = data || [];

  if (rows.length > 0) {
    await supabase
      .from("team_directory")
      .update({
        homepage_search_status: "processing",
        homepage_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", rows.map((r) => r.id));
  }

  return rows;
}

async function saveHomepage(team: any, best: any) {
  await supabase
    .from("team_directory")
    .update({
      homepage_url: best.url,
      official_url: best.url,
      homepage_search_status: "found",
      homepage_search_reason: best.reason,
      homepage_checked_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", team.id);

  const { data: existing } = await supabase
    .from("team_homepages")
    .select("id")
    .eq("team_directory_id", team.id)
    .maybeSingle();

  const row = {
    team_directory_id: team.id,
    team_name: team.team_name,
    prefecture: team.prefecture,
    official_url: best.url,
    homepage_status: "found",
    last_checked_at: nowIso(),
    updated_at: nowIso(),
  };

  if (existing?.id) {
    await supabase.from("team_homepages").update(row).eq("id", existing.id);
  } else {
    await supabase.from("team_homepages").insert({
      ...row,
      created_at: nowIso(),
    });
  }
}

async function markNotFound(team: any, reason: string) {
  await supabase
    .from("team_directory")
    .update({
      homepage_search_status: "not_found",
      homepage_search_reason: reason.slice(0, 500),
      homepage_checked_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", team.id);
}

async function processTeam(team: any) {
  const teamName = team.team_name || "";
  const pref = team.prefecture || "";

  const queries = [
    `${teamName} ${pref} サッカー`,
    `${teamName} 公式`,
    `${teamName} football club`,
  ];

  const seen = new Set<string>();
  const candidates: any[] = [];

  for (const q of queries) {
    const urls = await searchWeb(q);

    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);

      try {
        const html = await fetchText(url);
        const scored = scoreCandidate(url, html, team);

        candidates.push({
          url,
          score: scored.score,
          reasons: scored.reasons,
        });
      } catch (e) {
        candidates.push({
          url,
          score: -1,
          reasons: [`fetch_error:${String(e?.message || e).slice(0, 80)}`],
        });
      }

      await new Promise((r) => setTimeout(r, 250));
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best && best.score >= 90) {
    await saveHomepage(team, {
      url: best.url,
      reason: `score:${best.score}; ${best.reasons.join(",")}`,
    });

    return {
      status: "found",
      team_name: teamName,
      prefecture: pref,
      url: best.url,
      score: best.score,
      candidates: candidates.slice(0, 5),
    };
  }

  await markNotFound(
    team,
    `no_good_candidate; best:${best?.url || "none"} score:${best?.score ?? "none"} reasons:${best?.reasons?.join(",") || ""}`,
  );

  return {
    status: "not_found",
    team_name: teamName,
    prefecture: pref,
    best,
    candidates: candidates.slice(0, 5),
  };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.batchSize || body.limit || 5), MAX_ROWS);

    const teams = await claimTeams(limit);

    const results = [];
    let found = 0;
    let notFound = 0;
    let errors = 0;

    for (const team of teams) {
      try {
        const r = await processTeam(team);
        results.push(r);

        if (r.status === "found") found++;
        else notFound++;
      } catch (e) {
        errors++;

        await supabase
          .from("team_directory")
          .update({
            homepage_search_status: "error",
            homepage_search_reason: String(e?.message || e).slice(0, 500),
            homepage_checked_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq("id", team.id);

        results.push({
          status: "error",
          team_name: team.team_name,
          error: String(e?.message || e),
        });
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    return json({
      ok: true,
      mode: "find-team-homepages",
      claimed: teams.length,
      found,
      notFound,
      errors,
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