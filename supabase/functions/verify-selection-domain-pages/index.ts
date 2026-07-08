// @ts-nocheck
// verify-selection-domain-pages/index.ts
// team_selection_research から selection_page_url を取得して直接クロール
// 複数日程対応・チームID紐付け・2段階クロール（専用ページ→ニュース記事）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_RUN_MS = 50_000;
const FETCH_TIMEOUT_MS = 12_000;
const RECRAWL_HOURS = 24;
const BATCH_SIZE = 5;

const BAD_DOMAINS = [
  "instagram.com", "facebook.com", "x.com", "twitter.com",
  "youtube.com", "line.me", "google.com", "forms.gle",
];

const CORE_SELECTION_WORDS = [
  "セレクション", "選考会", "トライアウト", "tryout", "selection",
  "練習会", "体験練習会", "体験会", "練習参加", "体験参加",
  "選手募集", "新入団", "入団希望", "現小学6年生", "新中学1年生",
  "ジュニアユース説明会", "GK募集", "ゴールキーパー募集",
];

const NEWS_LIST_PATTERNS = [
  "/news", "/topics", "/information", "/info", "/notice",
  "/blog", "/posts", "/articles", "/お知らせ",
];

const SOURCE_RANK_MAP: Record<string, string> = {
  "関東": "pref_top", "プリンス": "pref_top", "プレミア": "pref_top",
  "T1": "pref_top", "S1": "pref_top", "C1": "pref_top",
  "ウルトラ": "pref_top", "1部": "pref_top",
  "T2": "pref_2", "G1": "pref_2", "2部": "pref_2",
  "T3": "pref_3", "G2": "pref_3", "3部": "pref_3",
  "T4": "pref_4", "4部": "pref_4",
};

const J_CLUBS = [
  "鹿島アントラーズ", "水戸ホーリーホック", "浦和レッズ", "大宮アルディージャ",
  "柏レイソル", "ジェフユナイテッド", "FC東京", "東京ヴェルディ", "FC町田ゼルビア",
  "川崎フロンターレ", "横浜F・マリノス", "横浜FC", "湘南ベルマーレ",
  "栃木SC", "ザスパ群馬", "ヴァンフォーレ甲府",
];

function nowIso() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cleanForDb(text: string, max = 20000) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\u2028/g, " ").replace(/\u2029/g, " ")
    .slice(0, max);
}

function compactText(text: string, max = 12000) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isBadDomain(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BAD_DOMAINS.some((d) => host.includes(d));
  } catch { return true; }
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    ["utm_source","utm_medium","utm_campaign","fbclid"]
      .forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "");
  } catch { return url; }
}

function pathOf(url: string) {
  try { return new URL(url).pathname.toLowerCase(); }
  catch { return ""; }
}

function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&nbsp;", " ");
}

function stripTags(html: string) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n").replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  ).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function getTitle(html: string, fallback = "") {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);
  return fallback.slice(0, 120);
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = decodeHtml(m[1] || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const u = new URL(href, baseUrl);
      u.hash = "";
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const url = canonicalUrl(u.toString());
      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ url, label: stripTags(m[2] || "").trim() });
    } catch { continue; }
  }
  return links;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("xhtml") && !ct.includes("text/plain")) {
      throw new Error(`not html: ${ct}`);
    }
    return { html: await res.text(), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function toDateString(d: Date | null) {
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m-1, d);
  return (dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d) ? dt : null;
}

