// app/match/utils/filters.ts

import type { StrengthRank } from "@/app/components/StrengthRankPicker";

export type TeamFilterRow = {
  id: string;
  owner_id: string | null;
  name: string;
  area: string | null;
  category: string | null;
  categories: string[] | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  level: number | null;
  strength_rank?: string | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  note: string | null;
  updated_at: string;
};

export type MatchFilters = {
  keyword: string;
  categoryFilter: string[];
  prefectureFilter: string;
  cityFilter: string;
  townFilter: string;
  groundFilter: "all" | "あり" | "なし";
  strengthFilter: StrengthRank[];
  bikeFilter: "all" | "あり" | "なし" | "不明";
  bikeCapacityMin: string;
  memberCountMin: string;
};

const KANTO_PREFS = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
];

export function levelLabel(level: number): StrengthRank {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

export function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();

  if (!v || v === "不明") return null;
  if (v.includes("50")) return 50;

  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function sumRoster(roster?: Record<string, number> | null) {
  if (!roster) return 0;

  return Object.values(roster).reduce((sum, v) => {
    return sum + (Number(v) || 0);
  }, 0);
}

export function guessPartsFromAreaText(area?: string | null) {
  const raw = (area ?? "").trim();

  if (!raw) return {};

  let prefecture = "";
  let rest = raw;

  for (const p of KANTO_PREFS) {
    if (raw.startsWith(p)) {
      prefecture = p;
      rest = raw.slice(p.length).trim();
      break;
    }
  }

  rest = rest.replace(/^\s+/, "");

  if (rest.includes("・")) {
    const [c, t] = rest.split("・").map((s) => s.trim());

    return {
      prefecture: prefecture || undefined,
      city: c || undefined,
      town: t || undefined,
    };
  }

  const tokens = rest.split(/\s+/).filter(Boolean);

  const city = tokens[0] ?? "";
  const town = tokens[1] ?? "";

  return {
    prefecture: prefecture || undefined,
    city: city || undefined,
    town: town || undefined,
  };
}

export function slotParts(s: any) {
  const p = (s.prefecture ?? "").trim();
  const c = (s.city ?? "").trim();
  const t = (s.town ?? "").trim();

  if (p || c || t) {
    return {
      prefecture: p || undefined,
      city: c || undefined,
      town: t || undefined,
    };
  }

  return guessPartsFromAreaText(s.area ?? "");
}

export function includesKeyword(
  team: TeamFilterRow | undefined,
  slot: any,
  keyword: string
) {
  const q = keyword.trim().toLowerCase();

  if (!q) return true;

  const slotCategories: string[] =
    Array.isArray(slot?.categories) && slot.categories.length > 0
      ? slot.categories.map((v: unknown) => String(v).trim()).filter(Boolean)
      : slot?.category
      ? [String(slot.category).trim()]
      : [];

  const teamCategories: string[] =
    Array.isArray(team?.categories) && team.categories.length > 0
      ? team.categories.map((v: unknown) => String(v).trim()).filter(Boolean)
      : team?.category
      ? [String(team.category).trim()]
      : [];

  const hay = [
    team?.name,
    team?.area,
    team?.category,
    ...teamCategories,
    ...slotCategories,
    team?.note,
    team?.uniform_main,
    team?.uniform_sub,
    team?.bike_parking,
    team?.bike_parking_capacity,
    slot?.area,
    slot?.area_text,
    slot?.category,
    team?.strength_rank,
    levelLabel(Number(team?.level ?? 0)),
    String(team?.member_count ?? sumRoster(team?.roster_by_grade)),
  ]
    .map((v) => String(v ?? ""))
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

export function matchesSlotFilters(
  slot: any,
  teamMap: Map<string, TeamFilterRow>,
  filters: MatchFilters
) {
  const team = teamMap.get(slot.host_team_id);

  const cats: string[] =
    Array.isArray(slot?.categories) && slot.categories.length > 0
      ? slot.categories.map((v: unknown) => String(v).trim()).filter(Boolean)
      : slot?.category
      ? [String(slot.category).trim()]
      : Array.isArray(team?.categories) && team.categories.length > 0
      ? team.categories.map((v: unknown) => String(v).trim()).filter(Boolean)
      : team?.category
      ? [String(team.category).trim()]
      : [];

  if (filters.categoryFilter.length > 0) {
    if (cats.length === 0) return false;

    if (!cats.some((c: string) => filters.categoryFilter.includes(c))) {
      return false;
    }
  }

  const fallbackParts = slotParts(slot);

  const parts = team
    ? {
        prefecture: team.prefecture ?? fallbackParts.prefecture,
        city: team.city ?? fallbackParts.city,
        town: team.town ?? fallbackParts.town,
      }
    : fallbackParts;

  if (
    filters.prefectureFilter &&
    (parts.prefecture ?? "") !== filters.prefectureFilter
  ) {
    return false;
  }

  if (filters.cityFilter && (parts.city ?? "") !== filters.cityFilter) {
    return false;
  }

  if (filters.townFilter && (parts.town ?? "") !== filters.townFilter) {
    return false;
  }

  if (filters.groundFilter !== "all") {
    const val = team?.has_ground ? "あり" : "なし";

    if (val !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter.length > 0) {
    const rank = (team?.strength_rank?.trim() as StrengthRank) ||
      levelLabel(Number(team?.level ?? 0));

    if (!filters.strengthFilter.includes(rank)) {
      return false;
    }
  }

  if (filters.bikeFilter !== "all") {
    const bike = String(team?.bike_parking ?? "不明");

    if (bike !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team?.bike_parking_capacity);

    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count =
      team?.member_count != null
        ? Number(team.member_count)
        : sumRoster(team?.roster_by_grade);

    if (count < Number(filters.memberCountMin)) return false;
  }

  if (!includesKeyword(team, slot, filters.keyword)) return false;

  return true;
}