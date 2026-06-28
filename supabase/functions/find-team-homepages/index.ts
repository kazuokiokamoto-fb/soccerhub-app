// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ROWS = 20;
const FETCH_TIMEOUT_MS = 12000;
const MIN_ACCEPT_SCORE = 120;

const BAD_DOMAINS = [
  "gekisaka.jp",
  "web.gekisaka.jp",
  "playerapp.tokyo",
  "web.playerapp.tokyo",
  "japan-football.net",
  "soccer-db.net",
  "transfermarkt",
  "wikipedia.org",
  "goal.com",
  "soccerdigestweb.com",
  "sports.yahoo.co.jp",
  "news.yahoo.co.jp",
  "prtimes.jp",
  "sponichi.co.jp",
  "nikkansports.com",
  "football-zone.net",
  "soccer-king.jp",
  "qoly.jp",
  "ultra-soccer.jp",
  "jfa.jp",
  "jfa.or.jp",
  "jleague.jp",
  "jleague.co",
  "jfl.or.jp",
  "kanto-fa.jp",
  "tokyo-fa.or.jp",
  "kanagawa-fa.gr.jp",
  "chiba-fa.gr.jp",
  "saitamafa.or.jp",
  "ibaraki-fa.jp",
  "tochigi-fa.com",
  "gunma-fa.com",
  "clubyouth-football.com",
  "clubyouth-u18.com",
  "clubyouth-u15.com",
  "tokyo-cy.jp",
  "kanagawa-cy.com",
  "saitama-cy.com",
  "chiba-cy.com",
  "ibaraki-cy.com",
  "tochigi-cy.com",
  "gunma-cy.com",
  "jy-soccer.jp",
  "juniorsoccer-news.com",
  "junior-soccer.jp",
  "green-card.co.jp",
  "footballnavi.jp",
  "sportspulse.site",
  "sgrum.com",
  "teams.one",
  "sports-bank.jp",
  "labola.jp",
  "net-menber.com",
  "circle-book.com",
  "jmty.jp",
  "spobook.com",
  "sposuru.com",
  "clubkatsudo.com",
  "duckduckgo.com",
  "html.duckduckgo.com",
  "u-18soccer.com",
  "koko-soccer.com",
  "soccerstation.co.jp",
  "navi.soccerstation.co.jp",
  "city.",
  ".city.",
  ".lg.jp",
  "pref.",
  ".pref.",
  "metro.tokyo.lg.jp",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "lin.ee",
  "google.com",
  "forms.gle",
  "docs.google.com",
  "maps.google",
];

const BAD_URL_PARTS = [
  "/news/",
  "/result",
  "/results",
  "/schedule",
  "/calendar",
  "/ranking",
  "/standings",
  "/match",
  "/game",
  "/blog/",
  "/category/",
  "/tag/",
  "/archive/",
  "/archives/",
  "/author/",
  "/feed",
  "/rss",
  "/wp-json",
  "/privacy",
  "/contact",
  "/inquiry",
  "/company",
  "/about/company",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".mov",
  ".avi",
];

const TEAM_WORDS = [
  "fc",
  "f.c",
  "sc",
  "サッカー",
  "soccer",
  "football",
  "フットボール",
  "クラブ",
  "club",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "u-12",
  "u12",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "academy",
  "アカデミー",
  "少年団",
  "スポーツ少年団",
];

const SITE_BUILDER_HINTS = [
  "jimdo",
  "jimdofree",
  "wixsite",
  "wix",
  "webnode",
  "amebaownd",
  "ownd",
  "peraichi",
  "strikingly",
  "stores",
];

const OFFICIAL_HINT_WORDS = [
  "公式",
  "official",
  "オフィシャル",
  "ホームページ",
  "homepage",
  "web site",
  "website",
  "クラブ概要",
  "チーム紹介",
  "選手紹介",
  "スタッフ",
  "スケジュール",
  "入会",
  "体験",
  "お問い合わせ",
];

const EC_WORDS = [
  "shop",
  "store",
  "ec",
  "cart",
  "goods",
  "グッズ",
  "ショップ",
  "オンラインショップ",
  "通販",
  "商品",
  "購入",
  "カート",
];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
    .replace(/[・･\.\-ー＿_（）()［\]【】「」『』]/g, "");
}