function extractAllDates(text: string): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const dates = new Map<string, Date>();
  const raw = String(text || "");

  const fullPatterns = [
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/g,
    /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/g,
  ];
  for (const pattern of fullPatterns) {
    let m;
    while ((m = pattern.exec(raw)) !== null) {
      const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (d) { const s = toDateString(d)!; if (!dates.has(s)) dates.set(s, d); }
    }
  }

  const fiscal = raw.match(/(20\d{2})年度/);
  const baseYear = fiscal ? Number(fiscal[1]) : currentYear;
  const jpShort = /(\d{1,2})月\s*(\d{1,2})日/g;
  let m;
  while ((m = jpShort.exec(raw)) !== null) {
    let d = validDate(baseYear, Number(m[1]), Number(m[2]));
    if (d && d.getTime() < now.getTime() - 1000*60*60*24*60) {
      d = validDate(baseYear+1, Number(m[1]), Number(m[2]));
    }
    if (d) { const s = toDateString(d)!; if (!dates.has(s)) dates.set(s, d); }
  }

  const today = toDateString(now)!;
  const twoYearsLater = `${currentYear+2}-12-31`;
  return Array.from(dates.keys())
    .filter(d => d >= today && d <= twoYearsLater)
    .sort();
}

function extractEventDates(text: string): string[] {
  const lines = compactText(text, 30000).split(/\n|。|\./).map(v => v.trim()).filter(Boolean);
  const selectionLines = lines.filter(line =>
    includesAny(line, ["開催日","実施日","日程","セレクション","選考会","練習会","体験会","体験練習"])
  );
  const fromSelectionLines: string[] = [];
  for (const line of selectionLines) {
    fromSelectionLines.push(...extractAllDates(line));
  }
  const fromAll = extractAllDates(text);
  const result = fromSelectionLines.length > 0 ? fromSelectionLines : fromAll;
  return [...new Set(result)].sort();
}

function extractDeadline(text: string): string | null {
  const lines = compactText(text, 20000).split(/。|\.|\n/).map(v => v.trim()).filter(Boolean);
  const deadlineLines = lines.filter(line =>
    line.includes("締切") || line.includes("〆切") || line.includes("申込期限") ||
    line.includes("受付期限") || line.includes("受付締切")
  );
  for (const line of deadlineLines) {
    const dates = extractAllDates(line);
    if (dates.length > 0) return dates[0];
  }
  return null;
}

function extractCategories(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const cats = new Set<string>();
  if (t.includes("u-12") || t.includes("u12") || t.includes("小学")) cats.add("U-12");
  if (t.includes("u-13") || t.includes("u13") || t.includes("新中1") || t.includes("中学1")) cats.add("U-13");
  if (t.includes("u-15") || t.includes("u15") || t.includes("ジュニアユース") || t.includes("中学生")) cats.add("U-15");
  if (t.includes("u-18") || t.includes("u18") || t.includes("ユース") || t.includes("高校")) cats.add("U-18");
  if (t.includes("女子") || t.includes("レディース")) cats.add("女子");
  if (t.includes("gk") || t.includes("ゴールキーパー")) cats.add("GK");
  return Array.from(cats);
}

function extractGender(text: string): string {
  const t = String(text || "").toLowerCase();
  if (t.includes("女子") || t.includes("レディース") || t.includes("women") || t.includes("girls")) return "girls";
  return "any";
}

function extractVenue(text: string) {
  const lines = String(text || "").split(/\n|。/).map(v => v.trim()).filter(Boolean);
  const line = lines.find(l =>
    l.includes("会場") || l.includes("場所") || l.includes("グラウンド") || l.includes("競技場")
  );
  if (!line) return { venueName: null, venueAddress: null };
  const cleaned = line.replace(/^【?(?:会場|場所)】?\s*[:：]?\s*/, "").slice(0, 120);
  const addr = cleaned.match(/(東京都|神奈川県|埼玉県|千葉県|茨城県|栃木県|群馬県|山梨県)[^\s　、。)]{3,80}/);
  return { venueName: cleaned || null, venueAddress: addr?.[0] || null };
}

function extractFee(text: string) {
  const t = String(text || "");
  if (t.includes("無料") || t.includes("参加費無料")) return { feeAmount: 0, feeNote: "無料" };
  const m = t.match(/(?:参加費|費用|料金)[^\d０-９]{0,10}([0-9０-９,，]+)\s*円/);
  if (!m?.[1]) return { feeAmount: null, feeNote: null };
  const amount = Number(m[1].replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0)-0xfee0)).replace(/[，,]/g,""));
  return { feeAmount: isFinite(amount) ? amount : null, feeNote: m[0].slice(0, 80) };
}

