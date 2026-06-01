// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOD_WORDS = [
  "チーム一覧",
  "登録チーム",
  "加盟チーム",
  "加盟クラブ",
  "所属チーム",
  "所属クラブ",
  "参加チーム",
  "クラブ一覧",
  "チームリスト",
  "チーム紹介",
  "クラブ紹介",
  "少年団一覧",
  "登録クラブ",
  "会員チーム",
  "member",
  "members",
  "team",
  "teams",
  "club",
  "clubs",
  "u12",
  "u-12",
  "u15",
  "u-15",
  "u18",
  "u-18",
  "少年",
  "ジュニア",
  "ジュニアユース",
  "クラブユース",
  "高体連",
  "中体連",
  "社会人",
  "女子",
  "スクール",
  "アカデミー",
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
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".css",
  ".js",
  ".zip",
  ".mp4",
  ".mov",
  ".pdf",
  ".xlsx",
  ".xls",
  ".doc",
  ".docx",
  "試合結果",
  "日程",
  "スケジュール",
  "組合せ",
  "組み合わせ",
  "星取表",
  "順位",
];

const TRUSTED_EXTERNAL_DOMAINS = [
  "sportsite.jp",
  "matsudo-fa4shu.com",
  "yakirisc.net",
  "ifa4chuo.com",
  "gc-model.com",
  "clubyouth.net",
  "tcyl.jp",
  "chiba-senior-fc.com",
  "pcs.co.jp",
  "ibaraki-fa.jp",
  "chiba-fa.gr.jp",
  "tochigi-fa.gr.jp",
  "tfa.or.jp",
  "yamanashi-football.com",
  "yamanashi-cy.com",
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

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
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

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedExternal(url: string) {
  const host = hostOf(url);
  return TRUSTED_EXTERNAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

function inferSeedType(text: string, url: string) {
  const s = safeDecode(`${text} ${url}`).toLowerCase();

  if (s.includes("u12") || s.includes("u-12") || s.includes("少年") || s.includes("4種")) {
    return "u12_team_list";
  }

  if (
    s.includes("u15") ||
    s.includes("u-15") ||
    s.includes("3種") ||
    s.includes("ジュニアユース") ||
    s.includes("クラブユース")
  ) {
    return "u15_team_list";
  }

  if (s.includes("u18") || s.includes("u-18") || s.includes("2種") || s.includes("高体連")) {
    return "u18_team_list";
  }

  if (s.includes("女子") || s.includes("women") || s.includes("ladies")) {
    return "women_team_list";
  }

  if (s.includes("school") || s.includes("スクール") || s.includes("academy") || s.includes("アカデミー")) {
    return "school_list";
  }

  if (s.includes("社会人") || s.includes("1種")) {
    return "adult_team_list";
  }

  if (s.includes("club") || s.includes("クラブ")) {
    return "club_list";
  }

  return "team_list";
}

function isBadUrl(url: string) {
  const s = safeDecode(String(url).toLowerCase());
  return BAD_WORDS.some((w) => s.includes(w.toLowerCase()));
}

function linkScore(url: string, text = "") {
  const s = safeDecode(`${url} ${text}`).toLowerCase();

  if (!url.startsWith("http")) return -999;
  if (isBadUrl(url)) return -999;

  let score = 0;

  for (const w of GOOD_WORDS) {
    if (s.includes(w.toLowerCase())) score += 10;
  }

  if (s.includes("チーム一覧")) score += 90;
  if (s.includes("加盟チーム")) score += 90;
  if (s.includes("登録チーム")) score += 90;
  if (s.includes("所属チーム")) score += 90;
  if (s.includes("登録クラブ")) score += 90;
  if (s.includes("加盟クラブ")) score += 90;
  if (s.includes("チーム紹介")) score += 80;
  if (s.includes("クラブ紹介")) score += 80;
  if (s.includes("少年団一覧")) score += 70;
  if (s.includes("team")) score += 25;
  if (s.includes("club")) score += 25;
  if (s.includes("member")) score += 25;
  if (s.includes("登録")) score += 20;
  if (s.includes("加盟")) score += 20;
  if (s.includes("所属")) score += 20;
  if (s.includes("一覧")) score += 20;
  if (s.includes("連盟")) score += 10;
  if (s.includes("協会")) score += 10;

  return score;
}

function isGoodTeamListLink(url: string, text = "") {
  return linkScore(url, text) >= 20;
}

function shouldQueueLink(url: string, text = "") {
  const s = safeDecode(`${url} ${text}`).toLowerCase();

  if (!url.startsWith("http")) return false;
  if (isBadUrl(url)) return false;

  return /team|teams|club|clubs|member|u12|u-12|u15|u-15|u18|u-18|entry|registration|チーム|クラブ|登録|加盟|所属|一覧|少年|ジュニア|ユース|種|連盟|協会|地区|ブロック/.test(s);
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string; score: number }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = String(m[1] ?? "").trim();
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
        "user-agent": "Mozilla/5.0 team-seed-expander/3.0",
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
      finalUrl: normalizeUrl(res.url || url),
      html: saysSjis || sjisBad < utf8Bad ? sjis : utf8,
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

  const maxLinks = Math.max(1, Math.min(Number(body.maxLinks ?? 100), 200));
  const maxDepth = Math.max(1, Math.min(Number(body.maxDepth ?? 3), 5));

  const { data: job, error: jobError } = await supabase
    .from("team_seed_jobs")
    .select("*")
    .eq("status", "pending")
    .order("depth", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    return Response.json(
      { ok: false, error: jobError.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if (!job) {
    return Response.json(
      {
        ok: true,
        message: "No pending jobs",
        processed: 0,
        insertedSeeds: 0,
        insertedJobs: 0,
      },
      { headers: CORS_HEADERS },
    );
  }

  await supabase
    .from("team_seed_jobs")
    .update({ status: "processing" })
    .eq("id", job.id);

  let page;

  try {
    page = await fetchHtml(job.url);
  } catch (e) {
    await supabase
      .from("team_seed_jobs")
      .update({
        status: "error",
        processed_at: new Date().toISOString(),
        error: String(e),
      })
      .eq("id", job.id);

    return Response.json(
      {
        ok: false,
        processed: 1,
        job: job.url,
        error: String(e),
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if (!page.ok) {
    await supabase
      .from("team_seed_jobs")
      .update({
        status: "error",
        processed_at: new Date().toISOString(),
        error: `HTTP ${page.status}`,
      })
      .eq("id", job.id);

    return Response.json(
      {
        ok: false,
        processed: 1,
        job: job.url,
        status: page.status,
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const baseHost = hostOf(page.finalUrl || job.url);
  const links = extractLinks(page.html, page.finalUrl || job.url).slice(0, maxLinks);

  let insertedSeeds = 0;
  let insertedJobs = 0;
  let skippedSeeds = 0;
  let skippedJobs = 0;

  const sampleSeeds: any[] = [];
  const sampleJobs: any[] = [];
  const errors: any[] = [];

  for (const link of links) {
    const sameHost = hostOf(link.url) === baseHost;
    const trustedExternal = isTrustedExternal(link.url);

    if (!sameHost && !trustedExternal) continue;

    const good = isGoodTeamListLink(link.url, link.text);
    const queue = shouldQueueLink(link.url, link.text);

    if (good) {
      const row = {
        name: clean(`${job.name} ${link.text || link.url}`).slice(0, 160),
        url: link.url,
        prefecture: job.prefecture,
        seed_type: inferSeedType(link.text, link.url),
        enabled: true,
        process_status: null,
        processed_at: null,
        process_error: null,
      };

      const { data: existing } = await supabase
        .from("team_directory_seeds")
        .select("id")
        .eq("url", row.url)
        .maybeSingle();

      if (existing?.id) {
        skippedSeeds++;
      } else {
        const { data, error } = await supabase
          .from("team_directory_seeds")
          .insert(row)
          .select("id,name,url,prefecture,seed_type")
          .single();

        if (error) {
          if (error.code === "23505") {
            skippedSeeds++;
          } else {
            errors.push({
              phase: "insert_seed",
              url: row.url,
              error: error.message,
              code: error.code,
            });
          }
        } else {
          insertedSeeds++;
          if (sampleSeeds.length < 20) sampleSeeds.push(data);
        }
      }
    }

    if (queue && Number(job.depth ?? 0) < maxDepth) {
      const nextJob = {
        name: clean(`${job.name} ${link.text || link.url}`).slice(0, 160),
        url: link.url,
        prefecture: job.prefecture,
        source_type: good ? "team_list_candidate" : "crawl_candidate",
        depth: Number(job.depth ?? 0) + 1,
        status: "pending",
      };

      const { data: existingJob } = await supabase
        .from("team_seed_jobs")
        .select("id")
        .eq("url", nextJob.url)
        .maybeSingle();

      if (existingJob?.id) {
        skippedJobs++;
      } else {
        const { data, error } = await supabase
          .from("team_seed_jobs")
          .insert(nextJob)
          .select("id,name,url,depth")
          .single();

        if (error) {
          if (error.code === "23505") {
            skippedJobs++;
          } else {
            errors.push({
              phase: "insert_job",
              url: nextJob.url,
              error: error.message,
              code: error.code,
            });
          }
        } else {
          insertedJobs++;
          if (sampleJobs.length < 20) sampleJobs.push(data);
        }
      }
    }
  }

  await supabase
    .from("team_seed_jobs")
    .update({
      status: "done",
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", job.id);

  return Response.json(
    {
      ok: errors.length === 0,
      mode: "team_seed_jobs_expander",
      processed: 1,
      job: {
        id: job.id,
        name: job.name,
        url: job.url,
        depth: job.depth,
      },
      fetched: {
        status: page.status,
        finalUrl: page.finalUrl,
        encoding: page.encoding,
        linkCount: links.length,
      },
      insertedSeeds,
      insertedJobs,
      skippedSeeds,
      skippedJobs,
      sampleSeeds,
      sampleJobs,
      errors: errors.slice(0, 30),
    },
    { headers: CORS_HEADERS },
  );
});