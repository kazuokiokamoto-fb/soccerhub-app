"use client";

import { useEffect, useMemo, useState } from "react";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { MatchFilters } from "../utils/filters";

const STORAGE_KEY = "sakamatch:team-filters:v1";

type StoredFilters = {
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

const DEFAULT_FILTERS: StoredFilters = {
  keyword: "",
  categoryFilter: [],
  prefectureFilter: "",
  cityFilter: "",
  townFilter: "",
  groundFilter: "all",
  strengthFilter: [],
  bikeFilter: "all",
  bikeCapacityMin: "",
  memberCountMin: "",
};

function loadStoredFilters(): StoredFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;

    const parsed = JSON.parse(raw) as Partial<StoredFilters>;

    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      categoryFilter: Array.isArray(parsed.categoryFilter)
        ? parsed.categoryFilter
        : [],
      strengthFilter: Array.isArray(parsed.strengthFilter)
        ? (parsed.strengthFilter as StrengthRank[])
        : [],
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function useMatchFilters() {
  const initial = loadStoredFilters();

  const [keyword, setKeyword] = useState(initial.keyword);
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    initial.categoryFilter
  );
  const [prefectureFilter, setPrefectureFilter] = useState(
    initial.prefectureFilter
  );
  const [cityFilter, setCityFilter] = useState(initial.cityFilter);
  const [townFilter, setTownFilter] = useState(initial.townFilter);
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">(
    initial.groundFilter
  );
  const [strengthFilter, setStrengthFilter] = useState<StrengthRank[]>(
    initial.strengthFilter
  );
  const [bikeFilter, setBikeFilter] = useState<
    "all" | "あり" | "なし" | "不明"
  >(initial.bikeFilter);
  const [bikeCapacityMin, setBikeCapacityMin] = useState(
    initial.bikeCapacityMin
  );
  const [memberCountMin, setMemberCountMin] = useState(initial.memberCountMin);

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

    const payload: StoredFilters = {
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

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
      window.localStorage.removeItem(STORAGE_KEY);
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