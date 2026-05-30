// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOD_WORDS = [
  "team",
  "teams",
  "club",
  "clubs",
  "member",
  "members",
  "link",
  "links",
  "organization",
  "association",
  "block",
  "area",
  "district",
  "加盟",
  "登録",
  "チーム",
  "クラブ",
  "少年団",
  "団一覧",
  "チーム一覧",
  "クラブ一覧",
  "加盟チーム",
  "登録チーム",
  "参加チーム",
  "所属チーム",
  "チーム紹介",
  "クラブ紹介",
  "リンク",
  "関連リンク",
  "ブロック",
  "地区",
  "支部",
  "市区町村",
  "第1ブロック",
  "第2ブロック",
  "第3ブロック",
  "第4ブロック",
  "第5ブロック",
  "第6ブロック",
  "第7ブロック",
  "第8ブロック",
  "第9ブロック",
  "第10ブロック",
  "第11ブロック",
  "第12ブロック",
  "第13ブロック",
  "第14ブロック",
  "第15ブロック",
  "第16ブロック",
];

const BAD_WORDS = [
  "result",
  "results",
  "schedule",
  "match",
  "competition",
  "tournament",
  "calendar",
  "ranking",
  "rank",
  "score",
  "news",
  "entry",
  "application",
  "download",
  "pdf",
  "xlsx",
  "xls",
  "doc",
  "docx",
  "jpg",
  "png",
  "gif",
  "zip",
  "css",
  "js",
  "facebook",
  "instagram",
  "twitter",
  "x.com",
  "youtube",
  "line.me",
  "mailto:",
  "tel:",
  "試合",
  "結果",
  "日程",
  "大会",
  "トーナメント",
  "順位",
  "星取表",
  "組合せ",
  "組み合わせ",
  "スケジュール",
  "ニュース",
  "お知らせ",
  "申込",
  "申込み",
  "要項",
  "ダウンロード",
  "会場",
  "アクセス",
  "予選",
  "決勝",
  "ラウンド",
  "リーグ戦",
  "高円宮",
  "1次",
  "2次",
  "3次",
];

function clean(v: string) {
  return String(v ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

function isFileUrl(url: string) {
  const s = url.toLowerCase();
  return /\.(pdf|xlsx|xls|doc|docx|ppt|pptx|jpg|jpeg|png|gif|webp|zip|css|js|svg|ico|mp4|mov)(\?|$)/i.test(s);
}

function linkScore(url: string, text = "") {
  const s = decodeURIComponent(`${url} ${text}`.toLowerCase());

  if (!url.startsWith("http")) return -999;
  if (isFileUrl(url)) return -999;
  if (BAD_WORDS.some((w) => s.includes(w.toLowerCase()))) return -100;

  let score = 0;

  for (const w of GOOD_WORDS) {
    if (s.includes(w.toLowerCase())) score += 10;
  }

  if (s.includes("team") || s.includes("club")) score += 10;
  if (s.includes("チーム一覧") || s.includes("加盟チーム") || s.includes("登録チーム")) score += 40;
  if (s.includes("クラブ一覧") || s.includes("少年団一覧")) score += 40;
  if (s.includes("リンク") || s.includes("link")) score += 20;
  if (s.includes("ブロック") || s.includes("地区")) score += 15;

  return score;
}

function isGoodLink(url: string, text = "") {
  return linkScore(url, text) >= 10;
}

function inferSeedType(url: string, text = "") {
  const s = `${url} ${text}`.toLowerCase();

  if (s.includes("チーム一覧") || s.includes("加盟チーム") || s.includes("登録チーム")) return "team_list";
  if (s.includes("クラブ一覧") || s.includes("club")) return "club_list";
  if (s.includes("少年団")) return "junior_team_list";
  if (s.includes("ブロック") || s.includes("block")) return "block_page";
  if (s.includes("地区") || s.includes("area") || s.includes("district")) return "area_page";
  if (s.includes("link") || s.includes("リンク")) return "link_page";

  return "seed_page";
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string; score: number }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = m[1];
    const text = clean(m[2]);

    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const url = normalizeUrl(new URL(href, baseUrl).toString());
      if (!url) continue;

      const score = linkScore(url, text);
      if (score < 10) continue;

      links.push({ url, text, score });
    } catch {}
  }

  return links.sort((a, b) => b.score - a.score);
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-seed-expander/2.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: normalizeUrl(res.url || url),
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
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

  const limit = Math.min(Number(body.limit ?? 200), 2000);
  const offset = Number(body.offset ?? 0);
  const maxNewPerSeed = Math.min(Number(body.maxNewPerSeed ?? 30), 100);

  const { data: seeds, error } = await supabase
    .from("team_directory_seeds")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let inserted = 0;
  let checked = 0;
  let candidateLinks = 0;

  const insertedRows: any[] = [];
  const sampleLinks: any[] = [];
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
    candidateLinks += links.length;

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
          seed_type: inferSeedType(link.url, link.text),
          enabled: true,
        })
        .select("id,name,url,prefecture,seed_type")
        .single();

      if (insertError) continue;

      inserted++;
      perSeed++;

      if (insertedRows.length < 50) insertedRows.push(data);
      if (sampleLinks.length < 50) {
        sampleLinks.push({
          from: seed.name,
          text: link.text,
          url: link.url,
          score: link.score,
        });
      }
    }
  }

  return Response.json({
    ok: true,
    offset,
    limit,
    checked,
    candidateLinks,
    inserted,
    insertedRows,
    sampleLinks,
    errors: errors.slice(0, 30),
  });
});