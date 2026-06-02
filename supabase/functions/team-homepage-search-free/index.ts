// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 2;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BAD_HOSTS = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "tiktok.com",
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "yahoo.co.jp",
  "jfa.jp",
  "footballnavi.jp/team_list",
  "tokyofa.or.jp",
  "kanagawa-fa.gr.jp",
  "saitamafa.or.jp",
  "chiba-fa.gr.jp",
  "ibaraki-fa.jp",
  "tochigi-fa.gr.jp",
  "tfa.or.jp",
  "gunma-fa.com",
  "yamanashi-football.com",
  "tokyo-cy.jp",
  "kanagawa-cy.com",
  "saitama-cy.com",
  "chiba-cy.com",
  "ibaraki-cy.com",
  "tochigi-cy.com",
  "gunma-cy.com",
  "saitama-u12.com",
];

const GOOD_WORDS = [
  "公式",
  "公式サイト",
  "公式ホームページ",
  "ホームページ",
  "official",
  "サッカー",
  "soccer",
  "football",
  "fc",
  "sc",
  "ジュニアユース",
  "ユース",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "academy",
  "club",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(v: string) {
  return String(v ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(String(url ?? "").trim());
    u.hash = "";

    const sharedHosts = [
      "wixsite.com",
      "jimdo.com",
      "jimdofree.com",
      "amebaownd.com",
      "footballnavi.jp",
      "sgrum.com",
      "sports-joy.com",
      "peraichi.com",
    ];

    if (sharedHosts.some((h) => u.hostname.includes(h))) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) {
        return `${u.protocol}//${u.hostname}/${parts[0]}/`;
      }
    }

    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return "";
  }
}

function loose(v: string) {
  return clean(v)
    .toLowerCase()
    .replace(/[　\s・.．\-ー_＿]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/ｆｃ/g, "fc")
    .replace(/ｓｃ/g, "sc")
    .replace(/ＦＣ/g, "fc")
    .replace(/ＳＣ/g, "sc")
    .replace(/フットボールクラブ/g, "fc")
    .replace(/サッカークラブ/g, "sc")
    .replace(/ジュニアユース/g, "jy")
    .replace(/ジュニア/g, "jr")
    .replace(/ユース/g, "youth");
}

function isBadUrl(url: string) {
  const s = safeDecode(String(url || "").toLowerCase());
  const host = hostOf(url);

  if (!s.startsWith("http")) return true;
  if (/\.(pdf|xlsx|xls|doc|docx|zip|jpg|jpeg|png|gif|webp|svg|css|js|mp4|mov)(\?|$)/i.test(s)) {
    return true;
  }

  if (
    s.includes("/result") ||
    s.includes("/results") ||
    s.includes("/schedule") ||
    s.includes("/news") ||
    s.includes("/blog/") ||
    s.includes("/entry") ||
    s.includes("/contact") ||
    s.includes("/map") ||
    s.includes("/access")
  ) {
    return true;
  }

  return BAD_HOSTS.some((h) => {
    if (h.includes("/")) return s.includes(h);
    return host === h || host.endsWith(`.${h}`);
  });
}

function scoreUrl(teamName: string, prefecture: string, category: string, url: string, title = "", snippet = "") {
  if (isBadUrl(url)) return -999;

  const all = safeDecode(`${url} ${title} ${snippet}`);
  const lAll = loose(all);
  const lTeam = loose(teamName);

  let score = 0;

  if (lAll.includes(lTeam)) score += 100;

  const parts = lTeam
    .split(/fc|sc|u15|u18|jy|jr|東京|神奈川|埼玉|千葉|茨城|栃木|群馬|山梨/)
    .filter((x) => x.length >= 3);

  for (const p of parts) {
    if (lAll.includes(p)) score += 15;
  }

  for (const w of GOOD_WORDS) {
    if (all.toLowerCase().includes(w.toLowerCase())) score += 8;
  }

  if (all.includes(prefecture.replace("県", "").replace("都", ""))) score += 10;

  if (category === "junior_youth" && /u-15|u15|ジュニアユース|jy/i.test(all)) score += 15;
  if (category === "youth" && /u-18|u18|ユース|youth/i.test(all)) score += 15;
  if (category === "junior" && /u-12|u12|ジュニア|少年/i.test(all)) score += 15;

  if (/official|公式|ホームページ/i.test(all)) score += 25;

  if (/wixsite|jimdo|jimdofree|amebaownd|footballnavi|sgrum|sports-joy|peraichi/i.test(url)) {
    score += 8;
  }

  return score;
}

