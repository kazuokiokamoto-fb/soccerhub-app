"use client";

import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import {
  STRENGTH_GUIDES,
  levelToStrengthRank,
  type StrengthGuide,
} from "@/app/match/constants/strengthGuides";
import type { MatchFilters } from "@/app/match/utils/filters";
import { categoryLabel } from "@/app/lib/categories";

export { STRENGTH_GUIDES };
export type { StrengthGuide };

export type Toast = {
  type: "success" | "error" | "info";
  text: string;
};

export type DbTeam = {
  id: string;
  owner_id?: string | null;
  name: string | null;
  area: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  address_detail?: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  has_ground: boolean | null;
  bike_parking: "あり" | "なし" | "不明" | string | null;
  bike_parking_capacity: string | null;
  member_count: number | null;
  roster_by_grade?: Record<string, number> | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  desired_dates?: string[] | null;
  note?: string | null;
  updated_at?: string | null;
};

export type OfferRow = {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

export const STRENGTH_OPTIONS: { value: StrengthRank; label: string }[] = [
  { value: "SS", label: "SS" },
  { value: "S", label: "S" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

function norm(v?: string | null) {
  return String(v ?? "").trim();
}

export function levelToRank(level?: number | null): StrengthRank | "" {
  return levelToStrengthRank(level);
}

export function buildAreaText(team: DbTeam) {
  const parts = [
    norm(team.area),
    norm(team.prefecture),
    norm(team.city),
    norm(team.town),
  ].filter(Boolean);

  return parts.join(" / ") || "未設定";
}

export function sumRoster(roster?: Record<string, number> | null): number {
  if (!roster) return 0;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

export function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v.includes("50")) return 50;

  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function teamStrengthLabel(team?: DbTeam | null) {
  if (!team) return "未設定";
  if (team.strength_rank?.trim()) return team.strength_rank.trim();

  const rank = levelToRank(team.level);
  return rank || "未設定";
}

export function formatTeamCategory(team?: DbTeam | null) {
  if (!team) return "未設定";

  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories
      .map((v) => categoryLabel(v) || v)
      .join(" / ");
  }

  return categoryLabel(team.category || "") || team.category || "未設定";
}

export function getStrength(team?: DbTeam | null) {
  return teamStrengthLabel(team);
}

export function getMemberCount(team?: DbTeam | null) {
  if (!team) return 0;
  if (team.member_count != null) return Number(team.member_count) || 0;
  return sumRoster(team.roster_by_grade);
}

export function formatBikeParking(team?: DbTeam | null) {
  if (!team) return "不明";

  const parking = String(team.bike_parking ?? "不明").trim() || "不明";
  const capacity = String(team.bike_parking_capacity ?? "").trim();

  if (capacity) {
    return `${parking} / ${capacity}`;
  }

  return parking;
}

export function matchesTeamFilters(team: DbTeam, filters: MatchFilters) {
  const teamCategories =
    Array.isArray(team.categories) && team.categories.length > 0
      ? team.categories
      : team.category
        ? [team.category]
        : [];

  if (filters.categoryFilter.length > 0) {
    const ok = teamCategories.some((c) =>
      filters.categoryFilter.includes(String(c).trim())
    );
    if (!ok) return false;
  }

  if (
    filters.prefectureFilter &&
    norm(team.prefecture) !== filters.prefectureFilter
  ) {
    return false;
  }

  if (filters.cityFilter && norm(team.city) !== filters.cityFilter) {
    return false;
  }

  if (filters.townFilter && norm(team.town) !== filters.townFilter) {
    return false;
  }

  if (filters.groundFilter !== "all") {
    const ground = team.has_ground ? "あり" : "なし";
    if (ground !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter.length > 0) {
    const rank =
      (team.strength_rank?.trim() as StrengthRank | "") || levelToRank(team.level);
    if (!rank || !filters.strengthFilter.includes(rank)) return false;
  }

  if (filters.bikeFilter !== "all") {
    const bike = (team.bike_parking ?? "不明") as "あり" | "なし" | "不明";
    if (bike !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team.bike_parking_capacity);
    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count =
      team.member_count != null
        ? Number(team.member_count)
        : sumRoster(team.roster_by_grade);

    if (count < Number(filters.memberCountMin)) return false;
  }

  if (filters.keyword.trim()) {
    const q = filters.keyword.trim().toLowerCase();

    const hay = [
      team.name,
      team.area,
      team.prefecture,
      team.city,
      team.town,
      team.category,
      ...(teamCategories ?? []),
      team.uniform_main,
      team.uniform_sub,
      team.note,
      team.bike_parking,
      team.bike_parking_capacity,
      String(team.member_count ?? ""),
      String(team.strength_rank ?? ""),
      levelToRank(team.level),
    ]
      .join(" ")
      .toLowerCase();

    if (!hay.includes(q)) return false;
  }

  return true;
}