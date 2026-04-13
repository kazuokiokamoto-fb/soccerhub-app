"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { categoryLabel } from "@/app/lib/categories";
import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";
import { MatchFilterPanel } from "@/app/match/components/MatchFilterPanel";

import {
  DbTeam,
  Toast,
  STRENGTH_GUIDES,
} from "./teamSearchUtils";

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

export default function TeamsSearchClient() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<DbTeam[]>([]);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);

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

      if (filters.categoryFilter.length > 0) {
        const ok = teamCategories.some((c) =>
          filters.categoryFilter.includes(String(c).trim())
        );
        if (!ok) return false;
      }

      if (
        filters.prefectureFilter &&
        String(team.prefecture ?? "").trim() !== filters.prefectureFilter
      ) {
        return false;
      }

      if (
        filters.cityFilter &&
        String(team.city ?? "").trim() !== filters.cityFilter
      ) {
        return false;
      }

      if (
        filters.townFilter &&
        String(team.town ?? "").trim() !== filters.townFilter
      ) {
        return false;
      }

      if (filters.groundFilter !== "all") {
        const ground = team.has_ground ? "あり" : "なし";
        if (ground !== filters.groundFilter) return false;
      }

      if (filters.strengthFilter.length > 0) {
        const rank =
          (team.strength_rank?.trim() as any) ||
          (() => {
            const n = Number(team.level ?? 0);
            if (!Number.isFinite(n)) return "";
            if (n >= 9) return "SS";
            if (n >= 7) return "S";
            if (n >= 5) return "A";
            if (n >= 3) return "B";
            return "C";
          })();

        if (!rank || !filters.strengthFilter.includes(rank)) return false;
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

      if (filters.memberCountMin) {
        const count = Number(team.member_count ?? 0);
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

      return true;
    });
  }, [teams, filters]);

  const handleResetFilters = () => {
    clearAllFilters();
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

        <section style={summaryOuter}>
          <div style={summaryTitle}>チーム条件で探す</div>

          <div style={summaryInner}>
            <div style={summaryCountLabel}>現在のヒット件数</div>
            <div style={summaryCountValue}>{filteredTeams.length}件</div>
            <div style={summarySubText}>
              条件を変えるたびに、この件数がリアルタイムで変わります。
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
          onOpenTeamList={() => {
            window.location.href = "/teams";
          }}
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
          hidePanelHeader={false}
          hidePanelTitleBlock={false}
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

const summaryOuter: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#fff",
};

const summaryTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
  color: "#16391f",
  lineHeight: 1.3,
};

const summaryInner: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const summaryCountLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#3b6a49",
  lineHeight: 1.6,
};

const summaryCountValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 28,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.2,
};

const summarySubText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#5f6f66",
  lineHeight: 1.7,
};

const filterScrollArea: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  padding: "0 16px 16px",
};