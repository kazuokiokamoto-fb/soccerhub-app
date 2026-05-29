// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_SOURCES = 80;
const MAX_PAGES_PER_SOURCE = 8;
const MAX_INSERT = 300;

function clean(text: string) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
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

  return (
    lower.includes("instagram.com") ||
    lower.includes("facebook.com") ||
    lower.includes("twitter.com") ||
    lower.includes("x.com/") ||
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("line.me") ||
    lower.includes("lin.ee") ||
    lower.includes("tiktok.com") ||
    lower.includes("google.com/maps") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("maps.app.goo.gl") ||
    lower.includes("amazon.") ||
    lower.includes("rakuten.") ||
    lower.includes("yahoo.co.jp") ||
    lower.includes("jfa.jp/match") ||
    lower.includes("/ticket") ||
    lower.includes("/goods") ||
    lower.includes("/shop") ||
    lower.includes("/privacy") ||
    lower.includes("/contact") ||
    lower.includes("/inquiry") ||
    lower.includes("/recruit/staff") ||
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
    lower.includes("jryouth") ||
    lower.includes("jy")
  );
}

function looksSoccerText(text: string) {
  return (
    text.includes("FC") ||
    text.includes("ＳＣ") ||
    text.includes("SC") ||
    text.includes("サッカー") ||
    text.includes("フットボール") ||
    text.includes("クラブ") ||
    text.includes("ジュニアユース") ||
    text.includes("ユース") ||
    text.includes("アカデミー") ||
    text.includes("スクール") ||
    text.includes("U-15") ||
    text.includes("U15") ||
    text.includes("JY") ||
    text.includes("選手募集") ||
    text.includes("セレクション") ||
    text.includes("練習会")
  );
}

function inferOrganizationType(name: string, url: string) {
  const text = `${name} ${url}`;

  if (
    text.includes("スクール") ||
    text.toLowerCase().includes("school") ||
    text.includes("アカデミー") ||
    text.toLowerCase().includes("academy")
  ) {
    return "school";
  }

  if (
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
    text.includes("Jリーグ") ||
    text.includes("J下部") ||
    text.includes("レイソル") ||
    text.includes("アントラーズ") ||
    text.includes("レッズ") ||
    text.includes("FC東京") ||
    text.includes("ヴェルディ") ||
    text.includes("フロンターレ") ||
    text.includes("マリノス") ||
    text.includes("ベルマーレ") ||
    text.includes("ジェフ") ||
    text.includes("栃木SC") ||
    text.includes("ザスパ")
  ) {
    return "J下部";
  }

  if (
    text.includes("スクール") ||
    text.toLowerCase().includes("school") ||
    text.includes("アカデミー")
  ) {
    return "スクール";
  }

  return "街クラブ";
}

function normalizeName(anchorText: string, url: string) {
  const text = clean(anchorText)
    .replace(/公式サイト/g, "")
    .replace(/公式HP/g, "")
    .replace(/ホームページ/g, "")
    .replace(/こちら/g, "")
    .replace(/詳細/g, "")
    .replace(/申込/g, "")
    .replace(/申し込み/g, "")
    .replace(/»/g, "")
    .replace(/›/g, "")
    .replace(/→/g, "")
    .trim();

  if (text && text.length >= 2 && text.length <= 40 && looksSoccerText(text)) {
    return text;
  }

  const host = hostOf(url)
    .replace(/\.(com|jp|net|org|co\.jp|ne\.jp)$/g, "")
    .replace(/-/g, " ")
    .trim();

  return host || url;
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

function usefulInternalPath(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    lower.includes("link") ||
    lower.includes("club") ||
    lower.includes("team") ||
    lower.includes("academy") ||
    lower.includes("school") ||
    lower.includes("junior") ||
    lower.includes("youth") ||
    lower.includes("match") ||
    lower.includes("result") ||
    lower.includes("schedule") ||
    lower.includes("news") ||
    lower.includes("info") ||
    lower.includes("selection") ||
    lower.includes("tryout") ||
    lower.includes("recruit")
  );
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 selection-source-finder/2.0 (+https://example.com)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const finalUrl = normalizeUrl(res.url || url);
  const html = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    contentType,
    finalUrl,
    html,
  };
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Missing Supabase env" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: sources, error: sourceError } = await supabase
    .from("selection_sources")
    .select("id,name,base_url,organization_type,source_rank,enabled")
    .eq("enabled", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(MAX_SOURCES);

  if (sourceError) {
    return Response.json({ ok: false, error: sourceError.message }, { status: 500 });
  }

  const { data: existingRows } = await supabase
    .from("selection_sources")
    .select("base_url,name");

  const existingHosts = new Set(
    (existingRows ?? []).map((r) => hostOf(r.base_url)).filter(Boolean),
  );

  const candidates = new Map<string, any>();
  const errors: any[] = [];

  for (const source of sources ?? []) {
    const queue = [source.base_url];
    const visited = new Set<string>();

    while (queue.length > 0 && visited.size < MAX_PAGES_PER_SOURCE) {
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
          source: source.name,
          pageUrl,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      if (!fetched.ok) continue;
      if (!String(fetched.contentType).includes("html")) continue;

      const links = extractLinks(fetched.html, fetched.finalUrl || pageUrl);

      for (const link of links) {
        const linkUrl = normalizeUrl(link.url);
        const linkHost = hostOf(linkUrl);

        if (!linkHost) continue;
        if (isBadUrl(linkUrl)) continue;

        if (sameHost(linkUrl, source.base_url)) {
          if (!visited.has(linkUrl) && usefulInternalPath(linkUrl)) {
            queue.push(linkUrl);
          }
          continue;
        }

        if (existingHosts.has(linkHost)) continue;

        const soccerLike =
          looksSoccerUrl(linkUrl) ||
          looksSoccerText(link.text);

        if (!soccerLike) continue;

        const name = normalizeName(link.text, linkUrl);
        const organizationType = inferOrganizationType(name, linkUrl);
        const sourceRank = inferRank(name, linkUrl);

        const baseUrl = (() => {
          try {
            const u = new URL(linkUrl);
            return `${u.protocol}//${u.hostname}/`;
          } catch {
            return linkUrl;
          }
        })();

        const key = hostOf(baseUrl);
        if (!key) continue;

        if (!candidates.has(key)) {
          candidates.set(key, {
            name,
            base_url: baseUrl,
            organization_type: organizationType,
            enabled: true,
            crawl_type: "web",
            crawl_interval_minutes: 10080,
            source_rank: sourceRank,
            found_from_source: source.name,
            found_from_url: pageUrl,
            anchor_text: link.text,
          });
        }
      }
    }
  }

  const rows = Array.from(candidates.values()).slice(0, MAX_INSERT);

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
    checkedSourceCount: sources?.length ?? 0,
    candidateCount: rows.length,
    inserted,
    skipped,
    errors,
    insertedRows,
    skippedRows: skippedRows.slice(0, 30),
  });
});