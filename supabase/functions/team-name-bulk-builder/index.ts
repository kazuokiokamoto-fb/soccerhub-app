// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PREFECTURES = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県"];

const CATEGORIES = [
  { category: "junior", words: ["少年団", "ジュニア", "U-12", "小学生"] },
  { category: "junior_youth", words: ["ジュニアユース", "U-15", "クラブユース"] },
  { category: "youth", words: ["ユース", "U-18", "高校生", "クラブユース"] },
  { category: "adult", words: ["社会人", "サッカークラブ", "都県リーグ"] },
  { category: "ladies", words: ["女子", "レディース", "ガールズ"] },
  { category: "school", words: ["サッカースクール", "アカデミー"] },
];

const DEFAULT_LIMIT = 10;

function clean(v: string) {
  return String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamName(v: string) {
  return clean(v)
    .replace(/^[-・●■□◆◇★☆○◎\s]+/g, "")
    .replace(/[-・●■□◆◇★☆○◎\s]+$/g, "")
    .replace(/^[0-9０-９]+[.\s、)）:：-]+/g, "")
    .replace(/^(チーム|クラブ|チーム名|クラブ名)[:：\s]*/g, "")
    .replace(/\s*(公式|ホームページ|HP|サイト|ブログ|Instagram|Facebook|X|Twitter).*$/gi, "")
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
    "順位",
    "要項",
    "申込",
    "申請",
    "登録",
    "会場",
    "アクセス",
    "ニュース",
    "お知らせ",
    "ブログ",
    "掲示板",
    "動画",
    "PDF",
    "第",
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
    "サッカーファミリー",
    "基本的な考え方",
    "高円宮",
    "全日本",
    "関東大会",
    "全国大会",
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

function extractTeamNamesFromText(text: string) {
  const source = clean(text);
  const results = new Set<string>();

  const chunks = source.split(/[\n\r\t、,|｜／\/;；・]+/g);

  const patterns = [
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}(?:FC|ＦＣ|SC|ＳＣ|サッカークラブ|フットボールクラブ|少年団|ジュニアユース|ユース|アカデミー|スクール|レディース|ガールズ))/g,
    /((?:FC|ＦＣ|SC|ＳＣ)[一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32})/g,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}JY)/gi,
    /([一-龥ぁ-んァ-ヶーA-Za-z0-9 .'\-]{2,32}U-?1[258])/gi,
  ];

  for (const c of chunks) {
    const n = normalizeTeamName(c);
    if (looksTeamName(n)) results.add(n);
  }

  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) {
      const n = normalizeTeamName(m[1]);
      if (looksTeamName(n)) results.add(n);
    }
  }

  return [...results];
}

function inferCategory(name: string, fallback: string) {
  if (name.includes("女子") || name.includes("レディース") || name.includes("ガールズ")) return "ladies";
  if (name.includes("スクール") || name.includes("アカデミー")) return "school";
  if (name.includes("U-18") || name.includes("U18") || name.includes("ユース")) return "youth";
  if (name.includes("U-15") || name.includes("U15") || name.includes("ジュニアユース") || /JY/i.test(name)) return "junior_youth";
  if (name.includes("少年団") || name.includes("U-12") || name.includes("U12") || name.includes("ジュニア")) return "junior";
  return fallback || "club_team";
}

async function searchSerper(q: string) {
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) throw new Error("Missing SERPER_API_KEY");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q,
      gl: "jp",
      hl: "ja",
      num: 10,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper error ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

function buildQueries(prefecture: string, category: any) {
  return category.words.map((w) => `${prefecture} ${w} サッカーチーム FC SC`);
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

  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 50);
  const prefectures = body.prefecture ? [body.prefecture] : PREFECTURES;

  let searched = 0;
  let candidateNames = 0;
  let inserted = 0;
  let skipped = 0;

  const sampleInserted: any[] = [];
  const sampleCandidates: string[] = [];
  const errors: any[] = [];

  outer:
  for (const prefecture of prefectures) {
    for (const category of CATEGORIES) {
      const queries = buildQueries(prefecture, category);

      for (const q of queries) {
        if (searched >= limit) break outer;

        searched++;

        try {
          const result = await searchSerper(q);
          const organic = result?.organic ?? [];

          for (const item of organic) {
            const text = `${item.title ?? ""} ${item.snippet ?? ""} ${item.link ?? ""}`;
            const names = extractTeamNamesFromText(text);

            for (const rawName of names) {
              const teamName = normalizeTeamName(rawName);
              if (!looksTeamName(teamName)) continue;

              candidateNames++;
              if (sampleCandidates.length < 80) sampleCandidates.push(teamName);

              const exists = await supabase
                .from("team_directory")
                .select("id")
                .eq("team_name", teamName)
                .eq("prefecture", prefecture)
                .maybeSingle();

              if (exists.data?.id) {
                skipped++;
                continue;
              }

              const { data, error } = await supabase
                .from("team_directory")
                .insert({
                  team_name: teamName,
                  prefecture,
                  category: inferCategory(teamName, category.category),
                  source_name: "team-name-bulk-builder",
                  source_url: item.link ?? null,
                  official_url: null,
                  status: "needs_url",
                })
                .select("id,team_name,prefecture,category,source_url")
                .single();

              if (error) {
                skipped++;
                continue;
              }

              inserted++;
              if (sampleInserted.length < 50) sampleInserted.push(data);
            }
          }
        } catch (e) {
          errors.push({
            query: q,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  return Response.json({
    ok: true,
    searched,
    candidateNames,
    inserted,
    skipped,
    sampleCandidates,
    sampleInserted,
    errors: errors.slice(0, 20),
  });
});