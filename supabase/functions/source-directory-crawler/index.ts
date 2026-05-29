// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_SEEDS = 50;
const MAX_PAGES_PER_SEED = 15;
const MAX_INSERT = 800;

const DEFAULT_DIRECTORY_SEEDS = [
  { name: "関東クラブユースサッカー連盟", url: "https://www.kanto-cy.com/", prefecture: "関東" },
  { name: "東京都クラブユースサッカー連盟", url: "https://tokyo-cy.jp/", prefecture: "東京都" },
  { name: "神奈川県クラブユースサッカー連盟", url: "https://kanagawa-cy.com/", prefecture: "神奈川県" },
  { name: "埼玉県クラブユースサッカー連盟", url: "https://saitama-cy.com/", prefecture: "埼玉県" },
  { name: "千葉県クラブユースサッカー連盟", url: "https://chiba-cy.com/", prefecture: "千葉県" },
  { name: "茨城県クラブユースサッカー連盟", url: "https://ibaraki-cy.com/", prefecture: "茨城県" },
  { name: "栃木県クラブユースサッカー連盟", url: "https://tochigi-cy.com/", prefecture: "栃木県" },
  { name: "群馬県クラブユースサッカー連盟", url: "https://gunma-cy.com/", prefecture: "群馬県" },

  { name: "東京都サッカー協会", url: "https://www.tokyofa.or.jp/", prefecture: "東京都" },
  { name: "神奈川県サッカー協会", url: "https://kanagawa-fa.gr.jp/", prefecture: "神奈川県" },
  { name: "埼玉県サッカー協会", url: "https://www.saitamafa.or.jp/", prefecture: "埼玉県" },
  { name: "千葉県サッカー協会", url: "https://chiba-fa.gr.jp/", prefecture: "千葉県" },
  { name: "茨城県サッカー協会", url: "https://www.ibaraki-fa.jp/", prefecture: "茨城県" },
  { name: "栃木県サッカー協会", url: "https://www.tfa.or.jp/", prefecture: "栃木県" },
  { name: "群馬県サッカー協会", url: "https://www.gunma-fa.com/", prefecture: "群馬県" },
];

const BAD_HOST_WORDS = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "lin.ee",
  "tiktok.com",
  "google.com",
  "yahoo.co.jp",
  "wikipedia.org",
  "ameblo.jp",
  "c-sqr.net",
  "amebaownd.com",
  "note.com",
  "lit.link",
  "linktr.ee",
];

function clean(text: string) {
  return String(text ?? "")
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
    return url;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function sameHost(a: string, b: string) {
  return hostOf(a) === hostOf(b);
}

function isBadUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());
  const host = hostOf(url);

  return (
    !lower.startsWith("http") ||
    BAD_HOST_WORDS.some((w) => host.includes(w) || lower.includes(w)) ||
    lower.includes("google.com/maps") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("maps.app.goo.gl") ||
    lower.includes("amazon.") ||
    lower.includes("rakuten.") ||
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
    lower.includes(".mov") ||
    lower.includes(".pdf")
  );
}

function looksDirectoryPage(url: string, anchorText = "") {
  const lower = decodeURIComponent(`${url} ${anchorText}`.toLowerCase());

  return (
    lower.includes("team") ||
    lower.includes("club") ||
    lower.includes("member") ||
    lower.includes("link") ||
    lower.includes("league") ||
    lower.includes("u15") ||
    lower.includes("u-15") ||
    lower.includes("u12") ||
    lower.includes("u-12") ||
    lower.includes("junior") ||
    lower.includes("youth") ||
    lower.includes("加盟") ||
    lower.includes("チーム") ||
    lower.includes("クラブ") ||
    lower.includes("一覧") ||
    lower.includes("リンク") ||
    lower.includes("参加") ||
    lower.includes("大会") ||
    lower.includes("リーグ")
  );
}

