// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 1;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEAM_LIST_HINTS = [
  "チーム一覧",
  "加盟チーム",
  "登録チーム",
  "参加チーム",
  "所属チーム",
  "クラブ一覧",
  "会員チーム",
  "少年団一覧",
  "チームリスト",
  "登録クラブ",
  "加盟クラブ",
  "所属クラブ",
  "チーム紹介",
  "クラブ紹介",
];

const DISTRICT_HINTS = [
  "市サッカー協会",
  "地区サッカー協会",
  "4種委員会",
  "少年サッカー連盟",
  "少年サッカー",
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

const TARGET_SOURCE_TYPES = [
  "fa",
  "club_youth",

  "u12",
  "u12_team_list",
  "u12_block",

  "u15",
  "u15_team_list",

  "u18",
  "u18_team_list",

  "women_team_list",
  "adult_team_list",
  "team_list",
  "club_list",
  "junior_team_list",
  "block_page",
  "area_page",
  "link_page",
  "seed_page",
  "expanded_page",
  "team_list_candidate",
];

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
  "league",
  "entry",
  "registration",

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
  "加盟クラブ",
  "登録クラブ",
  "所属クラブ",
  "リンク",
  "関連リンク",
  "ブロック",
  "地区",
  "支部",
  "市区町村",
  "リーグ",
  "大会",
  "参加",
  "出場",

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
  "facebook",
  "instagram",
  "twitter",
  "x.com",
  "youtube",
  "line.me",
  "mailto:",
  "tel:",

  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "css",
  "js",
  "zip",
  "mp4",
  "mov",

  "calendar",
  "ranking",
  "rank",
  "score",
  "news",
  "download",

  "順位",
  "星取表",
  "組合せ",
  "組み合わせ",
  "ニュース",
  "お知らせ",
  "ダウンロード",
  "会場",
  "アクセス",
  "予選",
  "決勝",
  "ラウンド",
];

const FILE_WORDS = [
  "pdf",
  "xlsx",
  "xls",
  "doc",
  "docx",
  "ppt",
  "pptx",
];

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
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanHref(v: string) {
  return String(v ?? "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
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

    if ((u.pathname === "" || u.pathname === "/") && !u.search) {
      u.pathname = "/";
    }

    return u.toString();
  } catch {
    return "";
  }
}

