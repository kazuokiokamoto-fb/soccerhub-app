// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_MAX_INSERT = 500;

const TARGET_SEED_TYPES = [
  "u12_team_list",
  "u15_team_list",
  "u18_team_list",
  "club_list",
  "women_team_list",
  "adult_team_list",
  "team_list",
  "junior_team_list",
  "u12",
  "u15",
  "u12_block",
  "block_page",
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
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamName(value: string) {
  return clean(value)
    .replace(/^[-・●■□◆◇★☆○◎\s]+/g, "")
    .replace(/[-・●■□◆◇★☆○◎\s]+$/g, "")
    .replace(/^\d+[.\s、)）]+/g, "")
    .replace(/^(チーム|チーム名|クラブ名|団体名|参加チーム|所属チーム|対戦|HOME|AWAY)[:：\s]*/i, "")
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
}

function markerCount(t: string) {
  const m = t.match(/FC|ＦＣ|SC|ＳＣ|JY|U-?12|U-?15|U-?18|少年団|ジュニアユース|サッカークラブ|フットボールクラブ/gi);
  return m ? m.length : 0;
}

function looksTeamName(value: string) {
  const t = normalizeTeamName(value);

  if (t.length < 3) return false;
  if (t.length > 40) return false;
  if (markerCount(t) >= 4) return false;

  const exactBad = [
    "FC",
    "SC",
    "FCJY",
    "SC U-15",
    "FCジュニア",
    "SCジュニア",
    "クラブ",
    "クラブ（U-15）",
    "クラブ（U-18）",
    "サッカー",
    "フットボール",
  ];
  if (exactBad.includes(t)) return false;

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
    "動画",
    "ハイライト",
    "研修会",
    "プレーオフ",
    "マッチNo",
    "勝者",
    "敗者",
    "キャンパス",
    "スポーツセンター",
    "クラブハウス",
    "住所",
    "監督",
    "コーチ",
    "代表",
    "社長",
    "ダイレクター",
    "担当",
    "問い合わせ",
    "LINE",
    "審判",
    "ビーチサッカー",
    "フェスティバル",
    "ビジョン",
    "部会",
    "参加資格",
    "申請",
    "登録",
  ];

  if (bad.some((w) => t.includes(w))) return false;

  return (
    /(^|[^A-Za-z])FC([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])SC([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])F\.?C\.?([^A-Za-z]|$)/i.test(t) ||
    /(^|[^A-Za-z])S\.?C\.?([^A-Za-z]|$)/i.test(t) ||
    /JY/i.test(t) ||
    /U-?12/i.test(t) ||
    /U-?15/i.test(t) ||
    /U-?18/i.test(t) ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("少年団") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール") ||
    t.includes("ＦＣ") ||
    t.includes("ＳＣ")
  );
}

function inferCategory(name: string) {
  const t = name.toLowerCase();
  if (name.includes("女子") || name.includes("レディース") || name.includes("ガールズ")) return "ladies";
  if (t.includes("school") || name.includes("スクール") || name.includes("アカデミー")) return "school";
  if (name.includes("少年団") || name.includes("U-12") || name.includes("U12") || name.includes("ジュニア")) return "junior";
  return "club_team";
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-directory-crawler/6.0",
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

function extractTitleTeam(html: string) {
  const candidates: string[] = [];

  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) candidates.push(clean(h1[1]));

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    candidates.push(
      clean(title[1])
        .replace(/｜.*$/g, "")
        .replace(/\|.*$/g, "")
        .replace(/\s-\s.*$/g, "")
    );
  }

  for (const c of candidates) {
    const name = normalizeTeamName(c);
    if (looksTeamName(name)) return name;
  }

  return null;
}

function isIndividualTeamPage(url: string) {
  return /\/team\/[^/]+\/?$/i.test(url);
}

