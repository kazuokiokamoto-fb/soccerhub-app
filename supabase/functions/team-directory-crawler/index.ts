// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_MAX_PAGES = 500;
const DEFAULT_MAX_INSERT = 5000;

const SEEDS = [
  { name: "関東クラブユースサッカー連盟", url: "https://www.kanto-cy.com/", prefecture: "関東" },

  { name: "東京都サッカー協会", url: "https://www.tokyofa.or.jp/", prefecture: "東京都" },
  { name: "東京都クラブユースサッカー連盟", url: "https://tokyo-cy.jp/", prefecture: "東京都" },
  { name: "東京都少年サッカー連盟", url: "https://www.tjfl.jp/", prefecture: "東京都" },

  { name: "神奈川県サッカー協会", url: "https://kanagawa-fa.gr.jp/", prefecture: "神奈川県" },
  { name: "神奈川県クラブユースサッカー連盟", url: "https://kanagawa-cy.com/", prefecture: "神奈川県" },

  { name: "埼玉県サッカー協会", url: "https://www.saitamafa.or.jp/", prefecture: "埼玉県" },
  { name: "埼玉県クラブユースサッカー連盟", url: "https://saitama-cy.com/", prefecture: "埼玉県" },
  { name: "埼玉県第4種少年サッカー連盟", url: "https://www.saitama-u12.com/", prefecture: "埼玉県" },

  { name: "千葉県サッカー協会", url: "https://chiba-fa.gr.jp/", prefecture: "千葉県" },
  { name: "千葉県クラブユースサッカー連盟", url: "https://chiba-cy.com/", prefecture: "千葉県" },

  { name: "茨城県サッカー協会", url: "https://www.ibaraki-fa.jp/", prefecture: "茨城県" },
  { name: "茨城県クラブユースサッカー連盟", url: "https://ibaraki-cy.com/", prefecture: "茨城県" },

  { name: "栃木県サッカー協会", url: "https://www.tfa.or.jp/", prefecture: "栃木県" },
  { name: "栃木県クラブユースサッカー連盟", url: "https://tochigi-cy.com/", prefecture: "栃木県" },

  { name: "群馬県サッカー協会", url: "https://www.gunma-fa.com/", prefecture: "群馬県" },
  { name: "群馬県クラブユースサッカー連盟", url: "https://gunma-cy.com/", prefecture: "群馬県" },

  { name: "高円宮杯 JFA U-15 関東", url: "https://www.kanto-cy.com/", prefecture: "関東" },
  { name: "Tリーグ 東京", url: "https://tokyo-cy.jp/", prefecture: "東京都" },
  { name: "神奈川U-15リーグ", url: "https://kanagawa-cy.com/", prefecture: "神奈川県" },
  { name: "埼玉U-15リーグ", url: "https://saitama-cy.com/", prefecture: "埼玉県" },
  { name: "千葉U-15リーグ", url: "https://chiba-cy.com/", prefecture: "千葉県" }
];

const GOOD_PATH_WORDS = [
  "team", "club", "member", "link", "league", "u15", "u-15", "u12", "u-12",
  "junior", "youth", "competition", "result", "schedule", "match",
  "加盟", "チーム", "クラブ", "一覧", "リンク", "参加", "大会", "リーグ",
  "高円宮", "t1", "t2", "t3", "第4種", "少年", "ジュニア", "中学"
];

const BAD_HOST_WORDS = [
  "instagram.com", "facebook.com", "twitter.com", "x.com", "youtube.com",
  "youtu.be", "line.me", "lin.ee", "tiktok.com", "google.com", "yahoo.co.jp",
  "wikipedia.org", "amazon.", "rakuten."
];

function clean(text: string) {
  return String(text ?? "")
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
    .replace(/\s+/g, " ")
    .trim();
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

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBadUrl(url: string) {
  const lower = decodeURIComponent(String(url).toLowerCase());
  const host = hostOf(url);

  return (
    !lower.startsWith("http") ||
    BAD_HOST_WORDS.some((w) => host.includes(w) || lower.includes(w)) ||
    lower.includes("google.com/maps") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("maps.app.goo.gl") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp") ||
    lower.includes(".gif") ||
    lower.includes(".css") ||
    lower.includes(".js") ||
    lower.includes(".svg") ||
    lower.includes(".ico") ||
    lower.includes(".zip") ||
    lower.includes(".mp4") ||
    lower.includes(".mov")
  );
}

function isUsefulPage(url: string, text = "") {
  const lower = decodeURIComponent(`${url} ${text}`.toLowerCase());
  return GOOD_PATH_WORDS.some((w) => lower.includes(w));
}

function normalizeTeamName(name: string) {
  return clean(name)
    .replace(/^[-・●■□◆◇★☆○◎\s]+/g, "")
    .replace(/[-・●■□◆◇★☆○◎\s]+$/g, "")
    .replace(/^\d+[.\s、)）]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/試合結果.*$/g, "")
    .replace(/日程.*$/g, "")
    .replace(/公式.*$/g, "")
    .trim();
}