function looksSoccerText(text: string) {
  const t = clean(text);

  return (
    t.includes("FC") ||
    t.includes("ＦＣ") ||
    t.includes("SC") ||
    t.includes("ＳＣ") ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール") ||
    t.includes("U-15") ||
    t.includes("U15") ||
    t.includes("U-12") ||
    t.includes("U12") ||
    t.includes("JY")
  );
}

function looksSoccerUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    lower.includes("fc") ||
    lower.includes("sc") ||
    lower.includes("soccer") ||
    lower.includes("football") ||
    lower.includes("academy") ||
    lower.includes("school") ||
    lower.includes("club") ||
    lower.includes("junior") ||
    lower.includes("youth") ||
    lower.includes("u15") ||
    lower.includes("u-15") ||
    lower.includes("u12") ||
    lower.includes("u-12") ||
    lower.includes("jryouth") ||
    lower.includes("jy")
  );
}

function normalizeName(anchorText: string, url: string) {
  let text = clean(anchorText)
    .replace(/公式サイト/g, "")
    .replace(/公式HP/g, "")
    .replace(/ホームページ/g, "")
    .replace(/こちら/g, "")
    .replace(/詳細/g, "")
    .replace(/More/g, "")
    .replace(/more/g, "")
    .replace(/»/g, "")
    .replace(/›/g, "")
    .replace(/→/g, "")
    .trim();

  text = text.replace(/\s*[|｜].*$/g, "").trim();

  if (text && text.length >= 2 && text.length <= 45 && looksSoccerText(text)) {
    return text;
  }

  const host = hostOf(url)
    .replace(/\.(com|jp|net|org|co\.jp|ne\.jp)$/g, "")
    .replace(/-/g, " ")
    .trim();

  return host || url;
}

function buildBaseUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (
      host.includes("wixsite.com") ||
      host.includes("jimdo.com") ||
      host.includes("jimdofree.com") ||
      host.includes("webnode.jp")
    ) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return `${u.protocol}//${u.hostname}/${parts[0]}/`;
      }
    }

    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return url;
  }
}

function inferOrganizationType(name: string, url: string) {
  const text = `${name} ${url}`.toLowerCase();

  if (
    text.includes("school") ||
    text.includes("スクール") ||
    text.includes("academy") ||
    text.includes("アカデミー")
  ) {
    return "school";
  }

  if (
    text.includes("ladies") ||
    text.includes("women") ||
    text.includes("girls") ||
    text.includes("女子") ||
    text.includes("レディース") ||
    text.includes("ガールズ")
  ) {
    return "ladies";
  }

  return "club_team";
}

