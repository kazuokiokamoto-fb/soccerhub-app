// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TARGET_TYPES = [
  "club_youth",
  "club_list",
  "team_list",
  "junior_team_list",

  // 追加
  "u12",
  "u15",
  "fa",
  "expanded_page",

  // 既存
  "u12_team_list",
  "u15_team_list",
  "u18_team_list",
  "women_team_list",
  "adult_team_list",
];

const DEFAULT_LIMIT = 1;

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

function normalizeTeamName(v: string) {
  return clean(v)
    .replace(/[【】「」『』［］\[\]]/g, " ")
    .replace(/^[-・●■□◆◇★☆○◎▶▷▼▽※＊*\s]+/g, "")
    .replace(/[-・●■□◆◇★☆○◎▶▷▼▽※＊*\s]+$/g, "")
    .replace(/^[0-9０-９]+[.\s、,)）:：-]+/g, "")
    .replace(/^(チーム|チーム名|クラブ名|団体名|参加チーム|所属チーム)[:：\s]*/g, "")
    .replace(/\s*(公式|ホームページ|HP|サイト|ブログ).*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasBadWord(t: string) {
  const bad = [
    "大会",
    "選手権",
    "リーグ",
    "カップ",
    "トーナメント",
    "結果",
    "速報",
    "日程",
    "組合せ",
    "組み合わせ",
    "順位",
    "要項",
    "申込",
    "申請",
    "登録",
    "会場",
    "アクセス",
    "ニュース",
    "お知らせ",
    "動画",
    "PDF",
    "年度",
    "開催",
    "中止",
    "協会",
    "連盟",
    "委員会",
    "部会",
    "審判",
    "規約",
    "ガイドライン",
    "高円宮",
    "全日本",
    "関東大会",
    "全国大会",
    "問い合わせ",
    "お問い合わせ",
    "スケジュール",
    "試合",
    "対戦",
    "勝点",
    "得点",
    "失点",
    "第",
    "回",
    "東京都クラブユース",
    "SC U-18",
    "FC U-18",
    "SC U-15",
    "FC U-15",
    "ダイレクター",
    "統括",
    "第",
    "回",
    "FCジュニア",
    "FCJY",
    "SC U-18",
    "SC U-15",
    "SC相模原U",
    "JFAアカデミー",    
  ];

  return bad.some((w) => t.includes(w));
}

function looksTeamName(v: string) {
  const t = normalizeTeamName(v);

  if (!t) return false;
  if (t.length < 3) return false;
  if (t.length > 42) return false;
  if (hasBadWord(t)) return false;
  if (/https?:\/\//i.test(t)) return false;
  if (/@/.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (/�|縺|譁|荳|繧|蜷/.test(t)) return false;
  if (/(vs|VS|ｖｓ|対)/.test(t)) return false;
  if (/\d{1,2}\s*[-−－]\s*\d{1,2}/.test(t)) return false;

  return (
    /(^|[^A-Za-z])FC([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])SC([^A-Za-z]|$)/i.test(t) ||
    /JY/i.test(t) ||
    /U-?12/i.test(t) ||
    /U-?15/i.test(t) ||
    /U-?18/i.test(t) ||
    t.includes("ＦＣ") ||
    t.includes("ＳＣ") ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("少年団") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール") ||
    t.includes("レディース") ||
    t.includes("ガールズ")
  );
}

function inferCategory(name: string, fallback = "club_team") {
  if (name.includes("女子") || name.includes("レディース") || name.includes("ガールズ")) return "ladies";
  if (name.includes("スクール") || name.includes("アカデミー")) return "school";
  if (name.includes("U-18") || name.includes("U18") || name.includes("ユース")) return "youth";
  if (name.includes("U-15") || name.includes("U15") || name.includes("ジュニアユース") || /JY/i.test(name)) return "junior_youth";
  if (name.includes("少年団") || name.includes("U-12") || name.includes("U12") || name.includes("ジュニア")) return "junior";
  return fallback;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-name-from-known-sources/1.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let utf8 = "";
    let sjis = "";

    try {
      utf8 = new TextDecoder("utf-8").decode(bytes);
    } catch {}

    try {
      sjis = new TextDecoder("shift-jis").decode(bytes);
    } catch {}

    const head = utf8.slice(0, 3000).toLowerCase();
    const saysSjis =
      head.includes("shift_jis") ||
      head.includes("shift-jis") ||
      head.includes("charset=windows-31j") ||
      head.includes("charset=x-sjis");

    const utf8Bad = (utf8.match(/�|縺|譁|荳|繧|蜷/g) || []).length;
    const sjisBad = (sjis.match(/�|縺|譁|荳|繧|蜷/g) || []).length;

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

function extractLinksAndTexts(html: string) {
  const items: string[] = [];

  const aRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let a;
  while ((a = aRe.exec(html))) items.push(clean(a[1]));

  const cellRe = /<(td|th|li|option|h1|h2|h3|h4|p|span)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let c;
  while ((c = cellRe.exec(html))) items.push(clean(c[2]));

  return items;
}

function extractTeamNames(html: string) {
  const results = new Set<string>();
  const items = extractLinksAndTexts(html);

  const patterns = [
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}(?:FC|ＦＣ|SC|ＳＣ|サッカークラブ|フットボールクラブ|少年団|ジュニアユース|ユース|アカデミー|スクール|レディース|ガールズ))/g,
    /((?:FC|ＦＣ|SC|ＳＣ)[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32})/g,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}JY)/gi,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}U-?1[258])/gi,
  ];

  for (const item of items) {
    const parts = item.split(/[\n\r\t、,|｜／\/;；]+/g);

    for (const p of parts) {
      const n = normalizeTeamName(p);
      if (looksTeamName(n)) results.add(n);
    }

    for (const re of patterns) {
      let m;
      while ((m = re.exec(item))) {
        const n = normalizeTeamName(m[1]);
        if (looksTeamName(n)) results.add(n);
      }
    }
  }

  return [...results].sort((a, b) => a.localeCompare(b, "ja"));
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

  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 10);

  const { data: seeds, error } = await supabase
    .from("team_directory_seeds")
    .select("id,name,url,prefecture,seed_type")
    .eq("enabled", true)
    .is("processed_at", null)
    .in("seed_type", TARGET_TYPES)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let checked = 0;
  let inserted = 0;
  let skipped = 0;
  let candidateNames = 0;

  const sampleCandidates: string[] = [];
  const sampleInserted: any[] = [];
  const errors: any[] = [];

  for (const seed of seeds ?? []) {
    checked++;

    await supabase
      .from("team_directory_seeds")
      .update({
        process_status: "name_extracting",
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
          process_status: "name_extract_error",
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
          process_status: "name_extract_error",
          process_error: `HTTP ${page.status}`,
        })
        .eq("id", seed.id);

      continue;
    }

    const names = extractTeamNames(page.html);
    candidateNames += names.length;

    for (const teamName of names) {
      if (sampleCandidates.length < 80) sampleCandidates.push(teamName);

      const exists = await supabase
        .from("team_directory")
        .select("id")
        .eq("team_name", teamName)
        .eq("prefecture", seed.prefecture)
        .maybeSingle();

      if (exists.data?.id) {
        skipped++;
        continue;
      }

      const { data, error: insertError } = await supabase
        .from("team_directory")
        .insert({
          team_name: teamName,
          prefecture: seed.prefecture,
          category: inferCategory(teamName),
          source_name: seed.name,
          source_url: page.finalUrl || seed.url,
          official_url: null,
          status: "needs_url",
        })
        .select("id,team_name,prefecture,category,source_name")
        .single();

      if (insertError) {
        skipped++;
        continue;
      }

      inserted++;
      if (sampleInserted.length < 50) sampleInserted.push(data);
    }

    await supabase
      .from("team_directory_seeds")
      .update({
        processed_at: new Date().toISOString(),
        process_status: "name_extract_done",
        process_error: null,
      })
      .eq("id", seed.id);
  }

  return Response.json({
    ok: true,
    checked,
    candidateNames,
    inserted,
    skipped,
    sampleCandidates,
    sampleInserted,
    errors: errors.slice(0, 20),
  });
});