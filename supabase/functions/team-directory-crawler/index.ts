// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_INSERT = 10000;

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
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamName(value: string) {
  let t = clean(value)
    .replace(/^[-・●■□◆◇★☆○◎\s]+/g, "")
    .replace(/[-・●■□◆◇★☆○◎\s]+$/g, "")
    .replace(/^\d+[.\s、)）]+/g, "")
    .replace(/^(チーム名|クラブ名|団体名|参加チーム|対戦|HOME|AWAY)[:：]*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  t = t
    .replace(/試合結果.*$/g, "")
    .replace(/試合日程.*$/g, "")
    .replace(/日程.*$/g, "")
    .replace(/結果.*$/g, "")
    .replace(/順位.*$/g, "")
    .replace(/勝点.*$/g, "")
    .replace(/得点.*$/g, "")
    .replace(/失点.*$/g, "")
    .replace(/会場.*$/g, "")
    .replace(/Kick.*$/gi, "")
    .trim();

  return t;
}

function looksTeamName(value: string) {
  const t = normalizeTeamName(value);
  if (t.length < 2) return false;
  if (t.length > 45) return false;

  const bad = [
    "サッカー協会",
    "連盟",
    "委員会",
    "大会",
    "リーグ",
    "ブロック",
    "ラウンド",
    "トーナメント",
    "予選",
    "決勝",
    "順位",
    "日程",
    "結果",
    "要項",
    "申込書",
    "参加申込",
    "お問い合わせ",
    "プライバシー",
    "ニュース",
    "お知らせ",
    "会場",
    "グラウンド",
    "一覧",
    "詳細",
    "PDF",
    "Excel",
    "xlsx",
    "xls",
  ];

  if (bad.some((w) => t.includes(w))) return false;

  return (
    /(^|[^A-Za-z])FC([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])SC([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])F\.?C\.?([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])S\.?C\.?([^A-Za-z]|$)/i.test(t) ||
    /JY/i.test(t) ||
    /Jr/i.test(t) ||
    /U-?12/i.test(t) ||
    /U-?15/i.test(t) ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("少年団") ||
    t.includes("ジュニア") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール") ||
    t.includes("スポーツ少年団") ||
    t.includes("SS") ||
    t.includes("ＦＣ") ||
    t.includes("ＳＣ")
  );
}

function inferCategory(name: string) {
  const t = name.toLowerCase();

  if (name.includes("女子") || name.includes("レディース") || name.includes("ガールズ")) {
    return "ladies";
  }

  if (
    t.includes("school") ||
    name.includes("スクール") ||
    name.includes("アカデミー")
  ) {
    return "school";
  }

  if (
    name.includes("少年団") ||
    name.includes("U-12") ||
    name.includes("U12") ||
    name.includes("ジュニア")
  ) {
    return "junior";
  }

  return "club_team";
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-directory-crawler/3.0",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      text: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTeamsFromHtml(html: string) {
  const teams = new Set<string>();

  const cellTexts: string[] = [];

  const cellRe = /<(td|th|li|p|span|div|a)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;

  while ((m = cellRe.exec(html))) {
    const text = clean(m[2]);
    if (text) cellTexts.push(text);
  }

  const plain = clean(html);

  const chunks = [
    ...cellTexts,
    ...plain.split(/[、,|｜／\/\n\r\t;；]+/g),
  ]
    .map(normalizeTeamName)
    .filter(Boolean);

  for (const chunk of chunks) {
    if (looksTeamName(chunk)) teams.add(normalizeTeamName(chunk));
  }

  const patterns = [
    /([A-Za-z0-9 .'\-]{1,35}\s?(?:FC|SC|JY|SS)(?:[A-Za-z0-9 .'\-]{0,20})?)/gi,
    /((?:FC|SC|F\.C\.|S\.C\.)\s?[A-Za-z0-9 .'\-ぁ-んァ-ヶー一-龥]{2,35})/gi,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,35}(?:FC|ＦＣ|SC|ＳＣ|サッカークラブ|フットボールクラブ|少年団|ジュニアユース|ユース|アカデミー|スクール))/g,
    /((?:FC|ＦＣ|SC|ＳＣ)[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,35})/g,
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(plain))) {
      const name = normalizeTeamName(match[1]);
      if (looksTeamName(name)) teams.add(name);
    }
  }

  return [...teams];
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

  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 2000);
  const offset = Number(body.offset ?? 0);
  const maxInsert = Math.min(Number(body.maxInsert ?? DEFAULT_MAX_INSERT), 20000);

  const { data: seeds, error: seedError } = await supabase
    .from("team_directory_seeds")
    .select("id,name,url,prefecture,seed_type")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (seedError) {
    return Response.json({ ok: false, error: seedError.message }, { status: 500 });
  }

  let scanned = 0;
  let candidateTeams = 0;
  let inserted = 0;
  let skipped = 0;

  const sampleInserted: any[] = [];
  const sampleTeams: any[] = [];
  const errors: any[] = [];

  for (const seed of seeds ?? []) {
    if (inserted >= maxInsert) break;

    let page;

    try {
      page = await fetchText(seed.url);
    } catch (e) {
      errors.push({ seed: seed.name, url: seed.url, error: String(e) });
      continue;
    }

    scanned += 1;

    if (!page.ok) continue;

    const teams = extractTeamsFromHtml(page.text);
    candidateTeams += teams.length;

    for (const teamName of teams) {
      if (inserted >= maxInsert) break;

      const row = {
        team_name: teamName,
        prefecture: seed.prefecture,
        category: inferCategory(teamName),
        source_name: seed.name,
        source_url: page.finalUrl || seed.url,
        official_url: null,
        status: "needs_url",
      };

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

    if (sampleTeams.length < 50 && teams.length > 0) {
      sampleTeams.push({
        seed: seed.name,
        url: seed.url,
        teams: teams.slice(0, 20),
      });
    }
  }

  return Response.json({
    ok: true,
    offset,
    limit,
    seedCount: seeds?.length ?? 0,
    scanned,
    candidateTeams,
    inserted,
    skipped,
    sampleTeams,
    sampleInserted,
    errors: errors.slice(0, 50),
  });
});