function looksTeamName(text: string) {
  const t = normalizeTeamName(text);
  if (t.length < 3) return false;
  if (t.length > 50) return false;

  if (
    t.includes("サッカー協会") ||
    t.includes("連盟") ||
    t.includes("大会") ||
    t.includes("リーグ") ||
    t.includes("要項") ||
    t.includes("結果") ||
    t.includes("日程") ||
    t.includes("順位") ||
    t.includes("お問い合わせ") ||
    t.includes("プライバシー")
  ) return false;

  return (
    /(^|[^A-Z])FC([^A-Z]|$)/i.test(t) ||
    /(^|[^A-Z])SC([^A-Z]|$)/i.test(t) ||
    /JY/i.test(t) ||
    /U-?15/i.test(t) ||
    /U-?12/i.test(t) ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール") ||
    t.includes("少年団")
  );
}

function inferCategory(name: string) {
  const t = name.toLowerCase();
  if (t.includes("school") || name.includes("スクール") || name.includes("アカデミー")) return "school";
  if (name.includes("女子") || name.includes("レディース") || name.includes("ガールズ")) return "ladies";
  if (name.includes("少年団") || name.includes("U-12") || name.includes("U12")) return "junior";
  return "club_team";
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = re.exec(html))) {
    const href = match[1];
    const text = clean(String(match[2] || ""));
    if (!href) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    try {
      const url = normalizeUrl(new URL(href, baseUrl).toString());
      if (!url || isBadUrl(url)) continue;
      links.push({ url, text });
    } catch {}
  }

  return links;
}

function extractTeamNames(html: string) {
  const teams = new Set<string>();
  const text = clean(html);

  const chunks = text
    .split(/[\n\r\t|｜、,;；／/]+/)
    .map(normalizeTeamName)
    .filter(Boolean);

  for (const chunk of chunks) {
    if (looksTeamName(chunk)) teams.add(chunk);
  }

  const patterns = [
    /([A-Za-z0-9 .'\-]{1,35}\s?(?:FC|SC|JY)(?:[A-Za-z0-9 .'\-]{0,20})?)/gi,
    /((?:FC|SC)\s?[A-Za-z0-9 .'\-]{2,35})/gi,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,35}(?:FC|ＦＣ|SC|ＳＣ|サッカークラブ|ジュニアユース|ユース|少年団|アカデミー|スクール))/g,
    /((?:FC|ＦＣ|SC|ＳＣ)[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,35})/g,
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(text))) {
      const name = normalizeTeamName(match[1]);
      if (looksTeamName(name)) teams.add(name);
    }
  }

  return [...teams];
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-directory-crawler/2.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      url: normalizeUrl(res.url || url),
      contentType: res.headers.get("content-type") || "",
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  const body = await readJsonBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRole =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRole) {
    return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const maxPages = Math.min(Number(body?.maxPages ?? DEFAULT_MAX_PAGES), 2000);
  const maxInsert = Math.min(Number(body?.maxInsert ?? DEFAULT_MAX_INSERT), 10000);

  const queue = SEEDS.map((s) => ({ ...s, url: normalizeUrl(s.url) }));
  const visited = new Set<string>();
  const found = new Map<string, any>();

  const errors: any[] = [];
  const checkedPages: any[] = [];

  while (queue.length > 0 && visited.size < maxPages && found.size < maxInsert) {
    const item = queue.shift();
    if (!item?.url) continue;

    const url = normalizeUrl(item.url);
    if (!url || visited.has(url) || isBadUrl(url)) continue;

    visited.add(url);

    let page;
    try {
      page = await fetchHtml(url);
    } catch (e) {
      errors.push({ url, error: e instanceof Error ? e.message : String(e) });
      continue;
    }

    checkedPages.push({ url, status: page.status, seed: item.name });

    if (!page.ok) continue;

    const teams = extractTeamNames(page.html);

    for (const team of teams) {
      const key = normalizeTeamName(team).toLowerCase();
      if (!key || found.has(key)) continue;

      found.set(key, {
        team_name: normalizeTeamName(team),
        prefecture: item.prefecture,
        category: inferCategory(team),
        source_name: item.name,
        source_url: page.url || url,
        status: "needs_url",
      });
    }

    const links = extractLinks(page.html, page.url || url);

    for (const link of links) {
      const same = hostOf(link.url) === hostOf(page.url || url);
      if (!same) continue;
      if (!isUsefulPage(link.url, link.text)) continue;
      if (!visited.has(link.url) && queue.length < maxPages * 3) {
        queue.push({
          name: item.name,
          url: link.url,
          prefecture: item.prefecture,
        });
      }
    }
  }

  let inserted = 0;
  let skipped = 0;
  const sampleInserted: any[] = [];

  for (const row of Array.from(found.values()).slice(0, maxInsert)) {
    const { data, error } = await supabase
      .from("team_directory")
      .insert(row)
      .select("id,team_name,prefecture,category,source_name")
      .single();

    if (error) {
      skipped += 1;
      continue;
    }

    inserted += 1;
    if (sampleInserted.length < 50) sampleInserted.push(data);
  }

  return Response.json({
    ok: true,
    scannedPages: visited.size,
    candidateTeams: found.size,
    inserted,
    skipped,
    errors: errors.slice(0, 50),
    checkedPages: checkedPages.slice(0, 80),
    sampleInserted,
  });
});