function extractTimeRange(text: string) {
  const m = text.match(/(\d{1,2})[:：](\d{2})\s*[〜~\-－～]\s*(\d{1,2})[:：](\d{2})/);
  if (!m) return { eventStartTime: null, eventEndTime: null };
  return {
    eventStartTime: `${m[1].padStart(2,"0")}:${m[2]}`,
    eventEndTime: `${m[3].padStart(2,"0")}:${m[4]}`,
  };
}

function displayStatus(eventDates: string[], deadline: string | null, text: string): string {
  const today = toDateString(new Date())!;
  if (text.includes("募集終了") || text.includes("受付終了") || text.includes("締め切りました")) return "申込終了";
  if (deadline && deadline < today) return "申込終了";
  if (eventDates.length > 0 && eventDates[eventDates.length-1] < today) return "開催終了";
  if (eventDates.length === 0) return "日付未取得";
  return "募集中";
}

function inferSourceRank(leagueName: string, teamName: string): string {
  const t = `${leagueName} ${teamName}`;
  if (J_CLUBS.some(j => t.includes(j))) return "j_academy";

  // 関東リーグ（全国的にも都道府県トップより上位）
  if (t.includes("関東")) return "pref_top";

  // 都道府県トップリーグ
  if (t.includes("プリンス") || t.includes("プレミア")) return "pref_top";
  if (t.includes("T1") || t.includes("S1") || t.includes("C1")) return "pref_top";
  if (t.includes("ウルトラ") || /TOP/i.test(t) || /1部/.test(t)) return "pref_top";

  // 「地区トップ」は名前に反してpref_top直下（S2よりさらに下）の第3階層
  // 例：埼玉県U-12「S1 > S2 > 地区トップ > 地区リーグ」の4段階構造（協会公式要項で確認済み）
  if (t.includes("地区トップ")) return "pref_3";

  // 2部相当
  if (t.includes("T2") || t.includes("G1") || t.includes("S2") || t.includes("C2") || /2部/.test(t)) return "pref_2";

  // 3部相当
  if (t.includes("T3") || t.includes("G2") || /3部/.test(t)) return "pref_3";

  // 4部相当
  if (t.includes("T4") || /4部/.test(t)) return "pref_4";

  return "district";
}


async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function crawlAndFindSelectionPage(
  selectionPageUrl: string,
  teamName: string,
): Promise<{ url: string; html: string; text: string; title: string } | null> {
  if (isBadDomain(selectionPageUrl)) return null;

  try {
    const { html, finalUrl } = await fetchHtml(selectionPageUrl);
    const text = stripTags(html);
    const title = getTitle(html, teamName);

    if (includesAny(text, CORE_SELECTION_WORDS)) {
      return { url: finalUrl, html, text, title };
    }

    const links = extractLinks(html, finalUrl)
      .filter(l => hostOf(l.url) === hostOf(finalUrl))
      .filter(l => !isBadDomain(l.url));

    const newsListLinks = links.filter(l => {
      const p = pathOf(l.url);
      return NEWS_LIST_PATTERNS.some(pattern => p.includes(pattern)) ||
        includesAny(l.label, ["ニュース","お知らせ","最新情報","topics","news","information"]);
    }).slice(0, 3);

    const directLinks = links.filter(l =>
      includesAny(`${l.url} ${l.label}`, [...CORE_SELECTION_WORDS,"selection","recruit","boshu","taiken"])
    ).slice(0, 5);

    for (const link of directLinks) {
      try {
        await sleep(300);
        const { html: lHtml, finalUrl: lUrl } = await fetchHtml(link.url);
        const lText = stripTags(lHtml);
        if (includesAny(lText, CORE_SELECTION_WORDS)) {
          return { url: lUrl, html: lHtml, text: lText, title: getTitle(lHtml, link.label) };
        }
      } catch { continue; }
    }

    for (const newsList of newsListLinks) {
      try {
        await sleep(300);
        const { html: listHtml, finalUrl: listUrl } = await fetchHtml(newsList.url);
        const articleLinks = extractLinks(listHtml, listUrl)
          .filter(l => hostOf(l.url) === hostOf(finalUrl))
          .filter(l => {
            const p = pathOf(l.url);
            return /\d{4}/.test(p) || /\/(news|entry|post|article|topics)\/[^/]+/.test(p);
          }).slice(0, 10);

        for (const article of articleLinks) {
          try {
            await sleep(200);
            const { html: aHtml, finalUrl: aUrl } = await fetchHtml(article.url);
            const aText = stripTags(aHtml);
            if (includesAny(aText, CORE_SELECTION_WORDS)) {
              return { url: aUrl, html: aHtml, text: aText, title: getTitle(aHtml, article.label) };
            }
          } catch { continue; }
        }
      } catch { continue; }
    }

    return null;
  } catch {
    return null;
  }
}