async function fetchText(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-homepage-search-free/1.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      url: res.url || url,
      text: await res.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractDuckDuckGoResults(html: string) {
  const results: any[] = [];

  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    let url = String(m[1] || "");
    const title = clean(m[2]);

    try {
      if (url.includes("/l/?")) {
        const u = new URL(url, "https://duckduckgo.com");
        const uddg = u.searchParams.get("uddg");
        if (uddg) url = uddg;
      }
    } catch {}

    url = safeDecode(url);
    if (url.startsWith("http")) {
      results.push({ url, title, snippet: "" });
    }
  }

  return results;
}

function extractBingResults(html: string) {
  const results: any[] = [];

  const re = /<li class="b_algo"[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let m;

  while ((m = re.exec(html))) {
    const url = safeDecode(String(m[1] || ""));
    const title = clean(m[2]);
    const snippet = clean(m[3] || "");

    if (url.startsWith("http")) {
      results.push({ url, title, snippet });
    }
  }

  return results;
}

async function searchFree(query: string) {
  const encoded = encodeURIComponent(query);
  const all: any[] = [];

  try {
    const ddg = await fetchText(`https://duckduckgo.com/html/?q=${encoded}`, 9000);
    if (ddg.ok) all.push(...extractDuckDuckGoResults(ddg.text));
  } catch {}

  await sleep(1200);

  try {
    const bing = await fetchText(`https://www.bing.com/search?q=${encoded}`, 9000);
    if (bing.ok) all.push(...extractBingResults(bing.text));
  } catch {}

  const seen = new Set<string>();
  return all.filter((r) => {
    const key = normalizeUrl(r.url) || r.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const body = await readBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRole =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRole) {
    return Response.json(
      { ok: false, error: "Missing Supabase env" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const limit = Math.max(1, Math.min(Number(body.limit ?? DEFAULT_LIMIT), 3));
  const minScore = Math.max(40, Math.min(Number(body.minScore ?? 70), 150));

  const { data: teams, error } = await supabase
    .from("team_directory")
    .select("id,team_name,prefecture,category,source_name,source_url,status,official_url")
    .is("official_url", null)
    .in("status", ["needs_url", "url_search_error", "url_not_found_free", "url_not_found_source"])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  let checked = 0;
  let found = 0;
  let notFound = 0;
  let searchErrors = 0;

  const results: any[] = [];

  for (const team of teams ?? []) {
    checked++;

    await supabase
      .from("team_directory")
      .update({
        status: "url_searching",
        updated_at: new Date().toISOString(),
      })
      .eq("id", team.id);

    try {
      const queries = [
        `${team.team_name} ${team.prefecture} サッカー 公式`,
        `${team.team_name} サッカー 公式ホームページ`,
        `${team.team_name} ${team.category || ""} football official`,
      ];

      const candidates: any[] = [];

      for (const q of queries) {
        const rows = await searchFree(q);

        for (const r of rows) {
          const score = scoreUrl(
            team.team_name,
            team.prefecture || "",
            team.category || "",
            r.url,
            r.title,
            r.snippet,
          );

          if (score >= minScore) {
            candidates.push({
              query: q,
              url: r.url,
              title: r.title,
              snippet: r.snippet,
              score,
              normalized: normalizeUrl(r.url),
            });
          }
        }

        if (candidates.length > 0) break;
        await sleep(1800);
      }

      candidates.sort((a, b) => b.score - a.score);

      const best = candidates[0];

      if (!best?.normalized) {
        notFound++;

        await supabase
          .from("team_directory")
          .update({
            status: "url_not_found_free",
            updated_at: new Date().toISOString(),
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
          official_url: best.normalized,
          status: "url_found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      const { error: hpError } = await supabase.from("team_homepages").insert({
        team_directory_id: team.id,
        team_name: team.team_name,
        prefecture: team.prefecture,
        official_url: best.normalized,
        homepage_status: "active",
        last_checked_at: new Date().toISOString(),
      });

      const { error: srcError } = await supabase.from("selection_sources").insert({
        name: team.team_name,
        base_url: best.normalized,
        organization_type: team.category || "club_team",
        enabled: true,
        crawl_type: "web",
        crawl_interval_minutes: 1440,
        source_rank: null,
      });

      results.push({
        team_name: team.team_name,
        official_url: best.normalized,
        found_url: best.url,
        title: best.title,
        score: best.score,
        status: "found",
        team_homepages_error: hpError?.message || null,
        selection_sources_error: srcError?.message || null,
      });
    } catch (e) {
      searchErrors++;

      await supabase
        .from("team_directory")
        .update({
          status: "url_search_error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      results.push({
        team_name: team.team_name,
        status: "error",
        error: String(e),
      });
    }

    await sleep(2500);
  }

  return Response.json(
    {
      ok: true,
      mode: "team_homepage_search_free",
      limit,
      minScore,
      checked,
      found,
      notFound,
      searchErrors,
      results,
    },
    { headers: CORS_HEADERS },
  );
});