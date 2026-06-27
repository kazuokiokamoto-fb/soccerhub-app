import type { LeagueSiteConfig } from "../configs/index.ts";

import { discoverRankingPages } from "./discover.ts";
import { findBestTable } from "./table.ts";
import { parseTeamsFromTable } from "./parser.ts";
import { filterTeams } from "./filter.ts";

export async function crawlLeagueRanking(
  config: LeagueSiteConfig,
  leagueName: string,
) {
  const pages = await discoverRankingPages({
    startUrl: config.startUrl,
    config,
    targetLeagueName: leagueName,
  });

  if (pages.length === 0) {
    return [];
  }

  const allTeams = [];

  for (const page of pages) {
    const table = findBestTable(page.html);

    if (!table) continue;

    const parsed = parseTeamsFromTable(table.html);

    if (parsed.length === 0) continue;

    const filtered = filterTeams(parsed);

    if (filtered.length === 0) continue;

    allTeams.push(...filtered);
  }

  const seen = new Set<string>();

  return allTeams.filter((team) => {
    const key = team.teamName
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "");

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}