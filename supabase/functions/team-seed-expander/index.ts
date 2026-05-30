// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOD_WORDS = [
  "team", "club", "member", "link", "league", "u12", "u-12", "u15", "u-15",
  "junior", "youth", "block", "area", "competition", "result", "schedule",
  "チーム", "クラブ", "加盟", "一覧", "リンク", "少年", "第", "ブロック",
  "地区", "市", "区", "リーグ", "大会", "高円宮", "4種", "3種"
];

const BAD_WORDS = [
  "facebook", "instagram", "twitter", "x.com", "youtube", "line.me",
  ".jpg", ".png", ".pdf", ".zip", ".css", ".js", "mailto:", "tel:"
];

function clean(v: string) {
  return String(v ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

function isGoodLink(url: string, text = "") {
  const s = decodeURIComponent(`${url} ${text}`.toLowerCase());
  if (!url.startsWith("http")) return false;
  if (BAD_WORDS.some((w) => s.includes(w))) return false;
  return GOOD_WORDS.some((w) => s.includes(w));
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = m[1];
    const text = clean(m[2]);
    try {
      const url = normalizeUrl(new URL(href, baseUrl).toString());
      if (url) links.push({ url, text });
    } catch {}
  }

  return links;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 team-seed-expander/1.0" },
    });

    return {
      ok: res.ok,
      finalUrl: normalizeUrl(res.url || url),
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRole);

  const body = await req.json().catch(() => ({}));
  const limit = Number(body.limit ?? 100);
  const maxNewPerSeed = Number(body.maxNewPerSeed ?? 50);

  const { data: seeds, error } = await supabase
    .from("team_directory_seeds")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let inserted = 0;
  let checked = 0;
  const insertedRows: any[] = [];
  const errors: any[] = [];

  for (const seed of seeds ?? []) {
    checked++;

    let page;
    try {
      page = await fetchHtml(seed.url);
    } catch (e) {
      errors.push({ seed: seed.name, url: seed.url, error: String(e) });
      continue;
    }

    if (!page.ok) continue;

    const links = extractLinks(page.html, page.finalUrl || seed.url);
    let perSeed = 0;

    for (const link of links) {
      if (perSeed >= maxNewPerSeed) break;

      if (hostOf(link.url) !== hostOf(seed.url)) continue;
      if (!isGoodLink(link.url, link.text)) continue;

      const name = clean(`${seed.name} ${link.text || link.url}`).slice(0, 120);

      const { data, error: insertError } = await supabase
        .from("team_directory_seeds")
        .insert({
          name,
          url: link.url,
          prefecture: seed.prefecture,
          seed_type: "expanded_page",
          enabled: true,
        })
        .select("id,name,url,prefecture,seed_type")
        .single();

      if (insertError) continue;

      inserted++;
      perSeed++;
      if (insertedRows.length < 50) insertedRows.push(data);
    }
  }

  return Response.json({
    ok: true,
    checked,
    inserted,
    insertedRows,
    errors: errors.slice(0, 30),
  });
});