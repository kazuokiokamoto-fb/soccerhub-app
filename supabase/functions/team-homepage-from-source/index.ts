// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 5;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: any, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function clean(v: string) {
  return String(v ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|tr|td|th|p|div|h1|h2|h3|h4|a)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\u3000/g, " ")
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

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function normalizeOfficialUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";

    const shared = [
      "wixsite.com",
      "jimdo",
      "amebaownd.com",
      "footballnavi.jp",
      "sports-joy.com",
      "sgrum.com",
      "jimdofree.com",
      "webnode.jp",
    ];

    if (shared.some((h) => u.hostname.includes(h))) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]) return `${u.protocol}//${u.hostname}/${p[0]}/`;
    }

    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return String(url || "").trim();
  }
}

function isBadUrl(url: string) {
  const s = safeDecode(String(url || "").toLowerCase());
  const host = hostOf(url);

  const badHosts = [
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "line.me",
    "google.com",
    "jfa.jp",

    "tokyofa.or.jp",
    "kanagawa-fa.gr.jp",
    "saitamafa.or.jp",
    "chiba-fa.gr.jp",
    "ibaraki-fa.jp",
    "tfa.or.jp",
    "tochigi-fa.gr.jp",
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
  if (badHosts.some((h) => host === h || host.endsWith(`.${h}`))) return true;

  if (/\.(pdf|xlsx|xls|doc|docx|zip|jpg|jpeg|png|gif|webp|svg|css|js|mp4|mov)(\?|$)/i.test(s)) {
    return true;
  }

  if (
    s.includes("/result") ||
    s.includes("/results") ||
    s.includes("/schedule") ||
    s.includes("/news") ||
    s.includes("/match") ||
    s.includes("/competition") ||
    s.includes("/tournament")
  ) {
    return true;
  }

  return false;
}

function loose(v: string) {
  return clean(v)
    .toLowerCase()
    .replace(/[　\s・.．\-ー_＿]/g, "")
    .replace(/フットボールクラブ/g, "fc")
    .replace(/サッカークラブ/g, "sc")
    .replace(/ジュニアユース/g, "jy")
    .replace(/ジュニア/g, "jr")
    .replace(/ＦＣ/g, "fc")
    .replace(/ＳＣ/g, "sc")
    .replace(/fc/g, "fc")
    .replace(/sc/g, "sc");
}

function scoreLink(teamName: string, url: string, text: string) {
  if (isBadUrl(url)) return -999;

  const raw = `${safeDecode(url)} ${text}`;
  const s = raw.toLowerCase();
  const lAll = loose(raw);
  const lTeam = loose(teamName);

  let score = 0;

  if (lAll.includes(lTeam)) score += 90;

  const parts = lTeam
    .split(/fc|sc|jy|jr/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);

  for (const p of parts) {
    if (lAll.includes(p)) score += 20;
  }

  if (raw.includes("公式")) score += 35;
  if (s.includes("official")) score += 35;
  if (raw.includes("ホームページ")) score += 30;
  if (raw.includes("HP")) score += 15;
  if (raw.includes("サッカー")) score += 10;

  if (s.includes("football")) score += 10;
  if (s.includes("soccer")) score += 10;
  if (s.includes("club")) score += 8;
  if (s.includes("team")) score += 8;

  if (url.includes("footballnavi.jp")) score += 20;
  if (url.includes("wixsite.com")) score += 12;
  if (url.includes("jimdo")) score += 12;
  if (url.includes("amebaownd.com")) score += 12;
  if (url.includes("sgrum.com")) score += 12;

  return score;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-homepage-from-source/2.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let utf8 = "";
    let sjis = "";

    try {
      utf8 = new TextDecoder("utf-8").decode(bytes);
    } catch {
      utf8 = "";
    }

    try {
      sjis = new TextDecoder("shift-jis").decode(bytes);
    } catch {
      sjis = "";
    }

    const head = utf8.slice(0, 3000).toLowerCase();

    const saysSjis =
      head.includes("shift_jis") ||
      head.includes("shift-jis") ||
      head.includes("charset=windows-31j") ||
      head.includes("charset=x-sjis");

    const utf8Bad = (utf8.match(/�|縺|譁|荳|繧|蜷|陦|隕|螟/g) || []).length;
    const sjisBad = (sjis.match(/�|縺|譁|荳|繧|蜷|陦|隕|螟/g) || []).length;

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      html: saysSjis || sjisBad < utf8Bad ? sjis : utf8,
      encoding: saysSjis || sjisBad < utf8Bad ? "shift-jis" : "utf-8",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html: string, baseUrl: string) {
  const out: any[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = String(m[1] ?? "").trim();
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const url = new URL(href, baseUrl).toString();
      const text = clean(m[2]);
      out.push({ url, text });
    } catch {}
  }

  const seen = new Set<string>();

  return out.filter((x) => {
    const key = x.url.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readBody(req: Request) {
  try {
    if (!(req.headers.get("content-type") || "").includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

async function ensureTeamHomepage(supabase: any, team: any, officialUrl: string) {
  const { data: existing } = await supabase
    .from("team_homepages")
    .select("id")
    .eq("team_directory_id", team.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("team_homepages")
      .update({
        team_name: team.team_name,
        prefecture: team.prefecture,
        official_url: officialUrl,
        homepage_status: "active",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return "updated";
  }

  const { error } = await supabase.from("team_homepages").insert({
    team_directory_id: team.id,
    team_name: team.team_name,
    prefecture: team.prefecture,
    official_url: officialUrl,
    homepage_status: "active",
    last_checked_at: new Date().toISOString(),
  });

  if (error && error.code !== "23505") throw error;
  return error?.code === "23505" ? "skipped_duplicate" : "inserted";
}

async function ensureSelectionSource(supabase: any, team: any, officialUrl: string) {
  const { data: existing } = await supabase
    .from("selection_sources")
    .select("id")
    .eq("base_url", officialUrl)
    .maybeSingle();

  if (existing?.id) return "already_exists";

  const { error } = await supabase.from("selection_sources").insert({
    name: team.team_name,
    base_url: officialUrl,
    organization_type: team.category || "club_team",
    enabled: true,
    crawl_type: "web",
    crawl_interval_minutes: 1440,
    source_rank: null,
  });

  if (error && error.code !== "23505") throw error;
  return error?.code === "23505" ? "skipped_duplicate" : "inserted";
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
    return json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const limit = Math.max(1, Math.min(Number(body.limit ?? DEFAULT_LIMIT), 20));
  const minScore = Math.max(20, Math.min(Number(body.minScore ?? 40), 100));

  const { data: teams, error } = await supabase
    .from("team_directory")
    .select("id,team_name,prefecture,category,source_name,source_url,official_url,status,created_at")
    .is("official_url", null)
    .not("source_url", "is", null)
    .in("status", ["needs_url", "url_error", "url_not_found_source"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, { status: 500 });
  }

  let checked = 0;
  let found = 0;
  let notFound = 0;
  let errored = 0;

  const results: any[] = [];

  for (const team of teams ?? []) {
    checked++;

    try {
      await supabase
        .from("team_directory")
        .update({
          status: "url_checking",
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      const page = await fetchHtml(team.source_url);

      if (!page.ok) {
        throw new Error(`HTTP ${page.status}`);
      }

      const links = extractLinks(page.html, page.finalUrl);
      const scored = links
        .map((x) => ({
          ...x,
          normalized_url: normalizeOfficialUrl(x.url),
          score: scoreLink(team.team_name, x.url, x.text),
        }))
        .filter((x) => x.score >= minScore)
        .sort((a, b) => b.score - a.score);

      const best = scored[0];

      if (!best) {
        notFound++;

        await supabase
          .from("team_directory")
          .update({
            status: "url_not_found_source",
            updated_at: new Date().toISOString(),
          })
          .eq("id", team.id);

        results.push({
          team_name: team.team_name,
          prefecture: team.prefecture,
          source_url: team.source_url,
          status: "not_found",
          link_count: links.length,
          sample: scored.slice(0, 5),
        });

        continue;
      }

      const officialUrl = best.normalized_url;

      await supabase
        .from("team_directory")
        .update({
          official_url: officialUrl,
          status: "url_found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      let homepageWrite = null;
      let selectionSourceWrite = null;

      try {
        homepageWrite = await ensureTeamHomepage(supabase, team, officialUrl);
      } catch (e) {
        homepageWrite = `error: ${String(e)}`;
      }

      try {
        selectionSourceWrite = await ensureSelectionSource(supabase, team, officialUrl);
      } catch (e) {
        selectionSourceWrite = `error: ${String(e)}`;
      }

      found++;

      results.push({
        team_name: team.team_name,
        prefecture: team.prefecture,
        official_url: officialUrl,
        found_url: best.url,
        link_text: best.text,
        score: best.score,
        homepage_write: homepageWrite,
        selection_source_write: selectionSourceWrite,
        status: "found",
      });
    } catch (e) {
      errored++;

      await supabase
        .from("team_directory")
        .update({
          status: "url_error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      results.push({
        team_name: team.team_name,
        prefecture: team.prefecture,
        source_url: team.source_url,
        status: "error",
        error: String(e),
      });
    }
  }

  return json({
    ok: true,
    mode: "team_homepage_from_source",
    limit,
    minScore,
    checked,
    found,
    notFound,
    errored,
    results,
  });
});