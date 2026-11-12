/**
 * Lower tier is crawled first. Tiers 10 and 20 are the daily top group:
 * プレミア, プリンス, 関東1部, 関東2部, and 都道府県1部.
 * Affiliation is the strength source when a team has one. Otherwise the
 * league name, then the stored league rank, then strength rank or level.
 */

export type StrengthFields = {
  leagueLevel?: string | null;
  leagueDivision?: number | null;
  leagueName?: string | null;
  leagueRank?: number | null;
  strengthRank?: string | null;
  teamLevel?: number | null;
};

export const TOP_SELECTION_TIER = 20;

export function isTopSelectionTier(tier: number): boolean {
  return tier <= TOP_SELECTION_TIER;
}

function normalizeLeagueName(name: string | null | undefined): string {
  return String(name ?? "").normalize("NFKC").trim();
}

/** Known league-name tiers. Null when the name does not say which division it is. */
export function tierFromLeagueName(name: string | null | undefined): number | null {
  const text = normalizeLeagueName(name);
  if (!text) return null;
  if (/プレミア|プリンス/.test(text)) return 10;
  if (/関東/.test(text) && /1部/.test(text)) return 10;
  if (/関東/.test(text) && /2部/.test(text)) return 20;
  if (/地区/.test(text)) return 60;
  if (hasToken(text, ["T1", "TOP", "S1", "C1"]) || /ウルトラ|1部/.test(text)) return 20;
  if (hasToken(text, ["T2", "G1", "S2", "C2"]) || /2部|2N/.test(text)) return 30;
  if (hasToken(text, ["T3", "G2"]) || /3部/.test(text)) return 40;
  if (hasToken(text, ["T4"]) || /4部/.test(text)) return 50;
  return null;
}

function hasToken(text: string, tokens: string[]): boolean {
  return tokens.some((token) => new RegExp(`(?:^|[^A-Za-z0-9])${token}(?:[^A-Za-z0-9]|$)`, "i").test(text));
}

export function tierFromLeagueRank(rank: number | null | undefined): number | null {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) return null;
  if (rank <= 1) return 10;
  if (rank === 2) return 20;
  if (rank >= 101 && rank <= 199) return 25;
  if (rank >= 11 && rank < 100) {
    const division = rank % 10;
    if (division === 1) return 20;
    if (division === 2) return 30;
    if (division === 3) return 40;
    if (division === 4) return 50;
    return 55;
  }
  if (rank >= 200 && rank < 400) return 70;
  return 80;
}

function tierFromAffiliation(level: string | null | undefined, division: number | null | undefined): number | null {
  if (level === "prefecture" && division != null && division >= 1 && division <= 4) {
    return 10 + division * 10;
  }
  if (level === "district" && division != null && division >= 1 && division <= 4) {
    return division <= 2 ? 60 : 65;
  }
  if (level === "other") return 80;
  return null;
}

function tierFromStrength(rank: string | null | undefined, level: number | null | undefined): number | null {
  const key = String(rank ?? "").trim();
  if (key === "SS") return 20;
  if (key === "S") return 40;
  if (key === "A") return 60;
  if (key === "B") return 65;
  if (key === "C") return 80;
  if (level == null || !Number.isFinite(level)) return null;
  if (level >= 9) return 20;
  if (level >= 7) return 40;
  if (level >= 5) return 60;
  if (level >= 3) return 65;
  return 80;
}

export function selectionStrengthTier(input: StrengthFields): number {
  const affiliation = tierFromAffiliation(input.leagueLevel, input.leagueDivision);
  if (affiliation != null) return affiliation;
  const named = tierFromLeagueName(input.leagueName);
  if (named != null) return named;
  const fromRank = tierFromLeagueRank(input.leagueRank);
  if (fromRank != null) return fromRank;
  const strength = tierFromStrength(input.strengthRank, input.teamLevel);
  if (strength != null) return strength;
  return 90;
}

export function selectionStrengthTie(input: StrengthFields): number {
  const rank = input.leagueRank;
  if (typeof rank === "number" && Number.isFinite(rank) && rank > 0) return rank;
  return 9999;
}

export function compareSelectionStrength(
  a: StrengthFields & { checkedAt?: string | null },
  b: StrengthFields & { checkedAt?: string | null },
): number {
  const tier = selectionStrengthTier(a) - selectionStrengthTier(b);
  if (tier !== 0) return tier;
  const tie = selectionStrengthTie(a) - selectionStrengthTie(b);
  if (tie !== 0) return tie;
  const aChecked = a.checkedAt ?? null;
  const bChecked = b.checkedAt ?? null;
  if (aChecked == null && bChecked == null) return 0;
  if (aChecked == null) return -1;
  if (bChecked == null) return 1;
  if (aChecked < bChecked) return -1;
  if (aChecked > bChecked) return 1;
  return 0;
}

/** Keep the incoming order and skip a second team on a host already chosen. */
export function takeDiverseHosts<T>(
  rows: readonly T[],
  limit: number,
  hostOf: (row: T) => string,
): T[] {
  const chosen: T[] = [];
  const hosts = new Set<string>();
  for (const row of rows) {
    const host = hostOf(row);
    if (host && hosts.has(host)) continue;
    if (host) hosts.add(host);
    chosen.push(row);
    if (chosen.length >= limit) break;
  }
  return chosen;
}
