// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUMMARY_DOMAINS = [
  "juniorsoccer-news.com",
  "soccerplayer.net",
  "goal-selection.net",
  "soccer-selection.com",
  "j-s-weekly.com",
];

const BAD_DOMAINS = [
  "google.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "maps.google",
  "flic.kr",
  "flickr.com",
];

const BAD_EXT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".zip",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
];

const GOOD_WORDS = [
  "セレクション",
  "選考会",
  "体験練習会",
  "体験会",
  "練習会",
  "練習参加",
  "練習体験",
  "練習見学",
  "新入団",
  "入団",
  "入部",
  "募集",
  "選手募集",
  "団員募集",
  "部員募集",
  "メンバー募集",
  "ジュニアユース",
  "ユース",
  "社会人",
  "女子",
  "レディース",
  "シニア",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "u-12",
  "u12",
];

const ACTION_WORDS = [
  "セレクション",
  "選考会",
  "体験練習会",
  "体験会",
  "練習会",
  "練習参加",
  "練習体験",
  "練習見学",
  "新入団",
  "入団",
  "入部",
  "募集",
  "選手募集",
  "団員募集",
  "部員募集",
  "メンバー募集",
];

const SOCCER_WORDS = [
  "サッカー",
  "soccer",
  "football",
  "フットボール",
  "fc",
  "f.c",
  "f.c.",
  "sc",
  "s.c",
  "s.c.",
  "ジュニアユース",
  "ユース",
  "社会人サッカー",
  "女子サッカー",
  "レディース",
  "u-15",
  "u15",
  "u-18",
  "u18",
  "u-12",
  "u12",
  "u-13",
  "u13",
  "クラブユース",
  "jユース",
  "j下部",
];

const BAD_WORDS = [
  "オープンキャンパス",
  "学校説明会",
  "入試説明会",
  "入学説明会",
  "入学試験",
  "入試",
  "写真素材",
  "加盟チーム一覧",
  "チーム一覧",
  "メンバー表",
  "試合結果",
  "大会結果",
  "順位表",
  "星取表",
];

