// Single source for strength rank copy, the stored level number, and the
// affiliation league that suggests that rank. Screens should read this module
// instead of keeping their own sentences or thresholds.
//
// Standings (official_standing_candidates / standing_rank) are not an input.
// A table position does not move a team between divisions, so it is not a
// reliable hint for SS–C.

export type StrengthRank = "SS" | "S" | "A" | "B" | "C";

export const STRENGTH_RANKS: readonly StrengthRank[] = ["SS", "S", "A", "B", "C"];

export function isStrengthRank(value: string): value is StrengthRank {
  return (STRENGTH_RANKS as readonly string[]).includes(value);
}

export const LEAGUE_LEVELS = [
  { id: "prefecture", label: "都・県リーグ" },
  { id: "district", label: "地域リーグ" },
  { id: "other", label: "リーグなし・その他" },
] as const;

export type LeagueLevelId = (typeof LEAGUE_LEVELS)[number]["id"];

export const LEAGUE_DIVISIONS = [1, 2, 3, 4] as const;

export type LeagueDivision = (typeof LEAGUE_DIVISIONS)[number];

export function isLeagueLevel(value: string): value is LeagueLevelId {
  return LEAGUE_LEVELS.some((item) => item.id === value);
}

export function isLeagueDivision(value: number): value is LeagueDivision {
  return (LEAGUE_DIVISIONS as readonly number[]).includes(value);
}

export function leagueLevelLabel(level: string | null | undefined): string {
  return LEAGUE_LEVELS.find((item) => item.id === level)?.label ?? "";
}

export type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
  stars: string;
  /** teams.level written for this rank. Floors also convert older numbers. */
  legacyLevel: number;
  leagueLevel: LeagueLevelId;
  /** Empty for リーグなし・その他. Otherwise the 部 numbers that suggest this rank. */
  divisions: readonly LeagueDivision[];
};

export const STRENGTH_GUIDES: StrengthGuide[] = [
  {
    rank: "SS",
    short: "都・県リーグ1・2部",
    title: "公式戦上位レベルの強度を想定したカテゴリー",
    bullets: [
      "都・県リーグ上位所属",
      "試合強度：★★★★★（非常に高い）",
      "球際・切り替えが速く、戦術理解度が高い",
      "公式戦同等レベルの緊張感ある試合を希望",
    ],
    note: "「強度の高い実戦形式」を求めるチーム向け",
    stars: "★★★★★",
    legacyLevel: 9,
    leagueLevel: "prefecture",
    divisions: [1, 2],
  },
  {
    rank: "S",
    short: "都・県リーグ3・4部",
    title: "公式戦基準の競争力を持つカテゴリー",
    bullets: [
      "都・県リーグ所属",
      "試合強度：★★★★☆（高い）",
      "基礎技術が安定し、組織的な守備・攻撃ができる",
      "上位リーグ昇格を目指すレベル",
    ],
    note: "「しっかり競り合える相手」を求めるチーム向け",
    stars: "★★★★☆",
    legacyLevel: 7,
    leagueLevel: "prefecture",
    divisions: [3, 4],
  },
  {
    rank: "A",
    short: "地域リーグ1・2部",
    title: "育成と競争のバランス型カテゴリー",
    bullets: [
      "地域リーグ上位所属",
      "試合強度：★★★☆☆（中〜やや高）",
      "個人技術向上＋チーム連携を重視",
      "チャレンジマッチにも適したレベル",
    ],
    note: "「公式戦を想定しつつ育成も重視」するチーム向け",
    stars: "★★★☆☆",
    legacyLevel: 5,
    leagueLevel: "district",
    divisions: [1, 2],
  },
  {
    rank: "B",
    short: "地域リーグ3・4部",
    title: "成長重視の実戦経験カテゴリー",
    bullets: [
      "地域リーグ所属",
      "試合強度：★★☆☆☆（やや穏やか）",
      "試合経験を積みながら基礎力を伸ばす段階",
      "バランスの良いマッチング向き",
    ],
    note: "「経験を積みたい」「自信をつけたい」チーム向け",
    stars: "★★☆☆☆",
    legacyLevel: 3,
    leagueLevel: "district",
    divisions: [3, 4],
  },
  {
    rank: "C",
    short: "フレンドリー",
    title: "交流・経験重視カテゴリー",
    bullets: [
      "リーグ所属問わず",
      "試合強度：★☆☆☆☆（交流中心）",
      "新チーム編成・初心者中心・交流目的",
      "勝敗よりも経験や交流を重視",
    ],
    note: "「楽しく真剣に」「幅広い交流」を希望するチーム向け",
    stars: "★☆☆☆☆",
    legacyLevel: 1,
    leagueLevel: "other",
    divisions: [],
  },
];

const GUIDES_BY_LEVEL = [...STRENGTH_GUIDES].sort((a, b) => b.legacyLevel - a.legacyLevel);

export function strengthGuideByRank(rank: string | null | undefined): StrengthGuide | null {
  const key = String(rank ?? "").trim();
  return STRENGTH_GUIDES.find((guide) => guide.rank === key) ?? null;
}

export function strengthShortLabel(rank: string | null | undefined): string {
  return strengthGuideByRank(rank)?.short ?? "";
}

/** teams.level for a rank. Unknown ranks use A (5), the historical form default. */
export function strengthRankToLegacyLevel(rank: StrengthRank): number {
  return strengthGuideByRank(rank)?.legacyLevel ?? 5;
}

/**
 * Convert teams.level to a rank using the guide floors (SS 9, S 7, A 5, B 3, C 1).
 * 8 is S, not SS. Missing or non-numeric levels return "".
 * 0 and other numbers below C still read as C, matching the existing screens.
 */
export function levelToStrengthRank(level?: number | null): StrengthRank | "" {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  for (const guide of GUIDES_BY_LEVEL) {
    if (n >= guide.legacyLevel) return guide.rank;
  }
  return GUIDES_BY_LEVEL[GUIDES_BY_LEVEL.length - 1]?.rank ?? "C";
}

/**
 * Suggest a rank from the affiliation league. Returns null unless the pair is
 * one the guide actually describes. Does not read standings.
 */
export function suggestRankFromLeague(
  leagueLevel: string | null | undefined,
  division: number | string | null | undefined,
): StrengthRank | null {
  const level = String(leagueLevel ?? "").trim();
  if (!isLeagueLevel(level)) return null;
  if (level === "other") {
    return STRENGTH_GUIDES.find((guide) => guide.leagueLevel === "other")?.rank ?? null;
  }
  const divisionNumber =
    typeof division === "number" ? division : Number(String(division ?? "").trim());
  if (!Number.isInteger(divisionNumber)) return null;
  return (
    STRENGTH_GUIDES.find(
      (guide) => guide.leagueLevel === level && guide.divisions.includes(divisionNumber as LeagueDivision),
    )?.rank ?? null
  );
}

/** True only when the shown rank is the one the saved league would suggest. */
export function affiliationSuggestsRank(input: {
  rank: string | null | undefined;
  leagueLevel: string | null | undefined;
  leagueDivision: number | string | null | undefined;
}): boolean {
  const suggested = suggestRankFromLeague(input.leagueLevel, input.leagueDivision);
  if (!suggested) return false;
  return String(input.rank ?? "").trim() === suggested;
}