function splitCandidateText(text: string) {
  let t = clean(text);

  t = t
    .replace(/\s+(?=(?:FC|ＦＣ|SC|ＳＣ)\b)/g, "\n")
    .replace(/(U-?12|U-?15|U-?18)\s+(?=[A-Za-z一-龥ぁ-んァ-ヶー])/gi, "$1\n")
    .replace(/\s+(?=[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'-]{2,24}(?:FC|ＦＣ|SC|ＳＣ))/g, "\n");

  return t
    .split(/[\n\r\t、,|｜／\/;；]+/g)
    .map(normalizeTeamName)
    .filter(Boolean);
}

function extractTeamsFromHtml(html: string, url: string) {
  const teams = new Set<string>();

  if (isIndividualTeamPage(url)) {
    const one = extractTitleTeam(html);
    if (one) return [one];
  }

  const blocks: string[] = [];

  const cellRe = /<(td|th|li|option|h1|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;

  while ((m = cellRe.exec(html))) {
    const text = clean(m[2]);
    if (text) blocks.push(text);
  }

  const patterns = [
    /(?:^|\s)([A-Za-z0-9 .'\-]{1,28}\s?(?:FC|SC|JY|SS)(?:\s?U-?1[258])?)(?=\s|$)/gi,
    /(?:^|\s)((?:FC|SC|F\.C\.|S\.C\.)\s?[A-Za-z0-9 .'\-ぁ-んァ-ヶー一-龥]{2,28})(?=\s|$)/gi,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,28}(?:FC|ＦＣ|SC|ＳＣ|サッカークラブ|フットボールクラブ|少年団|ジュニアユース|ユース|アカデミー|スクール))/g,
    /((?:FC|ＦＣ|SC|ＳＣ)[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,28})/g,
  ];

  for (const block of blocks) {
    for (const part of splitCandidateText(block)) {
      const name = normalizeTeamName(part);
      if (looksTeamName(name)) teams.add(name);
    }

    for (const re of patterns) {
      let match;
      while ((match = re.exec(block))) {
        const name = normalizeTeamName(match[1]);
        if (looksTeamName(name)) teams.add(name);
      }
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
  const maxInsert = Math.min(Number(body.maxInsert ?? DEFAULT_MAX_INSERT), 2000);

  const { data: seed, error: seedError } = await supabase
    .from("team_directory_seeds")
    .select("id,name,url,prefecture,seed_type")
    .eq("enabled", true)
    .is("processed_at", null)
    .in("seed_type", TARGET_SEED_TYPES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (seedError) {
    return Response.json({ ok: false, error: seedError.message }, { status: 500 });
  }

  if (!seed) {
    return Response.json({
      ok: true,
      message: "No pending team directory seeds",
      processed: 0,
      inserted: 0,
      skipped: 0,
    });
  }

  await supabase
    .from("team_directory_seeds")
    .update({ process_status: "processing" })
    .eq("id", seed.id);

  let page;

  try {
    page = await fetchText(seed.url);
  } catch (e) {
    await supabase
      .from("team_directory_seeds")
      .update({
        processed_at: new Date().toISOString(),
        process_status: "error",
        process_error: String(e),
      })
      .eq("id", seed.id);

    return Response.json({
      ok: false,
      processed: 1,
      seed,
      error: String(e),
    });
  }

  if (!page.ok) {
    await supabase
      .from("team_directory_seeds")
      .update({
        processed_at: new Date().toISOString(),
        process_status: "error",
        process_error: `HTTP ${page.status}`,
      })
      .eq("id", seed.id);

    return Response.json({
      ok: false,
      processed: 1,
      seed,
      status: page.status,
    });
  }

  const teams = extractTeamsFromHtml(page.text, page.finalUrl || seed.url);

  let inserted = 0;
  let skipped = 0;
  const sampleInserted: any[] = [];

  for (const teamName of teams.slice(0, maxInsert)) {
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

  await supabase
    .from("team_directory_seeds")
    .update({
      processed_at: new Date().toISOString(),
      process_status: "done",
      process_error: null,
    })
    .eq("id", seed.id);

  return Response.json({
    ok: true,
    processed: 1,
    seed: {
      id: seed.id,
      name: seed.name,
      url: seed.url,
      seed_type: seed.seed_type,
      prefecture: seed.prefecture,
    },
    candidateTeams: teams.length,
    inserted,
    skipped,
    sampleInserted,
  });
});