"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { categoryLabel } from "@/app/lib/categories";
import TeamSearchSection from "@/app/match/components/TeamSearchSection";
import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  has_ground?: boolean | null;
  bike_parking?: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  note?: string | null;
};

function norm(v?: string | null) {
  return String(v ?? "").trim();
}

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function teamStrengthLabel(team: TeamRow) {
  if (team.strength_rank) return team.strength_rank;
  return levelToRank(team.level);
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function teamCategories(team: TeamRow) {
  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories;
  }
  if (team.category) {
    return [team.category];
  }
  return [];
}

function toTeamRows(value: unknown): TeamRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => row as TeamRow);
}

export default function TeamsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const myUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [panelMode, setPanelMode] = useState<"none" | "team">("none");

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
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("teams")
          .select(
            [
              "id",
              "owner_id",
              "name",
              "category",
              "categories",
              "level",
              "strength_rank",
              "area",
              "prefecture",
              "city",
              "town",
              "has_ground",
              "bike_parking",
              "bike_parking_capacity",
              "member_count",
              "uniform_main",
              "uniform_sub",
              "note",
            ].join(",")
          )
          .order("updated_at", { ascending: false });

        if (error) throw error;
        if (!active) return;

        setTeams(toTeamRows(data));
      } catch (e: any) {
        console.error("[teams page] load error:", e);
        if (!active) return;

        setTeams([]);
        setLoadError(e?.message ?? "チーム一覧の取得に失敗しました");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const categories = teamCategories(team);

      if (filters.categoryFilter.length > 0) {
        const ok = categories.some((c) =>
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
        const rank = teamStrengthLabel(team);
        if (!filters.strengthFilter.includes(rank as any)) return false;
      }

      if (filters.bikeFilter !== "all") {
        const bike = (team.bike_parking ?? "不明") as
          | "あり"
          | "なし"
          | "不明";
        if (bike !== filters.bikeFilter) return false;
      }

      if (filters.memberCountMin) {
        const count = Number(team.member_count ?? 0);
        if (count < Number(filters.memberCountMin)) return false;
      }

      if (filters.bikeCapacityMin) {
        const cap = parseBikeCapacity(team.bike_parking_capacity);
        if (cap == null || cap < Number(filters.bikeCapacityMin)) {
          return false;
        }
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
          ...categories,
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
    });
  }, [teams, filters]);

  const isPanelOpen = panelMode === "team";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />

      {!isPanelOpen ? (
        <AppHero
          icon="👥"
          title="チーム一覧"
          desc="サカまっちに登録している全チームを一覧表示します。条件検索はホームと同じUIです。"
        />
      ) : null}

      {loadError ? (
        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{loadError}</div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      <TeamSearchSection
        mode="teams"
        loading={loading || authLoading}
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
        setStrengthFilter={setStrengthFilter}
        bikeFilter={bikeFilter}
        setBikeFilter={setBikeFilter}
        bikeCapacityMin={bikeCapacityMin}
        setBikeCapacityMin={setBikeCapacityMin}
        memberCountMin={memberCountMin}
        setMemberCountMin={setMemberCountMin}
        filters={filters}
        clearAllFilters={clearAllFilters}
        filteredTeamsCount={filteredTeams.length}
        filteredSlotsCount={0}
        onOpenTeamList={() => router.push("/teams")}
        onBackToCalendar={() => router.push("/match")}
        initialPanelMode="none"
        onPanelModeChange={setPanelMode}
      />

      {loading || authLoading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : filteredTeams.length === 0 ? (
        <div style={emptyBox}>
          条件に一致するチームがありません。
          <br />
          条件をゆるめて再度お試しください。
        </div>
      ) : (
        <section style={listWrap}>
          {filteredTeams.map((team) => {
            const mine = !!myUserId && team.owner_id === myUserId;
            const categories = teamCategories(team);

            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                style={teamCardLink}
              >
                <div style={teamCard}>
                  <div style={teamCardHead}>
                    <div style={teamNameWrap}>
                      <div style={teamName}>{team.name || "チーム名未設定"}</div>
                      {mine ? <span style={mineBadge}>自分のチーム</span> : null}
                    </div>

                    <div style={rankBadge}>
                      強さ {teamStrengthLabel(team) || "未設定"}
                    </div>
                  </div>

                  <div style={teamMeta}>
                    <div>
                      <strong>カテゴリ：</strong>
                      {categories.length > 0
                        ? categories.map((v) => categoryLabel(v) || v).join(" / ")
                        : "未設定"}
                    </div>

                    <div>
                      <strong>エリア：</strong>
                      {[team.prefecture, team.city, team.town]
                        .filter(Boolean)
                        .join("・") || team.area || "未設定"}
                    </div>

                    <div>
                      <strong>グラウンド：</strong>
                      {team.has_ground ? "あり" : "なし"}
                    </div>

                    <div>
                      <strong>駐輪場：</strong>
                      {team.bike_parking || "不明"}
                      {team.bike_parking_capacity
                        ? ` / ${team.bike_parking_capacity}`
                        : ""}
                    </div>

                    <div>
                      <strong>所属人数：</strong>
                      {team.member_count ?? "未設定"}
                    </div>

                    {(team.uniform_main || team.uniform_sub) && (
                      <div>
                        <strong>ユニフォーム：</strong>
                        {[team.uniform_main, team.uniform_sub]
                          .filter(Boolean)
                          .join(" / ")}
                      </div>
                    )}

                    {team.note ? (
                      <div>
                        <strong>メモ：</strong>
                        {team.note}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}

const errorBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const listWrap: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
};

const teamCardLink: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

const teamCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const teamCardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const teamNameWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const mineBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const rankBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid #dce9df",
};

const teamMeta: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 8,
  color: "#374151",
  lineHeight: 1.7,
  fontSize: 14,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
  textAlign: "center",
};