function stripTags(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function originOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("fbclid");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function isBadUrl(url: string) {
  const u = String(url || "").toLowerCase();
  const h = hostOf(u);

  if (!u.startsWith("http://") && !u.startsWith("https://")) return true;
  if (!h) return true;
  if (BAD_DOMAINS.some((d) => h.includes(d) || u.includes(d))) return true;
  if (BAD_URL_PARTS.some((p) => u.includes(p))) return true;

  return false;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) throw new Error(`fetch failed ${res.status}`);

    const ct = res.headers.get("content-type") || "";
    if (
      ct &&
      !ct.includes("text/html") &&
      !ct.includes("application/xhtml+xml") &&
      !ct.includes("text/plain")
    ) {
      throw new Error(`not html: ${ct}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractSearchLinks(html: string) {
  const links: string[] = [];
  const seen = new Set<string>();

  const re = /href="([^"]+)"/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    href = href.replace(/&amp;/g, "&");

    if (href.includes("uddg=")) {
      try {
        const u = new URL(href, "https://duckduckgo.com");
        const real = u.searchParams.get("uddg");
        if (real) href = decodeURIComponent(real);
      } catch {}
    }

    if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
    if (isBadUrl(href)) continue;

    const canon = canonicalUrl(href);
    const key = originOf(canon) || canon;

    if (seen.has(key)) continue;
    seen.add(key);
    links.push(canon);
  }

  return links.slice(0, 30);
}

async function searchWeb(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  return extractSearchLinks(html);
}

function getTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  return `${stripTags(title)} ${stripTags(h1)}`.trim();
}

function getTeamParts(teamName: string) {
  const original = normalizeText(teamName);

  const cleaned = original
    .replace(/u18|u15|u12|u13|u-18|u-15|u-12|u-13/g, "")
    .replace(/jr\.?|jy|jryouth/g, "")
    .replace(/ジュニアユース|ジュニアユス/g, "")
    .replace(/ジュニア|ユース|ユス/g, "")
    .replace(/サッカークラブ|サッカクラブ/g, "")
    .replace(/フットボールクラブ|フットボルクラブ/g, "")
    .replace(/フットボール|フットボル/g, "")
    .replace(/スポーツ少年団/g, "")
    .replace(/少年団/g, "")
    .replace(/サッカー|サッカ/g, "")
    .replace(/クラブ/g, "");

  const parts = cleaned
    .split(/fc|f\.c|sc|club|soccer|football|academy|アカデミー|u/g)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);

  const extra: string[] = [];

  const cityWords = [
    "東京",
    "町田",
    "横浜",
    "川崎",
    "湘南",
    "柏",
    "浦和",
    "大宮",
    "千葉",
    "水戸",
    "栃木",
    "群馬",
    "鹿島",
    "南葛",
    "武蔵野",
  ];

  for (const w of cityWords) {
    if (original.includes(w)) extra.push(w);
  }

  const knownNameWords = [
    "ヴェルディ",
    "ゼルビア",
    "フロンターレ",
    "マリノス",
    "ベルマーレ",
    "レイソル",
    "レッズ",
    "アルディージャ",
    "アントラーズ",
    "ホーリーホック",
    "トリプレッタ",
    "南葛",
    "横河武蔵野",
  ];

  for (const w of knownNameWords) {
    if (original.includes(normalizeText(w))) extra.push(normalizeText(w));
  }

  return Array.from(new Set([...parts, ...extra]))
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 8);
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function scoreCandidate(url: string, html: string, team: any) {
  const teamName = team.team_name || "";
  const pref = team.prefecture || "";
  const host = hostOf(url);
  const title = getTitle(html);
  const text = stripTags(html).slice(0, 8000);

  const nTeam = normalizeText(teamName);
  const nHost = normalizeText(host);
  const nTitle = normalizeText(title);
  const nText = normalizeText(text);
  const nUrl = normalizeText(url);
  const hay = `${url} ${host} ${title} ${text}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (host.endsWith(".shop")) {
    score -= 300;
    reasons.push("shop_domain_penalty");
  }

  if (EC_WORDS.some((w) => hay.includes(w.toLowerCase()))) {
    score -= 180;
    reasons.push("ec_or_shop_penalty");
  }

  if (!nTeam || isBadUrl(url)) return { score: -999, reasons: ["bad_url"] };

  if (nTitle.includes(nTeam)) {
    score += 120;
    reasons.push("title_has_full_team_name");
  }

  if (nText.includes(nTeam)) {
    score += 70;
    reasons.push("body_has_full_team_name");
  }

  if (nUrl.includes(nTeam) || nHost.includes(nTeam)) {
    score += 120;
    reasons.push("url_or_host_has_full_team_name");
  }

  const teamParts = getTeamParts(teamName);

  for (const p of teamParts.slice(0, 5)) {
    if (nHost.includes(p)) {
      score += 95;
      reasons.push(`host_has_part:${p}`);
    }

    if (nUrl.includes(p)) {
      score += 65;
      reasons.push(`url_has_part:${p}`);
    }

    if (nTitle.includes(p)) {
      score += 55;
      reasons.push(`title_has_part:${p}`);
    }

    if (nText.includes(p)) {
      score += 35;
      reasons.push(`body_has_part:${p}`);
    }
  }

  if (pref && hay.includes(String(pref).toLowerCase())) {
    score += 15;
    reasons.push("prefecture_hint");
  }

  if (TEAM_WORDS.some((w) => hay.includes(w.toLowerCase()))) {
    score += 30;
    reasons.push("team_words");
  }

  if (includesAny(hay, OFFICIAL_HINT_WORDS)) {
    score += 30;
    reasons.push("official_hint_words");
  }

  if (
    SITE_BUILDER_HINTS.some((w) => host.includes(w)) ||
    host.includes("fc-") ||
    host.includes("-fc") ||
    host.includes("sc-") ||
    host.includes("-sc") ||
    host.includes("futsal") ||
    host.includes("soccer") ||
    host.includes("football") ||
    host.includes("club")
  ) {
    score += 30;
    reasons.push("team_site_builder_or_host");
  }

  if (
    includesAny(url, [
      "/news/",
      "/article/",
      "/articles/",
      "/post/",
      "/posts/",
      "/blog/",
      "/category/",
      "/tag/",
      "/archive/",
      "/schedule",
      "/result",
      "/match",
    ])
  ) {
    score -= 60;
    reasons.push("article_or_list_url_penalty");
  }

  try {
    const path = new URL(url).pathname;
    const depth = path.split("/").filter(Boolean).length;

    if (path === "/" || path === "" || depth <= 1) {
      score += 20;
      reasons.push("shallow_homepage_like");
    }

    if (depth >= 4) {
      score -= 20;
      reasons.push("deep_url_penalty");
    }
  } catch {}

  if (text.length < 200) {
    score -= 25;
    reasons.push("thin_page_penalty");
  }

  const pageHead = `${url} ${title}`.toLowerCase();

  if (
    includesAny(pageHead, [
      "試合速報",
      "順位表",
      "大会結果",
      "選手権",
      "トーナメント",
      "掲示板",
      "まとめ",
      "ニュース一覧",
      "関連記事",
    ])
  ) {
    score -= 45;
    reasons.push("media_or_competition_penalty");
  }

  if (score < MIN_ACCEPT_SCORE) {
    return { score, reasons: [...reasons, "below_threshold"] };
  }

  return { score, reasons };
}

async function claimTeams(limit: number) {
  const { data, error } = await supabase
    .from("team_master")
    .select("*")
    .or("homepage_search_status.is.null,homepage_search_status.eq.unchecked,homepage_search_status.eq.retry")
    .order("current_league_rank", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = data || [];

  if (rows.length > 0) {
    await supabase
      .from("team_master")
      .update({
        homepage_search_status: "processing",
        homepage_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .in("id", rows.map((r) => r.id));
  }

  return rows;
}

async function saveHomepage(team: any, best: any) {
  const officialUrl = best.homepage_url || best.url;

  await supabase
    .from("team_master")
    .update({
      official_url: officialUrl,
      homepage_status: "found",
      homepage_search_status: "found",
      homepage_search_reason: best.reason,
      homepage_checked_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", team.id);

  const { data: existing } = await supabase
    .from("team_homepages")
    .select("id")
    .eq("team_master_id", team.id)
    .maybeSingle();

  const row = {
    team_master_id: team.id,
    team_name: team.team_name,
    prefecture: team.prefecture,
    official_url: officialUrl,
    homepage_status: "found",
    last_checked_at: nowIso(),
    updated_at: nowIso(),
  };

  if (existing?.id) {
    await supabase.from("team_homepages").update(row).eq("id", existing.id);
  } else {
    await supabase.from("team_homepages").insert({
      ...row,
      created_at: nowIso(),
    });
  }
}

async function markNotFound(team: any, reason: string) {
  await supabase
    .from("team_master")
    .update({
      homepage_search_status: "not_found",
      homepage_search_reason: reason.slice(0, 500),
      homepage_checked_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", team.id);
}

function buildQueries(team: any) {
  const teamName = team.team_name || "";
  const pref = team.prefecture || "";
  const category = String(team.category || "").toUpperCase();

  const baseQueries = [
    `${teamName} ${pref} サッカー 公式`,
    `${teamName} 公式`,
    `${teamName} ホームページ`,
    `${teamName} オフィシャル`,
    `${teamName} サッカークラブ`,
    `${teamName} soccer`,
    `${teamName} football`,
    `${teamName} soccer club official`,
    `${teamName} football club official`,
    `${teamName} FC`,
    `${teamName} SC`,
    `${teamName} クラブ`,
    `${teamName} アカデミー`,
    `${teamName} academy`,
  ];

  const categoryQueries: string[] = [];

  if (category === "U12") {
    categoryQueries.push(
      `${teamName} ジュニア`,
      `${teamName} U12`,
      `${teamName} U-12`,
      `${teamName} 少年団`,
      `${teamName} 小学生`,
    );
  }

  if (category === "U15") {
    categoryQueries.push(
      `${teamName} ジュニアユース`,
      `${teamName} U15`,
      `${teamName} U-15`,
      `${teamName} U13`,
      `${teamName} U-13`,
      `${teamName} アカデミー`,
    );
  }

  if (category === "U18") {
    categoryQueries.push(
      `${teamName} ユース`,
      `${teamName} U18`,
      `${teamName} U-18`,
      `${teamName} アカデミー`,
    );
  }

  return Array.from(new Set([...categoryQueries, ...baseQueries]));
}

async function processTeam(team: any) {
  const teamName = team.team_name || "";
  const pref = team.prefecture || "";
  const queries = buildQueries(team);

  const seenUrls = new Set<string>();
  const bestByHomepage = new Map<string, any>();
  const candidates: any[] = [];

  for (const q of queries) {
    const urls = await searchWeb(q);

    for (const url of urls) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      try {
        const html = await fetchText(url);
        const scored = scoreCandidate(url, html, team);
        const homepageUrl = originOf(url) || url;

        const candidate = {
          url,
          homepage_url: homepageUrl,
          score: scored.score,
          reasons: scored.reasons,
        };

        candidates.push(candidate);

        const prev = bestByHomepage.get(homepageUrl);
        if (!prev || candidate.score > prev.score) {
          bestByHomepage.set(homepageUrl, candidate);
        }
      } catch (e) {
        candidates.push({
          url,
          homepage_url: originOf(url) || url,
          score: -1,
          reasons: [`fetch_error:${String(e?.message || e).slice(0, 80)}`],
        });
      }

      await sleep(250);
    }

    await sleep(500);
  }

  const homepageCandidates = Array.from(bestByHomepage.values()).sort(
    (a, b) => b.score - a.score,
  );

  const best = homepageCandidates[0];

  if (best && best.score >= MIN_ACCEPT_SCORE) {
    await saveHomepage(team, {
      url: best.url,
      homepage_url: best.homepage_url,
      reason: `score:${best.score}; source_url:${best.url}; ${best.reasons.join(",")}`,
    });

    return {
      status: "found",
      team_name: teamName,
      prefecture: pref,
      url: best.homepage_url,
      source_url: best.url,
      score: best.score,
      candidates: homepageCandidates.slice(0, 5),
    };
  }

  await markNotFound(
    team,
    `no_good_candidate; best:${best?.homepage_url || best?.url || "none"} score:${best?.score ?? "none"} reasons:${best?.reasons?.join(",") || ""}`,
  );

  return {
    status: "not_found",
    team_name: teamName,
    prefecture: pref,
    best,
    candidates: homepageCandidates.slice(0, 5),
    rawCandidates: candidates.slice(0, 10),
  };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.batchSize || body.limit || 5), MAX_ROWS);

    const teams = await claimTeams(limit);

    const results = [];
    let found = 0;
    let notFound = 0;
    let errors = 0;

    for (const team of teams) {
      try {
        const r = await processTeam(team);
        results.push(r);

        if (r.status === "found") found++;
        else notFound++;
      } catch (e) {
        errors++;

        await supabase
          .from("team_master")
          .update({
            homepage_search_status: "error",
            homepage_search_reason: String(e?.message || e).slice(0, 500),
            homepage_checked_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq("id", team.id);

        results.push({
          status: "error",
          team_name: team.team_name,
          error: String(e?.message || e),
        });
      }

      await sleep(500);
    }

    return json({
      ok: true,
      mode: "find-team-homepages",
      sourceTable: "team_master",
      minAcceptScore: MIN_ACCEPT_SCORE,
      claimed: teams.length,
      found,
      notFound,
      errors,
      results,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
      },
      500,
    );
  }
});