"use client";

import { useMemo, useState } from "react";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { MatchFilters } from "../utils/filters";

export function useMatchFilters() {
  const [keyword, setKeyword] = useState("");

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [townFilter, setTownFilter] = useState("");

  const [groundFilter, setGroundFilter] =
    useState<"all" | "あり" | "なし">("all");

  const [strengthFilter, setStrengthFilter] = useState<StrengthRank[]>([]);

  const [bikeFilter, setBikeFilter] =
    useState<"all" | "あり" | "なし" | "不明">("all");

  const [bikeCapacityMin, setBikeCapacityMin] = useState("");
  const [memberCountMin, setMemberCountMin] = useState("");

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