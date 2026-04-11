"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { categoryLabel } from "@/app/lib/categories";
import { MatchFilterPanel } from "@/app/match/components/MatchFilterPanel";
import { MatchHelpModals } from "@/app/match/components/MatchHelpModals";
import { STRENGTH_GUIDES } from "@/app/match/constants/strengthGuides";

import type { StrengthRank } from "@/app/components/StrengthRankPicker";

type PanelMode = "none" | "team";
type SectionMode = "home" | "teams";

type TeamSearchSectionProps = {
  loading: boolean;

  keyword: string;
  setKeyword: React.Dispatch<React.SetStateAction<string>>;

  categoryFilter: string[];
  setCategoryFilter: React.Dispatch<React.SetStateAction<string[]>>;

  prefectureFilter: string;
  setPrefectureFilter: React.Dispatch<React.SetStateAction<string>>;

  cityFilter: string;
  setCityFilter: React.Dispatch<React.SetStateAction<string>>;

  townFilter: string;
  setTownFilter: React.Dispatch<React.SetStateAction<string>>;

  groundFilter: "all" | "あり" | "なし";
  setGroundFilter: React.Dispatch<
    React.SetStateAction<"all" | "あり" | "なし">
  >;

  strengthFilter: StrengthRank[];
  setStrengthFilter: React.Dispatch<React.SetStateAction<StrengthRank[]>>;

  bikeFilter: "all" | "あり" | "なし" | "不明";
  setBikeFilter: React.Dispatch<
    React.SetStateAction<"all" | "あり" | "なし" | "不明">
  >;

  bikeCapacityMin: string;
  setBikeCapacityMin: React.Dispatch<React.SetStateAction<string>>;

  memberCountMin: string;
  setMemberCountMin: React.Dispatch<React.SetStateAction<string>>;

  filters: {
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

  clearAllFilters: () => void;

  filteredTeamsCount: number;
  filteredSlotsCount: number;

  onOpenTeamList?: () => void;
  onBackToCalendar?: () => void;

  initialPanelMode?: PanelMode;
  onPanelModeChange?: (mode: PanelMode) => void;
  onClosePanelAfterReset?: () => void;

  mode?: SectionMode;
};

function filterSummaryTextFromFilters(filters: {
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
}) {
  const parts: string[] = [];

  if (filters.keyword.trim()) {
    parts.push(filters.keyword.trim());
  }

  if (filters.categoryFilter.length > 0) {
    parts.push(
      filters.categoryFilter.map((v) => categoryLabel(v) || v).join(" / ")
    );
  }

  if (filters.prefectureFilter) {
    parts.push(filters.prefectureFilter);
  }

  if (filters.cityFilter) {
    parts.push(filters.cityFilter);
  }

  if (filters.townFilter) {
    parts.push(filters.townFilter);
  }

  if (filters.groundFilter !== "all") {
    parts.push(
      filters.groundFilter === "あり" ? "グラウンドあり" : "グラウンドなし"
    );
  }

  if (filters.strengthFilter.length > 0) {
    parts.push(`強さ ${filters.strengthFilter.join(" / ")}`);
  }

  if (filters.bikeFilter !== "all") {
    parts.push(`駐輪場 ${filters.bikeFilter}`);
  }

  if (filters.bikeCapacityMin) {
    parts.push(`${filters.bikeCapacityMin}台以上`);
  }

  if (filters.memberCountMin) {
    parts.push(`${filters.memberCountMin}人以上`);
  }

  return parts.join(" / ");
}

export default function TeamSearchSection({
  loading,
  keyword,
  setKeyword,
  categoryFilter,
  setCategoryFilter,
  prefectureFilter,
  setPrefectureFilter,
  cityFilter,
  setCityFilter,
  townFilter,
  setTownFilter,
  groundFilter,
  setGroundFilter,
  strengthFilter,
  setStrengthFilter,
  bikeFilter,
  setBikeFilter,
  bikeCapacityMin,
  setBikeCapacityMin,
  memberCountMin,
  setMemberCountMin,
  filters,
  clearAllFilters,
  filteredTeamsCount,
  filteredSlotsCount,
  onOpenTeamList,
  onBackToCalendar,
  initialPanelMode = "none",
  onPanelModeChange,
  onClosePanelAfterReset,
  mode = "home",
}: TeamSearchSectionProps) {
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);

  const filterRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (initialPanelMode !== "team") return;

    setPanelMode("team");

    const timer = setTimeout(() => {
      filterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [initialPanelMode]);

  useEffect(() => {
    onPanelModeChange?.(panelMode);
  }, [panelMode, onPanelModeChange]);

  const scrollToFilter = () => {
    setTimeout(() => {
      filterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const openTeamFilterPanel = () => {
    setPanelMode("team");
    scrollToFilter();
  };

  const closePanel = () => {
    setPanelMode("none");
  };

  const handleResetTeamFilters = () => {
    clearAllFilters();
    onClosePanelAfterReset?.();
  };

  const conditionText = useMemo(() => {
    const text = filterSummaryTextFromFilters(filters);
    return text || "すべて";
  }, [filters]);

  const isTeamsMode = mode === "teams";
  const isPanelOpen = panelMode === "team";

  return (
    <>
      {!isPanelOpen ? (
        <section style={summaryBox}>
          <div style={summaryTitle}>チーム条件で探す</div>

          <div style={summaryBar}>
            <div style={summaryLeft}>条件：{conditionText}</div>

            <div style={summaryButtonRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={openTeamFilterPanel}
              >
                条件変更
              </button>

              {!isTeamsMode ? (
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={onOpenTeamList ?? (() => {})}
                >
                  チーム一覧
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {isPanelOpen ? (
        <MatchFilterPanel
          filterRef={filterRef}
          loading={loading}
          keyword={keyword}
          setKeyword={setKeyword}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          prefectureFilter={prefectureFilter}
          setPrefectureFilter={setPrefectureFilter}
          cityFilter={cityFilter}
          setCityFilter={setCityFilter}
          townFilter={townFilter}
          setTownFilter={setTownFilter}
          groundFilter={groundFilter}
          setGroundFilter={setGroundFilter}
          strengthFilter={strengthFilter}
          setStrengthFilter={(value) =>
            setStrengthFilter(value as StrengthRank[])
          }
          bikeFilter={bikeFilter}
          setBikeFilter={setBikeFilter}
          bikeCapacityMin={bikeCapacityMin}
          setBikeCapacityMin={setBikeCapacityMin}
          memberCountMin={memberCountMin}
          setMemberCountMin={setMemberCountMin}
          onBackToCalendar={
            onBackToCalendar ??
            (() => {
              window.location.href = "/match";
            })
          }
          onOpenTeamList={
            onOpenTeamList ??
            (() => {
              window.location.href = "/teams";
            })
          }
          onReset={handleResetTeamFilters}
          onBackToList={closePanel}
          onOpenStrengthHelp={() => setShowStrengthHelp(true)}
          strengthGuides={STRENGTH_GUIDES}
          titleText="相手を探す"
          descriptionText="レベル・エリア・人数感などから相手チームを探せます。"
          liveCountLabel="現在のヒット件数"
          liveCountText={`${filteredTeamsCount}チーム`}
          hideFilterBadge={true}
          inlineHeaderActions={false}
          showTopActions={false}
          showTopHitBox={true}
          stickyHitBox={true}
          renderHeaderActionsInHitBox={true}
        />
      ) : null}

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={false}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => {}}
        strengthGuides={STRENGTH_GUIDES}
      />
    </>
  );
}

const summaryBox: React.CSSProperties = {
  marginTop: 0,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const summaryTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
  color: "#16391f",
  lineHeight: 1.3,
};

const summaryBar: React.CSSProperties = {
  marginTop: 14,
  padding: "14px 16px",
  borderRadius: 14,
  background: "#eef6f0",
  border: "1px solid #dce9df",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryLeft: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#2f5d3a",
  lineHeight: 1.7,
};

const summaryButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginLeft: "auto",
  justifyContent: "flex-end",
};