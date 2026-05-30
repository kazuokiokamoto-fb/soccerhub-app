// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_SEEDS = [
  ["関東クラブユースサッカー連盟", "https://www.kanto-cy.com/", "関東"],
  ["東京都サッカー協会", "https://www.tokyofa.or.jp/", "東京都"],
  ["東京都クラブユースサッカー連盟", "https://tokyo-cy.jp/", "東京都"],
  ["東京都少年サッカー連盟", "https://www.tjfl.jp/", "東京都"],
  ["神奈川県サッカー協会", "https://kanagawa-fa.gr.jp/", "神奈川県"],
  ["神奈川県クラブユース", "https://kanagawa-fa.gr.jp/club_u15/", "神奈川県"],
  ["埼玉県サッカー協会", "https://www.saitamafa.or.jp/", "埼玉県"],
  ["埼玉県第4種少年サッカー連盟", "https://www.saitama-u12.com/", "埼玉県"],
  ["千葉県サッカー協会", "https://chiba-fa.gr.jp/", "千葉県"],
  ["千葉県クラブユースサッカー連盟", "https://chiba-cy.com/", "千葉県"],
  ["茨城県サッカー協会", "https://www.ibaraki-fa.jp/", "茨城県"],
  ["茨城県クラブユースサッカー連盟", "https://ibaraki-cy.com/", "茨城県"],
  ["栃木県サッカー協会", "https://www.tfa.or.jp/", "栃木県"],
  ["栃木県クラブユースサッカー連盟", "https://tochigi-cy.com/", "栃木県"],
  ["群馬県サッカー協会", "https://www.gunma-fa.com/", "群馬県"],
  ["群馬県クラブユースサッカー連盟", "https://gunma-cy.com/", "群馬県"],
];

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
  "news",
  "post",
  "schedule",
  "result",
  "match",
  "event",
  "blog",
  "column",
  "contact",
  "privacy",
  "access",
  "pdf",
  "xlsx",
  "xls",
  "jpg",
  "png",
  "動画",
  "結果",
  "日程",
  "大会",
  "試合",
  "要項",
  "申込書",
  "お問い合わせ",
  "ニュース",
  "お知らせ",
  "ブログ",
  "コラム",
  "会場",
];

function clean(v: string) {
  return String(v ?? "")
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

function isGoodTeamListLink(url: string, text = "") {
  const s = decodeURIComponent(`${url} ${text}`.toLowerCase());

  if (!url.startsWith("http")) return false;
  if (BAD_WORDS.some((w) => s.includes(w.toLowerCase()))) return false;

  return GOOD_WORDS.some((w) => s.includes(w.toLowerCase()));
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
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 team-list-seed-builder/1.0",
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

  const maxPagesPerBase = Math.min(Number(body.maxPagesPerBase ?? 30), 80);
  const maxInsert = Math.min(Number(body.maxInsert ?? 500), 3000);

  const candidates = new Map<string, any>();
  const checkedPages: any[] = [];
  const errors: any[] = [];

  for (const [baseName, baseUrl, prefecture] of BASE_SEEDS) {
    const queue = [normalizeUrl(baseUrl)];
    const visited = new Set<string>();

    while (queue.length && visited.size < maxPagesPerBase) {
      const pageUrl = queue.shift();
      if (!pageUrl || visited.has(pageUrl)) continue;

      visited.add(pageUrl);

      let page;
      try {
        page = await fetchHtml(pageUrl);
      } catch (e) {
        errors.push({ baseName, url: pageUrl, error: String(e) });
        continue;
      }

      checkedPages.push({ baseName, url: pageUrl, status: page.status });

      if (!page.ok) continue;

      const links = extractLinks(page.html, page.finalUrl || pageUrl);

      for (const link of links) {
        const sameHost = hostOf(link.url) === hostOf(page.finalUrl || pageUrl);
        if (!sameHost) continue;

        const good = isGoodTeamListLink(link.url, link.text);

        if (good) {
          const key = link.url;
          if (!candidates.has(key)) {
            candidates.set(key, {
              name: clean(`${baseName} ${link.text || link.url}`).slice(0, 160),
              url: link.url,
              prefecture,
              seed_type: inferSeedType(link.text, link.url),
              enabled: true,
            });
          }
        }

        const shouldFollow =
          good ||
          /team|club|member|u12|u15|u18|少年|ジュニア|クラブ|登録|加盟|チーム|種|連盟/i.test(
            decodeURIComponent(`${link.url} ${link.text}`),
          );

        if (shouldFollow && !visited.has(link.url) && queue.length < maxPagesPerBase * 3) {
          queue.push(link.url);
        }
      }
    }
  }

  const rows = Array.from(candidates.values()).slice(0, maxInsert);

  let inserted = 0;
  let skipped = 0;
  const insertedRows: any[] = [];

  for (const row of rows) {
    const { data, error } = await supabase
      .from("team_directory_seeds")
      .insert(row)
      .select("id,name,url,prefecture,seed_type,enabled")
      .single();

    if (error) {
      skipped++;
      continue;
    }

    inserted++;
    if (insertedRows.length < 80) insertedRows.push(data);
  }

  return Response.json({
    ok: true,
    checkedPageCount: checkedPages.length,
    candidateCount: rows.length,
    inserted,
    skipped,
    checkedPages: checkedPages.slice(0, 80),
    insertedRows,
    errors: errors.slice(0, 50),
  });
});