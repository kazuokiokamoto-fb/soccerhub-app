import type { LeagueSiteConfig } from "../configs/index.ts";
import { fetchHtml, canFetchUrl } from "./fetch.ts";
import { extractLinks, sortCandidateLinks } from "./links.ts";
import { stripTags, cleanText } from "./normalize.ts";

export type DiscoveredPage = {
  url: string;
  html: string;
  score: number;
  reason: string[];
};

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}

function scorePage(
  url: string,
  html: string,
  config: LeagueSiteConfig,
  targetLeagueName: string,
) {
  const text = cleanText(stripTags(html)).slice(0, 12000);
  const hay = `${url} ${text}`.toLowerCase();
  const league = String(targetLeagueName || "").toLowerCase();

  let score = 0;
  const reason: string[] = [];

  if (league && hay.includes(league)) {
    score += 120;
    reason.push("target_league_name");
  }

  for (const word of config.leagueWords || []) {
    if (hay.includes(String(word).toLowerCase())) {
      score += 50;
      reason.push(`league_word:${word}`);
    }
  }

  for (const word of config.rankingWords || []) {
    if (hay.includes(String(word).toLowerCase())) {
      score += 70;
      reason.push(`ranking_word:${word}`);
    }
  }

  const tableCount = (html.match(/<table[\s\S]*?<\/table>/gi) || []).length;
  if (tableCount > 0) {
    score += tableCount * 80;
    reason.push(`table:${tableCount}`);
  }

  if (/順位|勝点|勝ち点|得点|失点|勝|分|敗|試合/.test(text)) {
    score += 100;
    reason.push("standing_columns");
  }

  for (const word of config.negativeWords || []) {
    if (hay.includes(String(word).toLowerCase())) {
      score -= 80;
      reason.push(`negative:${word}`);
    }
  }

  if (url.toLowerCase().includes("news")) score -= 100;
  if (url.toLowerCase().includes("schedule")) score -= 80;
  if (url.toLowerCase().includes("download")) score -= 120;

  return { score, reason };
}

export async function discoverRankingPages(params: {
  startUrl: string;
  config: LeagueSiteConfig;
  targetLeagueName: string;
  maxLinks?: number;
}): Promise<DiscoveredPage[]> {
  const { startUrl, config, targetLeagueName } = params;
  const maxLinks = params.maxLinks ?? 30;

  const startHtml = await fetchHtml(startUrl);
  const links = sortCandidateLinks(extractLinks(startHtml, startUrl))
    .filter(canFetchUrl)
    .slice(0, maxLinks);

  const candidates: DiscoveredPage[] = [];

  const startScore = scorePage(startUrl, startHtml, config, targetLeagueName);
  candidates.push({
    url: startUrl,
    html: startHtml,
    score: startScore.score,
    reason: startScore.reason,
  });

  for (const url of links) {
    try {
      const html = await fetchHtml(url);
      const scored = scorePage(url, html, config, targetLeagueName);

      if (scored.score >= 80) {
        candidates.push({
          url,
          html,
          score: scored.score,
          reason: scored.reason,
        });
      }
    } catch {
      // skip
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}