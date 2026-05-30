// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  "team",
  "teams",
  "club",
  "clubs",
  "member",
  "members",
  "registration",
  "entry",
  "u12",
  "u15",
  "u18",
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
];

function clean(v: string) {
  return String(v ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
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

function inferSeedType(text: string, url: string) {
  const s = `${text} ${url}`.toLowerCase();

  if (s.includes("u12") || s.includes("u-12") || s.includes("少年") || s.includes("4種")) return "u12_team_list";
  if (s.includes("u15") || s.includes("u-15") || s.includes("3種") || s.includes("ジュニアユース")) return "u15_team_list";
  if (s.includes("u18") || s.includes("u-18") || s.includes("2種") || s.includes("高体連")) return "u18_team_list";
  if (s.includes("女子") || s.includes("women") || s.includes("ladies")) return "women_team_list";
  if (s.includes("school") || s.includes("スクール") || s.includes("academy") || s.includes("アカデミー")) return "school_list";
  if (s.includes("社会人") || s.includes("1種")) return "adult_team_list";
  if (s.includes("club") || s.includes("クラブ") || s.includes("クラブユース")) return "club_list";

  return "team_list";
}

function isBadUrl(url: string) {
  const s = decodeURIComponent(String(url).toLowerCase());
  return BAD_WORDS.some((w) => s.includes(w));
}

function isGoodTeamListLink(url: string, text = "") {
  const s = decodeURIComponent(`${url} ${text}`.toLowerCase());
  if (!url.startsWith("http")) return false;
  if (isBadUrl(url)) return false;
  return GOOD_WORDS.some((w) => s.includes(w.toLowerCase()));
}

function shouldQueueLink(url: string, text = "") {
  const s = decodeURIComponent(`${url} ${text}`.toLowerCase());
  if (!url.startsWith("http")) return false;
  if (isBadUrl(url)) return false;

  return /team|teams|club|clubs|member|u12|u15|u18|entry|registration|チーム|クラブ|登録|加盟|所属|一覧|少年|ジュニア|ユース|種|連盟/.test(s);
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string }[] = [];
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
      if (url) links.push({ url, text });
    } catch {}
  }

  return links;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-list-seed-builder/2.0",
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

  const maxLinks = Math.min(Number(body.maxLinks ?? 80), 150);

  const { data: job, error: jobError } = await supabase
    .from("team_seed_jobs")
    .select("*")
    .eq("status", "pending")
    .order("depth", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    return Response.json({ ok: false, error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return Response.json({
      ok: true,
      message: "No pending jobs",
      processed: 0,
      insertedSeeds: 0,
      insertedJobs: 0,
    });
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

    return Response.json({
      ok: false,
      processed: 1,
      job: job.url,
      error: String(e),
    });
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

    return Response.json({
      ok: false,
      processed: 1,
      job: job.url,
      status: page.status,
    });
  }

  const links = extractLinks(page.html, page.finalUrl || job.url).slice(0, maxLinks);

  let insertedSeeds = 0;
  let insertedJobs = 0;
  const sampleSeeds: any[] = [];
  const sampleJobs: any[] = [];

  for (const link of links) {
    if (hostOf(link.url) !== hostOf(page.finalUrl || job.url)) continue;

    const good = isGoodTeamListLink(link.url, link.text);
    const queue = shouldQueueLink(link.url, link.text);

    if (good) {
      const row = {
        name: clean(`${job.name} ${link.text || link.url}`).slice(0, 160),
        url: link.url,
        prefecture: job.prefecture,
        seed_type: inferSeedType(link.text, link.url),
        enabled: true,
      };

      const { data, error } = await supabase
        .from("team_directory_seeds")
        .insert(row)
        .select("id,name,url,prefecture,seed_type")
        .single();

      if (!error) {
        insertedSeeds++;
        if (sampleSeeds.length < 20) sampleSeeds.push(data);
      }
    }

    if (queue && Number(job.depth ?? 0) < 3) {
      const nextJob = {
        name: clean(`${job.name} ${link.text || link.url}`).slice(0, 160),
        url: link.url,
        prefecture: job.prefecture,
        source_type: good ? "team_list_candidate" : "crawl_candidate",
        depth: Number(job.depth ?? 0) + 1,
        status: "pending",
      };

      const { data, error } = await supabase
        .from("team_seed_jobs")
        .insert(nextJob)
        .select("id,name,url,depth")
        .single();

      if (!error) {
        insertedJobs++;
        if (sampleJobs.length < 20) sampleJobs.push(data);
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

  return Response.json({
    ok: true,
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
      linkCount: links.length,
    },
    insertedSeeds,
    insertedJobs,
    sampleSeeds,
    sampleJobs,
  });
});