// /app/teams/search/components/TeamsSearchClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
} from "@/app/match/utils/date";

import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";

import { CATEGORY_OPTIONS, categoryLabel } from "@/app/lib/categories";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

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
  desired_dates?: string[] | null;
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

function compareTeamsForList(a: TeamRow, b: TeamRow, myUserId: string) {
  const aMine = !!myUserId && a.owner_id === myUserId;
  const bMine = !!myUserId && b.owner_id === myUserId;

  if (aMine !== bMine) {
    return aMine ? 1 : -1;
  }

  const aName = String(a.name ?? "").trim();
  const bName = String(b.name ?? "").trim();

  const byName = aName.localeCompare(bName, "ja");

  if (byName !== 0) return byName;

  return String(a.id).localeCompare(String(b.id), "ja");
}

function normalizeSearchText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .replace(/年/g, "/")
    .replace(/月/g, "/")
    .replace(/日/g, "")
    .replace(/-/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function dateSearchVariants(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return [];

  const normalized = normalizeSearchText(text);

  const m = normalized.match(/(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})/);
  if (!m) return [normalized];

  const y = m[1];
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!month || !day) return [normalized];

  return [
    normalized,
    `${month}/${day}`,
    `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`,
    `${month}月${day}日`,
    `${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`,
    y ? `${y}/${month}/${day}` : "",
    y ? `${y}年${month}月${day}日` : "",
  ].filter(Boolean);
}