async function claimResearchRows(limit: number) {
  const cutoffIso = new Date(Date.now() - RECRAWL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("team_selection_research")
    .select("*, team_master:team_master_id(id, team_name, prefecture, category, current_league_name, current_league_rank, gender)")
    .not("selection_page_url", "is", null)
    .neq("selection_page_url", "")
    .or(`checked_at.is.null,checked_at.lt.${cutoffIso}`)
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3); // 多めに取得してソート

  if (error) throw error;
  
  const rows = data || [];
  
  // U-15を優先、次にリーグランクが高い順
  rows.sort((a, b) => {
    const catOrder: Record<string, number> = { "U15": 0, "U18": 1, "U12": 2 };
    const aCat = catOrder[a.team_master?.category || ""] ?? 9;
    const bCat = catOrder[b.team_master?.category || ""] ?? 9;
    if (aCat !== bCat) return aCat - bCat;
    const aRank = a.team_master?.current_league_rank ?? 999;
    const bRank = b.team_master?.current_league_rank ?? 999;
    return aRank - bRank;
  });
  
  return rows.slice(0, limit);
}

async function upsertSelectionEvents(
  research: any,
  page: { url: string; text: string; title: string },
) {
  const teamMaster = research.team_master || {};
  const teamName = teamMaster.team_name || "不明";
  const leagueName = teamMaster.current_league_name || "";
  const prefecture = teamMaster.prefecture || null;
  const category = teamMaster.category || research.target_category || "";

  const fullText = compactText(`${page.title} ${teamName} ${page.text}`, 40000);
  const eventDates = extractEventDates(fullText);
  const deadline = extractDeadline(fullText);
  const categories = extractCategories(fullText);
  const gender = extractGender(fullText);
  const statusText = displayStatus(eventDates, deadline, fullText);
  const venue = extractVenue(fullText);
  const fee = extractFee(fullText);
  const timeRange = extractTimeRange(fullText);
  const sourceRank = inferSourceRank(leagueName, teamName);
  const summary = cleanForDb(compactText(page.text, 200), 200);
  const description = cleanForDb(compactText(page.text, 800), 800);

  const baseEventRow = {
    team_master_id: research.team_master_id || null,
    organization_name: teamName,
    organization_type: J_CLUBS.some(j => teamName.includes(j)) ? "j_club" : "club_team",
    target_categories: categories.length > 0 ? categories : [category].filter(Boolean),
    gender,
    prefecture,
    area: prefecture,
    venue_name: venue.venueName,
    venue_address: venue.venueAddress,
    event_dates: eventDates,
    event_start_time: timeRange.eventStartTime,
    event_end_time: timeRange.eventEndTime,
    application_deadline: deadline,
    fee_amount: fee.feeAmount,
    fee_note: fee.feeNote,
    source_url: research.selection_page_url,
    official_url: page.url,
    selection_page_url: research.selection_page_url,
    summary,
    description,
    raw_text: cleanForDb(page.text, 20000),
    fetched_at: nowIso(),
    status: "published",
    display_status: statusText,
    is_featured: J_CLUBS.some(j => teamName.includes(j)),
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    source_type: "team_selection_research",
    extraction_status: eventDates.length > 0 ? "success" : "date_missing",
    source_rank: sourceRank,
  };

  const results = [];
  const datesToProcess = eventDates.length > 0 ? eventDates : [null];

  for (const eventDate of datesToProcess) {
    const hashKey = eventDate
      ? `${research.team_master_id}:${eventDate}:${research.selection_page_url}`
      : `${research.team_master_id}:no_date:${research.selection_page_url}`;
    const duplicateKey = await sha256(hashKey);
    const title = eventDate
      ? `${teamName} セレクション ${eventDate}`
      : `${teamName} セレクション情報`;

    const eventRow = {
      ...baseEventRow,
      title,
      event_date: eventDate,
      duplicate_key: duplicateKey,
      content_hash: duplicateKey,
      memo: cleanForDb(`team_master_id:${research.team_master_id}\nleague:${leagueName}\ncategory:${category}\nevent_date:${eventDate}\nall_dates:${eventDates.join(",")}\ncrawled_url:${page.url}`, 2000),
    };

    const { data: existing } = await supabase
      .from("selection_events")
      .select("id, manual_locked")
      .eq("duplicate_key", duplicateKey)
      .limit(1)
      .maybeSingle();

    if (existing?.manual_locked) {
      results.push({ status: "manual_locked", eventDate });
      continue;
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("selection_events")
        .update(eventRow)
        .eq("id", existing.id);
      if (error) throw new Error(`update error: ${JSON.stringify(error)}`);
      results.push({ status: "updated", eventDate });
    } else {
      const { error } = await supabase
        .from("selection_events")
        .insert({ ...eventRow, created_at: nowIso() });
      if (error) throw new Error(`insert error: ${JSON.stringify(error)}`);
      results.push({ status: "inserted", eventDate });
    }
  }

  await supabase
    .from("team_selection_research")
    .update({ checked_at: nowIso() })
    .eq("id", research.id);

  return results;
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || body.limit || BATCH_SIZE), 20);
    const startedAt = Date.now();

    const rows = await claimResearchRows(batchSize);
    if (rows.length === 0) {
      return json({ ok: true, message: "no rows to process", processed: 0 });
    }

    const results = [];
    let totalInserted = 0, totalUpdated = 0, totalNotFound = 0, totalErrors = 0;

    for (const research of rows) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        results.push({ status: "time_limit_reached" });
        break;
      }

      const teamName = research.team_master?.team_name || "不明";

      try {
        const page = await crawlAndFindSelectionPage(
          research.selection_page_url,
          teamName,
        );

        if (!page) {
          await supabase
            .from("team_selection_research")
            .update({ checked_at: nowIso() })
            .eq("id", research.id);
          results.push({ teamName, status: "not_found", url: research.selection_page_url });
          totalNotFound++;
          continue;
        }

        const upsertResults = await upsertSelectionEvents(research, page);
        const inserted = upsertResults.filter(r => r.status === "inserted").length;
        const updated = upsertResults.filter(r => r.status === "updated").length;
        totalInserted += inserted;
        totalUpdated += updated;

        results.push({
          teamName,
          status: "success",
          url: page.url,
          eventDates: upsertResults.map(r => r.eventDate).filter(Boolean),
          inserted,
          updated,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ teamName, status: "error", error: message });
        totalErrors++;
        await supabase
          .from("team_selection_research")
          .update({ checked_at: nowIso() })
          .eq("id", research.id);
      }

      await sleep(500);
    }

    return json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      processed: rows.length,
      totalInserted,
      totalUpdated,
      totalNotFound,
      totalErrors,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});