const STRONG_SOCCER_DOMAINS = [
  "footballnavi.jp",
  "sgrum.com",
  "soccerpla.jp",
  "soccer-selection.com",
  "goal-selection.net",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", `"`)
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripTags(s: string) {
  return decodeHtml(String(s || "").replace(/<[^>]*>/g, " "))
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

function isSummaryUrl(url: string) {
  const h = hostOf(url);
  return SUMMARY_DOMAINS.some((d) => h.includes(d));
}

function isBadUrl(url: string) {
  const u = String(url || "").toLowerCase();

  if (!u.startsWith("http://") && !u.startsWith("https://")) return true;
  if (BAD_EXT.some((ext) => u.includes(ext))) return true;

  const h = hostOf(url);
  if (!h) return true;
  if (BAD_DOMAINS.some((d) => h.includes(d))) return true;

  return false;
}

function absUrl(href: string, baseUrl: string) {
  try {
    const raw = decodeHtml(href || "").trim();
    if (!raw) return null;
    if (raw.startsWith("#")) return null;
    if (raw.startsWith("mailto:")) return null;
    if (raw.startsWith("tel:")) return null;
    return new URL(raw, baseUrl).toString().split("#")[0];
  } catch {
    return null;
  }
}

function matchedFrom(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.filter((w) => t.includes(w.toLowerCase()));
}

function matchedWords(text: string) {
  return matchedFrom(text, GOOD_WORDS);
}

function hasStrongSoccerDomain(url: string) {
  const h = hostOf(url);
  return STRONG_SOCCER_DOMAINS.some((d) => h.includes(d));
}

function getFreshnessPenalty(text: string) {
  const now = new Date();
  const currentYear = now.getFullYear();

  let penalty = 0;

  const fiscalYearMatches = text.match(/20\d{2}年度/g) || [];
  const fiscalYears = fiscalYearMatches
    .map((v) => Number(v.replace("年度", "")))
    .filter(Boolean);

  if (fiscalYears.length > 0) {
    const maxFiscalYear = Math.max(...fiscalYears);

    if (maxFiscalYear < currentYear) {
      penalty -= Math.min((currentYear - maxFiscalYear) * 40, 160);
    }

    if (maxFiscalYear > currentYear) {
      penalty += 20;
    }
  }

  if (text.includes("昨年度")) penalty -= 80;
  if (text.includes("募集終了")) penalty -= 80;
  if (text.includes("受付終了")) penalty -= 80;
  if (text.includes("終了しました")) penalty -= 80;
  if (text.includes("締め切りました")) penalty -= 80;

  const dated: Date[] = [];

  const jpDateRe = /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/g;
  let m;
  while ((m = jpDateRe.exec(text)) !== null) {
    dated.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  const slashDateRe = /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/g;
  while ((m = slashDateRe.exec(text)) !== null) {
    dated.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  const shortDateRe = /(\d{1,2})[\/月](\d{1,2})(?:日)?/g;
  while ((m = shortDateRe.exec(text)) !== null) {
    const month = Number(m[1]);
    const day = Number(m[2]);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dated.push(new Date(currentYear, month - 1, day));
    }
  }

  if (dated.length > 0) {
    const today = new Date(currentYear, now.getMonth(), now.getDate());
    const maxDate = new Date(Math.max(...dated.map((d) => d.getTime())));

    if (maxDate < today) {
      penalty -= 60;
    } else {
      penalty += 20;
    }
  }

  return penalty;
}

function scoreLink(item: { title: string; url: string; context: string }) {
  const text = `${item.title} ${item.url} ${item.context}`.toLowerCase();

  const matched = matchedWords(text);
  const actionMatched = matchedFrom(text, ACTION_WORDS);
  const soccerMatched = matchedFrom(text, SOCCER_WORDS);
  const badMatched = matchedFrom(text, BAD_WORDS);

  if (actionMatched.length === 0) {
    return { ok: false, score: 0, matched, reason: "no_action_word" };
  }

  if (badMatched.length > 0 && soccerMatched.length === 0 && !hasStrongSoccerDomain(item.url)) {
    return {
      ok: false,
      score: 0,
      matched,
      reason: `bad_word:${badMatched.join(",")}`,
    };
  }

  let score = matched.length * 10;

  if (text.includes("セレクション")) score += 40;
  if (text.includes("選考会")) score += 35;
  if (text.includes("体験練習会")) score += 30;
  if (text.includes("体験会")) score += 20;
  if (text.includes("練習会")) score += 20;
  if (text.includes("練習参加")) score += 18;
  if (text.includes("練習体験")) score += 18;
  if (text.includes("新入団")) score += 25;
  if (text.includes("入団")) score += 15;
  if (text.includes("入部")) score += 15;
  if (text.includes("募集")) score += 18;
  if (text.includes("選手募集")) score += 20;
  if (text.includes("部員募集")) score += 16;
  if (text.includes("メンバー募集")) score += 16;

  if (text.includes("ジュニアユース")) score += 10;
  if (text.includes("ユース")) score += 8;
  if (text.includes("社会人")) score += 8;
  if (text.includes("女子")) score += 8;
  if (text.includes("レディース")) score += 8;
  if (text.includes("シニア")) score += 8;
  if (text.includes("u-15") || text.includes("u15")) score += 8;
  if (text.includes("u-18") || text.includes("u18")) score += 8;

  if (text.includes("サッカー")) score += 15;
  if (text.includes("football")) score += 8;
  if (text.includes("soccer")) score += 8;
  if (soccerMatched.length > 0) score += soccerMatched.length * 3;

  if (badMatched.length > 0) score -= badMatched.length * 25;

  score += getFreshnessPenalty(text);

  const h = hostOf(item.url);

  if (h.includes("juniorsoccer-news.com")) score -= 20;
  if (h.includes("soccerplayer.net")) score -= 10;
  if (h.includes("facebook.com")) score += 5;
  if (h.includes("instagram.com")) score += 5;
  if (h.includes("sgrum.com")) score += 10;
  if (h.includes("footballnavi.jp")) score += 10;
  if (hasStrongSoccerDomain(item.url)) score += 10;

  return {
    ok: score >= 25,
    score,
    matched,
    reason: score >= 25 ? null : "low_score_or_old_info",
  };
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`fetch failed ${res.status}`);
  }

  return await res.text();
}

function extractLinks(html: string, baseUrl: string) {
  const results = [];
  const seen = new Set();

  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let m;
  while ((m = re.exec(html)) !== null) {
    const url = absUrl(m[1], baseUrl);
    if (!url) continue;
    if (isBadUrl(url)) continue;
    if (seen.has(url)) continue;

    const title = stripTags(m[2]);
    const context = stripTags(
      html.slice(Math.max(0, m.index - 350), Math.min(html.length, m.index + 700)),
    );

    const judged = scoreLink({ title, url, context });

    if (!judged.ok) continue;

    seen.add(url);

    results.push({
      title: title || url,
      url,
      context,
      score: judged.score,
      matched: judged.matched,
      reason: judged.reason,
    });
  }

  return results.slice(0, 80);
}

async function claimSummaryPages(limit: number) {
  const orParts = SUMMARY_DOMAINS.map((d) => `url.ilike.%${d}%`).join(",");

  const { data, error } = await supabase
    .from("selection_page_candidates")
    .select("id,prefecture,municipality,query,title,url,score")
    .or(orParts)
    .is("checked_at", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function runOne(parent: any) {
  try {
    const html = await fetchHtml(parent.url);
    const links = extractLinks(html, parent.url);

    let inserted = 0;
    let skipped = 0;

    for (const link of links) {
      if (isSummaryUrl(link.url)) {
        skipped++;
        continue;
      }

      const row = {
        prefecture: parent.prefecture,
        municipality: parent.municipality,
        query: parent.query,
        title: link.title,
        url: link.url,
        snippet: link.context.slice(0, 500),
        source_type: "summary_extracted_link",
        status: "candidate",
        matched_keywords: link.matched,
        score: link.score,
        excluded_reason: null,
        discovered_from: "summary_page",
        parent_url: parent.url,
        link_depth: 1,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("selection_page_candidates")
        .upsert(row, { onConflict: "url" });

      if (error) {
        console.error("upsert error", error);
        skipped++;
      } else {
        inserted++;
      }
    }

    await supabase
      .from("selection_page_candidates")
      .update({
        checked_at: new Date().toISOString(),
        verified_reason: `summary_links_extracted:${links.length}`,
      })
      .eq("id", parent.id);

    return {
      parent_url: parent.url,
      links: links.length,
      inserted,
      skipped,
    };
  } catch (e) {
    await supabase
      .from("selection_page_candidates")
      .update({
        checked_at: new Date().toISOString(),
        verified_reason: `summary_extract_error:${String(e?.message || e)}`,
      })
      .eq("id", parent.id);

    return {
      parent_url: parent.url,
      error: String(e?.message || e),
    };
  }
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit || 3), 10);

    const parents = await claimSummaryPages(limit);

    const results = [];

    for (const parent of parents) {
      const r = await runOne(parent);
      results.push(r);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    return json({
      ok: true,
      mode: "extract-selection-links-all-ages",
      claimed: parents.length,
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