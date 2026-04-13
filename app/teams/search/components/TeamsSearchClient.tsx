"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";
import { MatchFilterPanel } from "@/app/match/components/MatchFilterPanel";

import { DbTeam, Toast, STRENGTH_GUIDES } from "./teamSearchUtils";

import {
  toastBox,
  toastSuccess,
  toastError,
  toastInfo,
  toastClose,
  modalOverlay,
  modalCard,
  modalHeader,
  modalTitle,
  modalCloseButton,
  guideList,
  guideCard,
  guideTop,
  guideRank,
  guideShort,
  guideTitleText,
  guideBulletList,
  guideBulletRow,
  guideBulletMark,
  guideNote,
} from "./teamSearchStyles";

function normalizeRank(level?: number | null, strengthRank?: string | null) {
  if (strengthRank && String(strengthRank).trim()) {
    return String(strengthRank).trim();
  }

  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

export default function TeamsSearchClient() {
  const searchParams = useSearchParams();

  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<DbTeam[]>([]);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [queryApplied, setQueryApplied] = useState(false);

  const {
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
  } = useMatchFilters();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (queryApplied) return;

    clearAllFilters();

    const keywordParam = searchParams.get("keyword") ?? "";
    const prefParam = searchParams.get("pref") ?? "";
    const cityParam = searchParams.get("city") ?? "";
    const townParam = searchParams.get("town") ?? "";
    const catParam = searchParams.get("cat") ?? "";
    const rankParam = searchParams.get("rank") ?? "";
    const groundParam = searchParams.get("ground") ?? "";
    const bikeParam = searchParams.get("bike") ?? "";
    const bikeMinParam = searchParams.get("bikeMin") ?? "";
    const memberMinParam = searchParams.get("memberMin") ?? "";

    setKeyword(keywordParam);
    setPrefectureFilter(prefParam);
    setCityFilter(cityParam);
    setTownFilter(townParam);

    setCategoryFilter(
      catParam
        ? catParam
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : []
    );

    setStrengthFilter(
      rankParam
        ? (rankParam
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean) as any)
        : []
    );

    setGroundFilter(
      groundParam === "あり" || groundParam === "なし" ? groundParam : "all"
    );

    setBikeFilter(
      bikeParam === "あり" || bikeParam === "なし" || bikeParam === "不明"
        ? bikeParam
        : "all"
    );

    setBikeCapacityMin(bikeMinParam);
    setMemberCountMin(memberMinParam);

    setQueryApplied(true);
  }, [
    queryApplied,
    searchParams,
    clearAllFilters,
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
  ]);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,area,prefecture,city,town,address_detail,category,categories,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,roster_by_grade,uniform_main,uniform_sub,desired_dates,note,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setTeams([]);
      setToast({
        type: "error",
        text: `読み込みに失敗しました: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    setTeams((data ?? []) as DbTeam[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const teamCategories =
        Array.isArray(team.categories) && team.categories.length > 0
          ? team.categories
          : team.category
            ? [team.category]
            : [];

      if (filters.keyword.trim()) {
        const q = filters.keyword.trim().toLowerCase();

        const hay = [
          team.name,
          team.area,
          team.prefecture,
          team.city,
          team.town,
          team.address_detail,
          team.category,
          ...teamCategories,
          team.uniform_main,
          team.uniform_sub,
          team.note,
          team.bike_parking,
          team.bike_parking_capacity,
          String(team.member_count ?? ""),
          String(team.strength_rank ?? ""),
          String(team.level ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      if (filters.prefectureFilter) {
        if (String(team.prefecture ?? "").trim() !== filters.prefectureFilter) {
          return false;
        }
      }

      if (filters.cityFilter) {
        if (String(team.city ?? "").trim() !== filters.cityFilter) {
          return false;
        }
      }

      if (filters.townFilter) {
        if (String(team.town ?? "").trim() !== filters.townFilter) {
          return false;
        }
      }

      if (filters.categoryFilter.length > 0) {
        const ok = teamCategories.some((c) =>
          filters.categoryFilter.includes(String(c).trim())
        );
        if (!ok) return false;
      }

      if (filters.strengthFilter.length > 0) {
        const rank = normalizeRank(team.level, team.strength_rank);
        if (!rank || !filters.strengthFilter.includes(rank as any)) {
          return false;
        }
      }

      if (filters.memberCountMin) {
        const count = Number(team.member_count ?? 0);
        if (count < Number(filters.memberCountMin)) return false;
      }

      if (filters.groundFilter !== "all") {
        const ground = team.has_ground ? "あり" : "なし";
        if (ground !== filters.groundFilter) return false;
      }

      if (filters.bikeFilter !== "all") {
        const bike = (team.bike_parking ?? "不明") as
          | "あり"
          | "なし"
          | "不明";
        if (bike !== filters.bikeFilter) return false;
      }

      if (filters.bikeCapacityMin) {
        const raw = String(team.bike_parking_capacity ?? "").trim();
        const cap = raw ? Number(raw.replace(/[^\d]/g, "")) : NaN;
        if (!Number.isFinite(cap) || cap < Number(filters.bikeCapacityMin)) {
          return false;
        }
      }

      return true;
    });
  }, [teams, filters]);

  const handleResetFilters = () => {
    clearAllFilters();
  };

  const openFilteredTeamsPage = () => {
    const params = new URLSearchParams();

    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (prefectureFilter) params.set("pref", prefectureFilter);
    if (cityFilter.trim()) params.set("city", cityFilter.trim());
    if (townFilter.trim()) params.set("town", townFilter.trim());

    if (categoryFilter.length > 0) {
      params.set("cat", categoryFilter.join(","));
    }

    if (strengthFilter.length > 0) {
      params.set("rank", strengthFilter.join(","));
    }

    if (memberCountMin) {
      params.set("memberMin", memberCountMin);
    }

    if (groundFilter !== "all") {
      params.set("ground", groundFilter);
    }

    if (bikeFilter !== "all") {
      params.set("bike", bikeFilter);
    }

    if (bikeCapacityMin) {
      params.set("bikeMin", bikeCapacityMin);
    }

    const qs = params.toString();
    window.location.href = qs ? `/teams?${qs}` : "/teams";
  };

  return (
    <main style={pageShell}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
                ? toastError
                : toastInfo),
            margin: "12px 16px 0",
            flexShrink: 0,
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      ) : null}

      <div style={topFixedArea}>
        <AppTabNav />

        <AppHero
          icon="🔎"
          title="条件検索"
          desc="ホームと同じ条件UIで、相手チームを絞り込めます。"
        />

        <section style={stickySummaryBox}>
          <div style={stickySummaryTopRow}>
            <div style={stickySummaryInline}>
              <span style={stickySummaryMini}>現在のヒット件数</span>
              <span style={stickySummaryValue}>{filteredTeams.length}件</span>
            </div>

            <div style={stickySummaryActions}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={openFilteredTeamsPage}
                disabled={loading}
              >
                チーム一覧
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={handleResetFilters}
                disabled={loading}
              >
                条件リセット
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={() => {
                  window.history.back();
                }}
                disabled={loading}
              >
                閉じる
              </button>
            </div>
          </div>
        </section>
      </div>

      <div style={filterScrollArea}>
        <MatchFilterPanel
          filterRef={undefined}
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
          setStrengthFilter={(value) => setStrengthFilter(value as any)}
          bikeFilter={bikeFilter}
          setBikeFilter={setBikeFilter}
          bikeCapacityMin={bikeCapacityMin}
          setBikeCapacityMin={setBikeCapacityMin}
          memberCountMin={memberCountMin}
          setMemberCountMin={setMemberCountMin}
          onBackToCalendar={() => {
            window.history.back();
          }}
          onOpenTeamList={openFilteredTeamsPage}
          onReset={handleResetFilters}
          onBackToList={() => {
            window.history.back();
          }}
          onOpenStrengthHelp={() => setShowStrengthHelp(true)}
          strengthGuides={STRENGTH_GUIDES}
          titleText="相手を探す"
          descriptionText="レベル・エリア・人数感などから相手チームを探せます。"
          liveCountLabel="現在のヒット件数"
          liveCountText={`${filteredTeams.length}件`}
          hideFilterBadge={true}
          inlineHeaderActions={false}
          showTopActions={false}
          showTopHitBox={false}
          renderHeaderActionsInHitBox={false}
          hidePanelHeader={true}
          hidePanelTitleBlock={true}
          compactTopHitBox={false}
        />
      </div>

      {showStrengthHelp ? (
        <div
          style={modalOverlay}
          onClick={() => setShowStrengthHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="強さの説明"
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>強さの説明</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={() => setShowStrengthHelp(false)}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              {STRENGTH_GUIDES.map((item) => (
                <div key={item.rank} style={guideCard}>
                  <div style={guideTop}>
                    <div style={guideRank}>{item.rank}</div>
                    <div style={guideShort}>{item.short}</div>
                  </div>

                  <div style={guideTitleText}>{item.title}</div>

                  <div style={guideBulletList}>
                    {item.bullets.map((bullet) => (
                      <div key={bullet} style={guideBulletRow}>
                        <span style={guideBulletMark}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <div style={guideNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const pageShell: React.CSSProperties = {
  height: "100dvh",
  minHeight: "100dvh",
  maxWidth: 980,
  margin: "0 auto",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const topFixedArea: React.CSSProperties = {
  flexShrink: 0,
  padding: "16px 16px 0",
  background: "#fff",
  borderBottom: "1px solid #edf2ee",
};

const stickySummaryBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "10px 14px",
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const stickySummaryTopRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const stickySummaryInline: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  minWidth: 0,
  flexWrap: "wrap",
};

const stickySummaryMini: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#3b6a49",
  lineHeight: 1.2,
};

const stickySummaryValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.1,
};

const stickySummaryActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginLeft: "auto",
  justifyContent: "flex-end",
};

const filterScrollArea: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  padding: "0 16px 16px",
};