function categorySearchVariants(value?: string | null) {
  const raw = String(value ?? "").trim();
  const label = categoryLabel(raw) || raw;
  const text = normalizeSearchText(raw);
  const labelText = normalizeSearchText(label);

  const variants = new Set<string>([raw, label, text, labelText]);

  const gradeMatch = `${raw} ${label}`.match(/小\s*([1-6])|小学\s*([1-6])|([1-6])年/);
  const grade = gradeMatch?.[1] || gradeMatch?.[2] || gradeMatch?.[3];

  if (grade) {
    variants.add(`小${grade}`);
    variants.add(`小学${grade}年`);
    variants.add(`${grade}年`);
    variants.add(`${grade}年生`);

    const u = 6 + Number(grade);
    variants.add(`u-${u}`);
    variants.add(`u${u}`);
    variants.add(`U-${u}`);
    variants.add(`U${u}`);
  }

  const uMatch = text.match(/u-?(\d{1,2})/);
  if (uMatch) {
    const u = Number(uMatch[1]);
    variants.add(`u-${u}`);
    variants.add(`u${u}`);
    variants.add(`U-${u}`);
    variants.add(`U${u}`);

    const gradeNo = u - 6;
    if (gradeNo >= 1 && gradeNo <= 6) {
      variants.add(`小${gradeNo}`);
      variants.add(`小学${gradeNo}年`);
      variants.add(`${gradeNo}年`);
      variants.add(`${gradeNo}年生`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

export default function TeamsSearchClient() {
  const { user, loading: authLoading } = useAuth();

  const myUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);

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

  const [showCalendar, setShowCalendar] = useState(true);

  const [monthDate, setMonthDate] = useState(() =>
    startOfMonth(new Date())
  );

  const [selectedDate, setSelectedDate] = useState("");

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
              "desired_dates",
            ].join(",")
          )
          .order("updated_at", { ascending: false });

        if (error) throw error;

        if (!active) return;

        setTeams(toTeamRows(data));
      } catch (e: any) {
        console.error("[teams search] load error:", e);

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

  const calendarCells = useMemo(
    () => buildCalendarCells(monthDate),
    [monthDate]
  );

  const monthKey = useMemo(
    () => toMonthKey(monthDate),
    [monthDate]
  );

  const filteredTeams = useMemo(() => {
    const matched = teams.filter((team) => {
      if (myUserId && team.owner_id === myUserId) {
        return false;
      }

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

      if (
        filters.cityFilter &&
        norm(team.city) !== filters.cityFilter
      ) {
        return false;
      }

      if (filters.strengthFilter.length > 0) {
        const rank = teamStrengthLabel(team);

        if (!filters.strengthFilter.includes(rank as any)) {
          return false;
        }
      }

      if (filters.memberCountMin) {
        const count = Number(team.member_count ?? 0);

        if (count < Number(filters.memberCountMin)) {
          return false;
        }
      }

      if (filters.groundFilter !== "all") {
        const ground = team.has_ground ? "あり" : "なし";

        if (ground !== filters.groundFilter) {
          return false;
        }
      }

      if (filters.bikeFilter !== "all") {
        const bike = (team.bike_parking ?? "不明") as
          | "あり"
          | "なし"
          | "不明";

        if (bike !== filters.bikeFilter) {
          return false;
        }
      }

      if (filters.bikeCapacityMin) {
        const cap = parseBikeCapacity(team.bike_parking_capacity);

        if (cap == null || cap < Number(filters.bikeCapacityMin)) {
          return false;
        }
      }

      if (selectedDate) {
        const dates = Array.isArray(team.desired_dates)
          ? team.desired_dates
          : [];

        const hasDate = dates.some((v) =>
          String(v).includes(selectedDate)
        );

        if (!hasDate) return false;
      }

      if (filters.keyword.trim()) {
        const q = normalizeSearchText(filters.keyword.trim());

        const desiredDates = Array.isArray((team as any).desired_dates)
          ? (team as any).desired_dates
          : [];

        const categoryWords = categories.flatMap((v) => categorySearchVariants(v));
        const dateWords = desiredDates.flatMap((v: string) => dateSearchVariants(v));

        const hay = [
          team.name,
          team.area,
          team.prefecture,
          team.city,
          team.town,
          team.category,
          ...categories,
          ...categoryWords,
          ...dateWords,
          team.uniform_main,
          team.uniform_sub,
          team.note,
          team.bike_parking,
          team.bike_parking_capacity,
          String(team.member_count ?? ""),
          String(team.strength_rank ?? ""),
          levelToRank(team.level),
        ]
          .map((v) => normalizeSearchText(String(v ?? "")))
          .join(" ");

        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return [...matched].sort((a, b) =>
      compareTeamsForList(a, b, myUserId)
    );
  }, [teams, filters, myUserId, selectedDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    const countMap = new Map<string, number>();

    for (const team of teams) {
      const dates = Array.isArray(team.desired_dates)
        ? team.desired_dates
        : [];

      for (const raw of dates) {
        const ymd = String(raw).slice(0, 10);

        if (!ymd) continue;

        countMap.set(ymd, (countMap.get(ymd) ?? 0) + 1);
      }
    }

    for (const [ymd, count] of countMap.entries()) {
      map.set(ymd, [
        {
          label: "募",
          count,
          tone: "open",
        },
      ]);
    }

    return map;
  }, [teams]);

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];

    if (filters.keyword.trim()) {
      parts.push(`キーワード: ${filters.keyword.trim()}`);
    }

    if (filters.prefectureFilter) {
      parts.push(`都道府県: ${filters.prefectureFilter}`);
    }

    if (filters.cityFilter) {
      parts.push(`市区町村: ${filters.cityFilter}`);
    }

    if (filters.categoryFilter.length > 0) {
      parts.push(
        `カテゴリ: ${filters.categoryFilter
          .map((v) => categoryLabel(v) || v)
          .join(" / ")}`
      );
    }

    if (filters.strengthFilter.length > 0) {
      parts.push(`強さ: ${filters.strengthFilter.join(" / ")}`);
    }

    if (filters.memberCountMin) {
      parts.push(`人数: ${filters.memberCountMin}人以上`);
    }

    if (filters.groundFilter !== "all") {
      parts.push(`グラウンド: ${filters.groundFilter}`);
    }

    if (filters.bikeFilter !== "all") {
      parts.push(`駐輪場: ${filters.bikeFilter}`);
    }

    if (filters.bikeCapacityMin) {
      parts.push(`駐輪台数: ${filters.bikeCapacityMin}台以上`);
    }

    if (selectedDate) {
      parts.push(`日付: ${selectedDate}`);
    }

    return parts.join(" / ") || "すべての条件で表示中";
  }, [filters, selectedDate]);

  return (
    <main style={wrap}>
      <div style={topBar}>
        <Link href="/" className="sh-btn">
          ← ホーム
        </Link>

        <div style={pageTitle}>練習試合を探す</div>
      </div>

      <section className="ui-card" style={searchBox}>
        <div style={searchHeader}>
          <div className="ui-title" style={searchTitle}>
            条件検索
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => setShowCalendar((v) => !v)}
          >
            {showCalendar ? "カレンダーを閉じる" : "カレンダー表示"}
          </button>
        </div>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="チーム名・地域・カテゴリなど"
          style={input}
        />

        <div style={filterGrid}>

          <select
            value={prefectureFilter}
            onChange={(e) => {
              setPrefectureFilter(e.target.value);
              setCityFilter("");
            }}
            style={select}
          >
            <option value="">都道府県すべて</option>

            <option value="東京都">東京都</option>
            <option value="神奈川県">神奈川県</option>
            <option value="千葉県">千葉県</option>
            <option value="埼玉県">埼玉県</option>
            <option value="茨城県">茨城県</option>
            <option value="栃木県">栃木県</option>
            <option value="群馬県">群馬県</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={select}
          >
            <option value="">市区町村すべて</option>

            {Array.from(
              new Set(
                teams
                  .filter(
                    (t) =>
                      !prefectureFilter ||
                      t.prefecture === prefectureFilter
                  )
                  .map((t) => t.city)
                  .filter(Boolean)
              )
            )
              .sort((a, b) => String(a).localeCompare(String(b), "ja"))
              .map((city) => (
                <option key={city} value={city ?? ""}>
                  {city}
                </option>
              ))}
          </select>

          <select
            value={categoryFilter[0] ?? ""}
            onChange={(e) =>
              setCategoryFilter(
                e.target.value ? [e.target.value] : []
              )
            }
            style={select}
          >
            <option value="">カテゴリすべて</option>

            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={strengthFilter[0] ?? ""}
            onChange={(e) =>
              setStrengthFilter(
                e.target.value ? [e.target.value as any] : []
              )
            }
            style={select}
          >
            <option value="">強さすべて</option>
            <option value="SS">SS</option>
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>

          <select
            value={groundFilter}
            onChange={(e) =>
              setGroundFilter(
                e.target.value as "all" | "あり" | "なし"
              )
            }
            style={select}
          >
            <option value="all">グラウンドすべて</option>
            <option value="あり">あり</option>
            <option value="なし">なし</option>
          </select>

        </div>

        <div style={filterFooter}>
          <div className="ui-meta">
            表示件数：{filteredTeams.length}件
            <br />
            {filterSummaryText}
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => {
              clearAllFilters();
              setSelectedDate("");
            }}
          >
            条件クリア
          </button>
        </div>
      </section>

      {showCalendar ? (
        <section className="ui-card" style={calendarBox}>
          <div style={calendarTitle}>開催日カレンダー</div>

          <div style={calendarHint} className="ui-meta">
            日付を押すと、その日に募集しているチームだけを表示します。
          </div>

          <MatchCalendarBase
            monthKey={monthKey}
            cells={calendarCells}
            selectedYmd={selectedDate}
            itemsByDate={itemsByDate}
            onSelectDate={(ymd) => {
              setSelectedDate((current) =>
                current === ymd ? "" : ymd
              );
            }}
            onPrevMonth={() =>
              setMonthDate((prev) => addMonths(prev, -1))
            }
            onNextMonth={() =>
              setMonthDate((prev) => addMonths(prev, 1))
            }
          />
        </section>
      ) : null}

      {loadError ? (
        <div className="ui-card" style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{loadError}</div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div className="ui-card" style={emptyBox}>
          読み込み中…
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="ui-card" style={emptyBox}>
          条件に一致するチームがありません
        </div>
      ) : (
        <section style={listWrap}>
          {filteredTeams.map((team) => {

            const categories = teamCategories(team);

            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                style={teamCardLink}
              >
                <article className="ui-card" style={teamCard}>
                  <div style={teamCardHead}>
                    <div style={teamNameWrap}>
                      <div style={teamName}>
                        {team.name || "チーム名未設定"}
                      </div>
                    </div>

                    <div style={rankBadge}>
                      強さ{" "}
                      {teamStrengthLabel(team) || "未設定"}
                    </div>
                  </div>

                  <div style={tagWrap}>
                    {categories.map((cat) => (
                      <span key={cat} style={tag}>
                        {categoryLabel(cat) || cat}
                      </span>
                    ))}
                  </div>

                  <div style={teamMeta}>
                    <div>
                      <strong>エリア：</strong>

                      {[team.prefecture, team.city, team.town]
                        .filter(Boolean)
                        .join("・") ||
                        team.area ||
                        "未設定"}
                    </div>

                    <div>
                      <strong>人数：</strong>
                      {team.member_count ?? "未設定"}
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

                    {(team.uniform_main ||
                      team.uniform_sub) && (
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
                </article>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const pageTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const searchBox: React.CSSProperties = {
  padding: 14,
};

const searchHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const searchTitle: React.CSSProperties = {
  fontSize: 18,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  outline: "none",
  background: "#fff",
};

const inputMini: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
};

const filterGrid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
};

const select: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
};

const filterFooter: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const calendarBox: React.CSSProperties = {
  padding: 14,
};

const calendarTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const calendarHint: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 10,
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const teamCardLink: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const teamCard: React.CSSProperties = {
  padding: 14,
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

const tagWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const errorBox: React.CSSProperties = {
  padding: 14,
  color: "#991b1b",
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  padding: 22,
  textAlign: "center",
};