"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { categoryLabel } from "@/app/lib/categories";

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

type SavedFilters = {
  keyword: string;
  categoryFilter: string[];
  prefectureFilter: string;
  cityFilter: string;
  townFilter: string;
  groundFilter: "all" | "あり" | "なし";
  strengthFilter: string[];
  bikeFilter: "all" | "あり" | "なし" | "不明";
  bikeCapacityMin: string;
  memberCountMin: string;
};

const FILTER_STORAGE_KEY = "sakamatch:team-filters:v1";

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

function getDefaultFilters(): SavedFilters {
  return {
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
}

function readSavedFilters(): SavedFilters {
  if (typeof window === "undefined") {
    return getDefaultFilters();
  }

  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return getDefaultFilters();

    const parsed = JSON.parse(raw);

    return {
      keyword: String(parsed?.keyword ?? ""),
      categoryFilter: Array.isArray(parsed?.categoryFilter)
        ? parsed.categoryFilter.map(String)
        : [],
      prefectureFilter: String(parsed?.prefectureFilter ?? ""),
      cityFilter: String(parsed?.cityFilter ?? ""),
      townFilter: String(parsed?.townFilter ?? ""),
      groundFilter:
        parsed?.groundFilter === "あり" || parsed?.groundFilter === "なし"
          ? parsed.groundFilter
          : "all",
      strengthFilter: Array.isArray(parsed?.strengthFilter)
        ? parsed.strengthFilter.map(String)
        : [],
      bikeFilter:
        parsed?.bikeFilter === "あり" ||
        parsed?.bikeFilter === "なし" ||
        parsed?.bikeFilter === "不明"
          ? parsed.bikeFilter
          : "all",
      bikeCapacityMin: String(parsed?.bikeCapacityMin ?? ""),
      memberCountMin: String(parsed?.memberCountMin ?? ""),
    };
  } catch {
    return getDefaultFilters();
  }
}

function hasAnyFilter(filters: SavedFilters) {
  return (
    !!filters.keyword.trim() ||
    filters.categoryFilter.length > 0 ||
    !!filters.prefectureFilter ||
    !!filters.cityFilter ||
    !!filters.townFilter ||
    filters.groundFilter !== "all" ||
    filters.strengthFilter.length > 0 ||
    filters.bikeFilter !== "all" ||
    !!filters.bikeCapacityMin ||
    !!filters.memberCountMin
  );
}

function buildFilterSummary(filters: SavedFilters) {
  if (!hasAnyFilter(filters)) return "すべて";

  const parts: string[] = [];

  if (filters.keyword.trim()) parts.push("キーワード");
  if (filters.categoryFilter.length > 0) parts.push("カテゴリ");
  if (filters.prefectureFilter) parts.push("都道府県");
  if (filters.cityFilter) parts.push("市区町村");
  if (filters.townFilter) parts.push("町名");
  if (filters.groundFilter !== "all") parts.push("グラウンド");
  if (filters.strengthFilter.length > 0) parts.push("強さ");
  if (filters.bikeFilter !== "all") parts.push("駐輪場");
  if (filters.memberCountMin) parts.push("所属人数");
  if (filters.bikeCapacityMin) parts.push("駐輪台数");

  return parts.join(" / ");
}

export default function TeamsPage() {
  const { user, loading: authLoading } = useAuth();
  const myUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilters>(() =>
    readSavedFilters()
  );

  useEffect(() => {
    setSavedFilters(readSavedFilters());

    const onFocus = () => {
      setSavedFilters(readSavedFilters());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === FILTER_STORAGE_KEY) {
        setSavedFilters(readSavedFilters());
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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

      if (savedFilters.categoryFilter.length > 0) {
        const ok = categories.some((c) =>
          savedFilters.categoryFilter.includes(String(c).trim())
        );
        if (!ok) return false;
      }

      if (
        savedFilters.prefectureFilter &&
        norm(team.prefecture) !== savedFilters.prefectureFilter
      ) {
        return false;
      }

      if (
        savedFilters.cityFilter &&
        norm(team.city) !== savedFilters.cityFilter
      ) {
        return false;
      }

      if (
        savedFilters.townFilter &&
        norm(team.town) !== savedFilters.townFilter
      ) {
        return false;
      }

      if (savedFilters.groundFilter !== "all") {
        const ground = team.has_ground ? "あり" : "なし";
        if (ground !== savedFilters.groundFilter) return false;
      }

      if (savedFilters.strengthFilter.length > 0) {
        const rank = teamStrengthLabel(team);
        if (!savedFilters.strengthFilter.includes(rank)) return false;
      }

      if (savedFilters.bikeFilter !== "all") {
        const bike = (team.bike_parking ?? "不明") as
          | "あり"
          | "なし"
          | "不明";
        if (bike !== savedFilters.bikeFilter) return false;
      }

      if (savedFilters.memberCountMin) {
        const count = Number(team.member_count ?? 0);
        if (count < Number(savedFilters.memberCountMin)) return false;
      }

      if (savedFilters.bikeCapacityMin) {
        const cap = parseBikeCapacity(team.bike_parking_capacity);
        if (cap == null || cap < Number(savedFilters.bikeCapacityMin)) {
          return false;
        }
      }

      if (savedFilters.keyword.trim()) {
        const q = savedFilters.keyword.trim().toLowerCase();

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
  }, [teams, savedFilters]);

  const filterSummaryText = useMemo(() => {
    return buildFilterSummary(savedFilters);
  }, [savedFilters]);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />

      <AppHero
        icon="👥"
        title="チーム一覧"
        desc="サカまっちに登録している全チームを一覧表示します。条件変更はホームと同じ設定を使います。"
      />

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

      <section style={summaryBox}>
        <div style={summaryHead}>
          <div style={summaryTextWrap}>
            <div style={summaryTitle}>表示条件</div>
            <div style={summaryText}>条件：{filterSummaryText}</div>
            <div style={resultText}>
              {loading || authLoading
                ? "読み込み中…"
                : `${filteredTeams.length}チーム表示 / 全${teams.length}チーム`}
            </div>
          </div>

          <div style={summaryButtonRow}>
            <Link href="/teams/search" className="sh-btn sh-btn--primary">
              条件変更
            </Link>
          </div>
        </div>
      </section>

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

const summaryBox: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const summaryHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const summaryTextWrap: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const summaryTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const summaryText: React.CSSProperties = {
  fontSize: 14,
  color: "#3b6a49",
  lineHeight: 1.7,
};

const summaryButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginLeft: "auto",
};

const resultText: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#14532d",
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