function inferRank(name: string, url: string) {
  const text = `${name} ${url}`;

  if (
    text.includes("レイソル") ||
    text.includes("アントラーズ") ||
    text.includes("レッズ") ||
    text.includes("アルディージャ") ||
    text.includes("FC東京") ||
    text.includes("ヴェルディ") ||
    text.includes("ゼルビア") ||
    text.includes("フロンターレ") ||
    text.includes("マリノス") ||
    text.includes("横浜FC") ||
    text.includes("ベルマーレ") ||
    text.includes("ジェフ") ||
    text.includes("栃木SC") ||
    text.includes("ザスパ")
  ) {
    return "J下部";
  }

  if (
    text.includes("スクール") ||
    text.includes("アカデミー") ||
    text.toLowerCase().includes("school") ||
    text.toLowerCase().includes("academy")
  ) {
    return "スクール";
  }

  return "街クラブ";
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];
    const text = clean(String(match[2] || "").replace(/<[^>]+>/g, " "));

    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());
      if (isBadUrl(abs)) continue;
      links.push({ url: abs, text });
    } catch {
      // ignore
    }
  }

  return links;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 source-directory-crawler/2.0",
        accept: "text/html,application/xhtml+xml",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      finalUrl: normalizeUrl(res.url || url),
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  const body = await readJsonBody(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const seeds = Array.isArray(body?.seeds) && body.seeds.length > 0
    ? body.seeds
    : DEFAULT_DIRECTORY_SEEDS;

  const targetSeeds = seeds.slice(0, Number(body?.maxSeeds ?? MAX_SEEDS));
  const maxPagesPerSeed = Math.min(Number(body?.maxPagesPerSeed ?? MAX_PAGES_PER_SEED), 50);
  const maxInsert = Math.min(Number(body?.maxInsert ?? MAX_INSERT), 1500);

  const { data: existingRows } = await supabase
    .from("selection_sources")
    .select("base_url,name");

  const existingHosts = new Set(
    (existingRows ?? []).map((r) => hostOf(r.base_url)).filter(Boolean),
  );

  const candidates = new Map<string, any>();
  const checkedPages: any[] = [];
  const errors: any[] = [];

  for (const seed of targetSeeds) {
    const queue = [normalizeUrl(seed.url)];
    const visited = new Set<string>();

    while (queue.length > 0 && visited.size < maxPagesPerSeed) {
      const pageUrl = normalizeUrl(queue.shift() || "");
      if (!pageUrl) continue;
      if (visited.has(pageUrl)) continue;
      if (isBadUrl(pageUrl)) continue;

      visited.add(pageUrl);

      let fetched: any;

      try {
        fetched = await fetchHtml(pageUrl);
      } catch (e) {
        errors.push({
          seed: seed.name,
          pageUrl,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      checkedPages.push({
        seed: seed.name,
        pageUrl,
        status: fetched.status,
      });

      if (!fetched.ok) continue;
      if (!String(fetched.contentType).includes("html")) continue;

      const links = extractLinks(fetched.html, fetched.finalUrl || pageUrl);

      for (const link of links) {
        const linkUrl = normalizeUrl(link.url);
        const linkHost = hostOf(linkUrl);

        if (!linkHost) continue;
        if (isBadUrl(linkUrl)) continue;

        if (sameHost(linkUrl, seed.url)) {
          if (!visited.has(linkUrl) && looksDirectoryPage(linkUrl, link.text)) {
            queue.push(linkUrl);
          }
          continue;
        }

        if (!looksSoccerUrl(linkUrl) && !looksSoccerText(link.text)) continue;

        const baseUrl = buildBaseUrl(linkUrl);
        const key = hostOf(baseUrl);

        if (!key) continue;
        if (existingHosts.has(key)) continue;
        if (candidates.has(key)) continue;

        const name = normalizeName(link.text, linkUrl);

        candidates.set(key, {
          name,
          base_url: baseUrl,
          organization_type: inferOrganizationType(name, baseUrl),
          enabled: true,
          crawl_type: "web",
          crawl_interval_minutes: 10080,
          source_rank: inferRank(name, baseUrl),
          found_from_seed: seed.name,
          found_from_url: pageUrl,
          anchor_text: link.text,
        });
      }
    }
  }

  const rows = Array.from(candidates.values()).slice(0, maxInsert);

  let inserted = 0;
  let skipped = 0;
  const insertedRows: any[] = [];
  const skippedRows: any[] = [];

  for (const row of rows) {
    const host = hostOf(row.base_url);

    if (!host || existingHosts.has(host)) {
      skipped += 1;
      skippedRows.push(row);
      continue;
    }

    const { data, error } = await supabase
      .from("selection_sources")
      .insert({
        name: row.name,
        base_url: row.base_url,
        organization_type: row.organization_type,
        enabled: true,
        crawl_type: "web",
        crawl_interval_minutes: 10080,
        source_rank: row.source_rank,
      })
      .select("id,name,base_url,organization_type,source_rank,enabled")
      .single();

    if (error) {
      errors.push({
        base_url: row.base_url,
        name: row.name,
        error: error.message,
      });
      continue;
    }

    existingHosts.add(host);
    inserted += 1;
    insertedRows.push(data);
  }

  return Response.json({
    ok: errors.length === 0,
    seedCount: targetSeeds.length,
    checkedPageCount: checkedPages.length,
    candidateCount: rows.length,
    inserted,
    skipped,
    errors,
    checkedPages: checkedPages.slice(0, 80),
    insertedRows,
    skippedRows: skippedRows.slice(0, 80),
  });
});