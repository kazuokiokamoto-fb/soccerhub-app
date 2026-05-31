// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 5;

function clean(v: string) {
  return String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
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
    u.hash = "";
    const shared = ["wixsite.com", "jimdo", "amebaownd.com", "footballnavi.jp", "sports-joy.com"];
    if (shared.some((h) => u.hostname.includes(h))) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]) return `${u.protocol}//${u.hostname}/${p[0]}/`;
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
    "instagram.com", "facebook.com", "twitter.com", "x.com",
    "youtube.com", "youtu.be", "line.me", "google.com",
    "jfa.jp", "tokyofa.or.jp", "kanagawa-fa.gr.jp",
    "saitamafa.or.jp", "chiba-fa.gr.jp", "ibaraki-fa.jp",
    "tfa.or.jp", "gunma-fa.com", "kanto-cy.com",
    "tokyo-cy.jp", "kanagawa-cy.com", "saitama-cy.com",
    "chiba-cy.com", "ibaraki-cy.com", "tochigi-cy.com",
    "gunma-cy.com", "saitama-u12.com"
  ];

  if (!s.startsWith("http")) return true;
  if (badHosts.some((h) => host.includes(h))) return true;
  if (/\.(pdf|xlsx|xls|doc|docx|zip|jpg|png|gif|webp)(\?|$)/i.test(s)) return true;
  if (s.includes("/result") || s.includes("/schedule") || s.includes("/news")) return true;

  return false;
}

function loose(v: string) {
  return clean(v)
    .toLowerCase()
    .replace(/[　\s・.．\-ー_＿]/g, "")
    .replace(/フットボールクラブ/g, "fc")
    .replace(/サッカークラブ/g, "sc")
    .replace(/ＦＣ/g, "fc")
    .replace(/ＳＣ/g, "sc");
}

function scoreLink(teamName: string, url: string, text: string) {
  if (isBadUrl(url)) return -999;

  const all = `${url} ${text}`;
  const lAll = loose(all);
  const lTeam = loose(teamName);

  let score = 0;
  if (lAll.includes(lTeam)) score += 80;
  if (all.includes("公式")) score += 30;
  if (all.toLowerCase().includes("official")) score += 30;
  if (all.includes("ホームページ")) score += 25;
  if (all.includes("HP")) score += 15;
  if (all.includes("サッカー")) score += 10;
  if (url.includes("footballnavi.jp")) score += 15;
  if (url.includes("wixsite.com") || url.includes("jimdo") || url.includes("amebaownd.com")) score += 10;
  return score;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 team-homepage-from-source/1.0",
      accept: "text/html,*/*",
    },
  });

  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url || url,
    html: await res.text(),
  };
}

function extractLinks(html: string, baseUrl: string) {
  const out: any[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    try {
      const url = new URL(m[1], baseUrl).toString();
      const text = clean(m[2]);
      out.push({ url, text });
    } catch {}
  }

  return out;
}

async function readBody(req: Request) {
  try {
    if (!(req.headers.get("content-type") || "").includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  const body = await readBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRole) {
    return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 20);

  const { data: teams, error } = await supabase
    .from("team_directory")
    .select("id,team_name,prefecture,category,source_url")
    .eq("status", "needs_url")
    .not("source_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let checked = 0;
  let found = 0;
  let notFound = 0;
  const results: any[] = [];

  for (const team of teams ?? []) {
    checked++;

    try {
      const page = await fetchHtml(team.source_url);
      if (!page.ok) throw new Error(`HTTP ${page.status}`);

      const links = extractLinks(page.html, page.finalUrl);
      const scored = links
        .map((x) => ({ ...x, score: scoreLink(team.team_name, x.url, x.text) }))
        .filter((x) => x.score >= 40)
        .sort((a, b) => b.score - a.score);

      const best = scored[0];

      if (!best) {
        notFound++;
        await supabase.from("team_directory").update({ status: "url_not_found_source" }).eq("id", team.id);
        results.push({ team_name: team.team_name, status: "not_found" });
        continue;
      }

      const officialUrl = normalizeOfficialUrl(best.url);
      found++;

      await supabase.from("team_directory").update({
        official_url: officialUrl,
        status: "url_found",
      }).eq("id", team.id);

      await supabase.from("team_homepages").insert({
        team_directory_id: team.id,
        team_name: team.team_name,
        prefecture: team.prefecture,
        official_url: officialUrl,
        homepage_status: "active",
        last_checked_at: new Date().toISOString(),
      });

      await supabase.from("selection_sources").insert({
        name: team.team_name,
        base_url: officialUrl,
        organization_type: team.category || "club_team",
        enabled: true,
        crawl_type: "web",
        crawl_interval_minutes: 1440,
        source_rank: null,
      });

      results.push({
        team_name: team.team_name,
        official_url: officialUrl,
        found_url: best.url,
        link_text: best.text,
        score: best.score,
        status: "found",
      });
    } catch (e) {
      results.push({ team_name: team.team_name, status: "error", error: String(e) });
    }
  }

  return Response.json({ ok: true, checked, found, notFound, results });
});