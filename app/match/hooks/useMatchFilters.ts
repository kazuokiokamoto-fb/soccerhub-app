"use client";

import { useEffect, useMemo, useState } from "react";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { MatchFilters } from "../utils/filters";

const STORAGE_KEY = "sakamatch:home-filters:v1";

type PersistedFilters = {
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

function loadSavedFilters(): PersistedFilters | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      keyword: String(parsed.keyword ?? ""),
      categoryFilter: Array.isArray(parsed.categoryFilter)
        ? parsed.categoryFilter.map(String)
        : [],
      prefectureFilter: String(parsed.prefectureFilter ?? ""),
      cityFilter: String(parsed.cityFilter ?? ""),
      townFilter: String(parsed.townFilter ?? ""),
      groundFilter:
        parsed.groundFilter === "あり" || parsed.groundFilter === "なし"
          ? parsed.groundFilter
          : "all",
      strengthFilter: Array.isArray(parsed.strengthFilter)
        ? parsed.strengthFilter.filter((v: unknown) =>
            ["SS", "S", "A", "B", "C"].includes(String(v))
          )
        : [],
      bikeFilter:
        parsed.bikeFilter === "あり" ||
        parsed.bikeFilter === "なし" ||
        parsed.bikeFilter === "不明"
          ? parsed.bikeFilter
          : "all",
      bikeCapacityMin: String(parsed.bikeCapacityMin ?? ""),
      memberCountMin: String(parsed.memberCountMin ?? ""),
    };
  } catch {
    return null;
  }
}

export function useMatchFilters() {
  const saved = typeof window !== "undefined" ? loadSavedFilters() : null;

  const [keyword, setKeyword] = useState(saved?.keyword ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    saved?.categoryFilter ?? []
  );
  const [prefectureFilter, setPrefectureFilter] = useState(
    saved?.prefectureFilter ?? ""
  );
  const [cityFilter, setCityFilter] = useState(saved?.cityFilter ?? "");
  const [townFilter, setTownFilter] = useState(saved?.townFilter ?? "");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">(
    saved?.groundFilter ?? "all"
  );
  const [strengthFilter, setStrengthFilter] = useState<StrengthRank[]>(
    saved?.strengthFilter ?? []
  );
  const [bikeFilter, setBikeFilter] = useState<
    "all" | "あり" | "なし" | "不明"
  >(saved?.bikeFilter ?? "all");
  const [bikeCapacityMin, setBikeCapacityMin] = useState(
    saved?.bikeCapacityMin ?? ""
  );
  const [memberCountMin, setMemberCountMin] = useState(
    saved?.memberCountMin ?? ""
  );

  const filters = useMemo<MatchFilters>(() => {
    return {
      keyword,
      categoryFilter,
      prefectureFilter,
      cityFilter,
      townFilter,
      groundFilter,
      strengthFilter,
      bikeFilter,
      bikeCapacityMin,
      memberCountMin,
    };
  }, [
    keyword,
    categoryFilter,
    prefectureFilter,
    cityFilter,
    townFilter,
    groundFilter,
    strengthFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: PersistedFilters = {
      keyword,
      categoryFilter,
      prefectureFilter,
      cityFilter,
      townFilter,
      groundFilter,
      strengthFilter,
      bikeFilter,
      bikeCapacityMin,
      memberCountMin,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // no-op
    }
  }, [
    keyword,
    categoryFilter,
    prefectureFilter,
    cityFilter,
    townFilter,
    groundFilter,
    strengthFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
  ]);

  const clearAllFilters = () => {
    setKeyword("");
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
    setGroundFilter("all");
    setStrengthFilter([]);
    setBikeFilter("all");
    setBikeCapacityMin("");
    setMemberCountMin("");

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  };

  return {
    keyword,
    categoryFilter,
    prefectureFilter,
    cityFilter,
    townFilter,
    groundFilter,
    strengthFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,

    setKeyword,
    setCategoryFilter,
    setPrefectureFilter,
    setCityFilter,
    setTownFilter,
    setGroundFilter,
    setStrengthFilter,
    setBikeFilter,
    setBikeCapacityMin,
    setMemberCountMin,

    filters,
    clearAllFilters,
  };
}