"use client";

import { useMemo, useState } from "react";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { MatchFilters } from "../utils/filters";

export function useMatchFilters() {
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string[]>([]);
  const [draftPrefectureFilter, setDraftPrefectureFilter] = useState("");
  const [draftCityFilter, setDraftCityFilter] = useState("");
  const [draftTownFilter, setDraftTownFilter] = useState("");
  const [draftGroundFilter, setDraftGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [draftStrengthFilter, setDraftStrengthFilter] = useState<StrengthRank | "">("");
  const [draftBikeFilter, setDraftBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [draftBikeCapacityMin, setDraftBikeCapacityMin] = useState("");
  const [draftMemberCountMin, setDraftMemberCountMin] = useState("");

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [townFilter, setTownFilter] = useState("");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [strengthFilter, setStrengthFilter] = useState<StrengthRank | "">("");
  const [bikeFilter, setBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [bikeCapacityMin, setBikeCapacityMin] = useState("");
  const [memberCountMin, setMemberCountMin] = useState("");

  const appliedFilters = useMemo<MatchFilters>(() => {
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

  const draftFilters = useMemo<MatchFilters>(() => {
    return {
      keyword: draftKeyword,
      categoryFilter: draftCategoryFilter,
      prefectureFilter: draftPrefectureFilter,
      cityFilter: draftCityFilter,
      townFilter: draftTownFilter,
      groundFilter: draftGroundFilter,
      strengthFilter: draftStrengthFilter,
      bikeFilter: draftBikeFilter,
      bikeCapacityMin: draftBikeCapacityMin,
      memberCountMin: draftMemberCountMin,
    };
  }, [
    draftKeyword,
    draftCategoryFilter,
    draftPrefectureFilter,
    draftCityFilter,
    draftTownFilter,
    draftGroundFilter,
    draftStrengthFilter,
    draftBikeFilter,
    draftBikeCapacityMin,
    draftMemberCountMin,
  ]);

  const hasDraftChanges = useMemo(() => {
    return (
      draftKeyword !== keyword ||
      JSON.stringify(draftCategoryFilter) !== JSON.stringify(categoryFilter) ||
      draftPrefectureFilter !== prefectureFilter ||
      draftCityFilter !== cityFilter ||
      draftTownFilter !== townFilter ||
      draftGroundFilter !== groundFilter ||
      draftStrengthFilter !== strengthFilter ||
      draftBikeFilter !== bikeFilter ||
      draftBikeCapacityMin !== bikeCapacityMin ||
      draftMemberCountMin !== memberCountMin
    );
  }, [
    draftKeyword,
    keyword,
    draftCategoryFilter,
    categoryFilter,
    draftPrefectureFilter,
    prefectureFilter,
    draftCityFilter,
    cityFilter,
    draftTownFilter,
    townFilter,
    draftGroundFilter,
    groundFilter,
    draftStrengthFilter,
    strengthFilter,
    draftBikeFilter,
    bikeFilter,
    draftBikeCapacityMin,
    bikeCapacityMin,
    draftMemberCountMin,
    memberCountMin,
  ]);

  const applyDraftToApplied = () => {
    setKeyword(draftKeyword);
    setCategoryFilter(draftCategoryFilter);
    setPrefectureFilter(draftPrefectureFilter);
    setCityFilter(draftCityFilter);
    setTownFilter(draftTownFilter);
    setGroundFilter(draftGroundFilter);
    setStrengthFilter(draftStrengthFilter);
    setBikeFilter(draftBikeFilter);
    setBikeCapacityMin(draftBikeCapacityMin);
    setMemberCountMin(draftMemberCountMin);
  };

  const clearAllFilters = () => {
    setDraftKeyword("");
    setDraftCategoryFilter([]);
    setDraftPrefectureFilter("");
    setDraftCityFilter("");
    setDraftTownFilter("");
    setDraftGroundFilter("all");
    setDraftStrengthFilter("");
    setDraftBikeFilter("all");
    setDraftBikeCapacityMin("");
    setDraftMemberCountMin("");

    setKeyword("");
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
    setGroundFilter("all");
    setStrengthFilter("");
    setBikeFilter("all");
    setBikeCapacityMin("");
    setMemberCountMin("");
  };

  return {
    draftKeyword,
    setDraftKeyword,
    draftCategoryFilter,
    setDraftCategoryFilter,
    draftPrefectureFilter,
    setDraftPrefectureFilter,
    draftCityFilter,
    setDraftCityFilter,
    draftTownFilter,
    setDraftTownFilter,
    draftGroundFilter,
    setDraftGroundFilter,
    draftStrengthFilter,
    setDraftStrengthFilter,
    draftBikeFilter,
    setDraftBikeFilter,
    draftBikeCapacityMin,
    setDraftBikeCapacityMin,
    draftMemberCountMin,
    setDraftMemberCountMin,

    appliedFilters,
    draftFilters,
    hasDraftChanges,

    applyDraftToApplied,
    clearAllFilters,
  };
}