function isFileUrl(url: string) {
  const s = url.toLowerCase();
  return /\.(pdf|xlsx|xls|doc|docx|ppt|pptx|jpg|jpeg|png|gif|webp|zip|css|js|svg|ico|mp4|mov)(\?|$)/i.test(s);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasAny(value: string, words: string[]) {
  return words.some((w) => value.includes(w.toLowerCase()));
}

function hasStrongTeamWord(s: string) {
  return (
    s.includes("チーム一覧") ||
    s.includes("加盟チーム") ||
    s.includes("登録チーム") ||
    s.includes("参加チーム") ||
    s.includes("所属チーム") ||
    s.includes("クラブ一覧") ||
    s.includes("加盟クラブ") ||
    s.includes("登録クラブ") ||
    s.includes("チーム紹介") ||
    s.includes("クラブ紹介") ||
    s.includes("少年団一覧") ||
    s.includes("登録クラブ") ||
    s.includes("チームリスト") ||
    s.includes("team") ||
    s.includes("teams") ||
    s.includes("club") ||
    s.includes("clubs") ||
    s.includes("member") ||
    s.includes("members")
  );
}

function linkScore(url: string, text = "") {
  const s = safeDecode(`${url} ${text}`).toLowerCase();

  if (!url.startsWith("http")) return -999;
  if (isFileUrl(url)) return -999;

  if (hasAny(s, FILE_WORDS)) return -999;

  // 大会・リーグページでも「参加チーム一覧」「登録チーム」等なら残す
  if (!hasStrongTeamWord(s) && hasAny(s, BAD_WORDS)) return -100;

  let score = 0;

  for (const w of GOOD_WORDS) {
    if (s.includes(w.toLowerCase())) score += 10;
  }

  for (const w of TEAM_LIST_HINTS) {
    if (s.includes(w.toLowerCase())) score += 60;
  }

  for (const w of DISTRICT_HINTS) {
    if (s.includes(w.toLowerCase())) score += 35;
  }

  if (s.includes("チーム一覧")) score += 90;
  if (s.includes("加盟チーム")) score += 90;
  if (s.includes("登録チーム")) score += 90;
  if (s.includes("参加チーム")) score += 80;
  if (s.includes("所属チーム")) score += 80;
  if (s.includes("クラブ一覧")) score += 80;
  if (s.includes("加盟クラブ")) score += 80;
  if (s.includes("登録クラブ")) score += 80;
  if (s.includes("少年団一覧")) score += 70;
  if (s.includes("チーム紹介")) score += 60;
  if (s.includes("クラブ紹介")) score += 60;

  if (s.includes("team") || s.includes("club")) score += 25;
  if (s.includes("member")) score += 25;
  if (s.includes("リンク") || s.includes("link")) score += 20;
  if (s.includes("ブロック") || s.includes("地区")) score += 20;
  if (s.includes("リーグ") && hasStrongTeamWord(s)) score += 15;
  if (s.includes("大会") && hasStrongTeamWord(s)) score += 10;

  return score;
}

function inferSeedType(url: string, text = "") {
  const s = safeDecode(`${url} ${text}`).toLowerCase();

  if (
    s.includes("u12") ||
    s.includes("u-12") ||
    s.includes("4種") ||
    s.includes("少年") ||
    s.includes("ジュニア")
  ) {
    return "u12_team_list";
  }

  if (
    s.includes("u15") ||
    s.includes("u-15") ||
    s.includes("3種") ||
    s.includes("中体連") ||
    s.includes("ジュニアユース") ||
    s.includes("クラブユース")
  ) {
    return "u15_team_list";
  }

  if (
    s.includes("u18") ||
    s.includes("u-18") ||
    s.includes("2種") ||
    s.includes("高体連") ||
    s.includes("高校")
  ) {
    return "u18_team_list";
  }

  if (s.includes("女子") || s.includes("women") || s.includes("ladies")) {
    return "women_team_list";
  }

  if (s.includes("社会人") || s.includes("1種")) {
    return "adult_team_list";
  }

  if (
    s.includes("チーム一覧") ||
    s.includes("加盟チーム") ||
    s.includes("登録チーム") ||
    s.includes("参加チーム") ||
    s.includes("所属チーム")
  ) {
    return "team_list";
  }

  if (
    s.includes("クラブ一覧") ||
    s.includes("加盟クラブ") ||
    s.includes("登録クラブ") ||
    s.includes("所属クラブ")
  ) {
    return "club_list";
  }

  if (s.includes("少年団")) return "junior_team_list";
  if (s.includes("ブロック") || s.includes("block")) return "block_page";
  if (s.includes("地区") || s.includes("area") || s.includes("district")) return "area_page";
  if (s.includes("link") || s.includes("リンク")) return "link_page";

  return "team_list_candidate";
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string; score: number }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = cleanHref(m[1]);
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

  const seen = new Set<string>();

  return links
    .sort((a, b) => b.score - a.score)
    .filter((x) => {
      const key = x.url.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-list-seed-builder/5.0",
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

    const html = saysSjis || sjisBad < utf8Bad ? sjis : utf8;

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: normalizeUrl(res.url || url),
      html,
      encoding: saysSjis || sjisBad < utf8Bad ? "shift-jis" : "utf-8",
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

  const limit = Math.max(1, Math.min(Number(body.limit ?? DEFAULT_LIMIT), 10));
  const maxNewPerSeed = Math.max(1, Math.min(Number(body.maxNewPerSeed ?? 30), 100));

  const { data: seeds, error } = await supabase
    .from("team_directory_seeds")
    .select("*")
    .eq("enabled", true)
    .is("processed_at", null)
    .in("seed_type", TARGET_SOURCE_TYPES)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  let inserted = 0;
  let skipped = 0;
  let checked = 0;
  let candidateLinks = 0;

  const insertedRows: any[] = [];
  const sampleLinks: any[] = [];
  const errors: any[] = [];

  for (const seed of seeds ?? []) {
    checked++;

    await supabase
      .from("team_directory_seeds")
      .update({
        process_status: "seed_building",
        process_error: null,
      })
      .eq("id", seed.id);

    let page;

    try {
      page = await fetchHtml(seed.url);
    } catch (e) {
      errors.push({ seed: seed.name, url: seed.url, error: String(e) });

      await supabase
        .from("team_directory_seeds")
        .update({
          processed_at: new Date().toISOString(),
          process_status: "seed_build_error",
          process_error: String(e),
        })
        .eq("id", seed.id);

      continue;
    }

    if (!page.ok) {
      await supabase
        .from("team_directory_seeds")
        .update({
          processed_at: new Date().toISOString(),
          process_status: "seed_build_error",
          process_error: `HTTP ${page.status}`,
        })
        .eq("id", seed.id);

      continue;
    }

    const links = extractLinks(page.html, page.finalUrl || seed.url);
    candidateLinks += links.length;

    let perSeed = 0;

    for (const link of links) {
      if (perSeed >= maxNewPerSeed) break;
      if (hostOf(link.url) !== hostOf(page.finalUrl || seed.url)) continue;

      const seedType = inferSeedType(link.url, link.text);
      const name = clean(`${seed.name} ${link.text || link.url}`).slice(0, 120);

      const { data: existing, error: existsError } = await supabase
        .from("team_directory_seeds")
        .select("id")
        .eq("url", link.url)
        .maybeSingle();

      if (existsError) {
        errors.push({
          from: seed.name,
          url: link.url,
          phase: "select_existing",
          error: existsError.message,
        });
        continue;
      }

      if (existing?.id) {
        skipped++;
        continue;
      }

      const { data, error: insertError } = await supabase
        .from("team_directory_seeds")
        .insert({
          name,
          url: link.url,
          prefecture: seed.prefecture,
          seed_type: seedType,
          enabled: true,
          process_status: null,
          processed_at: null,
          process_error: null,
        })
        .select("id,name,url,prefecture,seed_type")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          skipped++;
          continue;
        }

        errors.push({
          from: seed.name,
          url: link.url,
          phase: "insert",
          error: insertError.message,
          code: insertError.code,
        });
        continue;
      }

      inserted++;
      perSeed++;

      if (insertedRows.length < 50) insertedRows.push(data);
      if (sampleLinks.length < 50) {
        sampleLinks.push({
          from: seed.name,
          text: link.text,
          url: link.url,
          score: link.score,
          seed_type: seedType,
        });
      }
    }

    await supabase
      .from("team_directory_seeds")
      .update({
        processed_at: new Date().toISOString(),
        process_status: "seed_build_done",
        process_error: null,
      })
      .eq("id", seed.id);
  }

  return Response.json(
    {
      ok: true,
      mode: "team_list_seed_builder",
      limit,
      checked,
      candidateLinks,
      inserted,
      skipped,
      insertedRows,
      sampleLinks,
      errors: errors.slice(0, 30),
    },
    { headers: CORS_HEADERS },
  );
});