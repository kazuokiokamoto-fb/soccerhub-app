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
  const { user, loading: authLoading } = useAuth();
  const myUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [townFilter, setTownFilter] = useState("");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">(
    "all"
  );
  const [strengthFilter, setStrengthFilter] = useState("");
  const [bikeFilter, setBikeFilter] = useState<
    "all" | "あり" | "なし" | "不明"
  >("all");
  const [memberCountMin, setMemberCountMin] = useState("");
  const [bikeCapacityMin, setBikeCapacityMin] = useState("");

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

        if (error) {
          throw error;
        }

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

  const prefectureOptions = useMemo(() => {
    return Array.from(
      new Set(teams.map((t) => norm(t.prefecture)).filter(Boolean))
    ).sort();
  }, [teams]);

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(
        teams
          .filter((t) =>
            prefectureFilter ? norm(t.prefecture) === prefectureFilter : true
          )
          .map((t) => norm(t.city))
          .filter(Boolean)
      )
    ).sort();
  }, [teams, prefectureFilter]);

  const townOptions = useMemo(() => {
    return Array.from(
      new Set(
        teams
          .filter((t) =>
            prefectureFilter ? norm(t.prefecture) === prefectureFilter : true
          )
          .filter((t) => (cityFilter ? norm(t.city) === cityFilter : true))
          .map((t) => norm(t.town))
          .filter(Boolean)
      )
    ).sort();
  }, [teams, prefectureFilter, cityFilter]);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const categories = teamCategories(team);

      if (categoryFilter) {
        const ok = categories.some((c) => String(c).trim() === categoryFilter);
        if (!ok) return false;
      }

      if (prefectureFilter && norm(team.prefecture) !== prefectureFilter) {
        return false;
      }

      if (cityFilter && norm(team.city) !== cityFilter) {
        return false;
      }

      if (townFilter && norm(team.town) !== townFilter) {
        return false;
      }

      if (groundFilter !== "all") {
        const ground = team.has_ground ? "あり" : "なし";
        if (ground !== groundFilter) return false;
      }

      if (strengthFilter) {
        const rank = teamStrengthLabel(team);
        if (rank !== strengthFilter) return false;
      }

      if (bikeFilter !== "all") {
        const bike = (team.bike_parking ?? "不明") as "あり" | "なし" | "不明";
        if (bike !== bikeFilter) return false;
      }

      if (memberCountMin) {
        const count = Number(team.member_count ?? 0);
        if (count < Number(memberCountMin)) return false;
      }

      if (bikeCapacityMin) {
        const cap = parseBikeCapacity(team.bike_parking_capacity);
        if (cap == null || cap < Number(bikeCapacityMin)) return false;
      }

      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();

        const hay = [
          team.name,
          team.area,
          team.prefecture,
          team.city,
          team.town,
          team.category,
          ...(categories ?? []),
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
  }, [
    teams,
    keyword,
    categoryFilter,
    prefectureFilter,
    cityFilter,
    townFilter,
    groundFilter,
    strengthFilter,
    bikeFilter,
    memberCountMin,
    bikeCapacityMin,
  ]);

  const clearFilters = () => {
    setKeyword("");
    setCategoryFilter("");
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
    setGroundFilter("all");
    setStrengthFilter("");
    setBikeFilter("all");
    setMemberCountMin("");
    setBikeCapacityMin("");
  };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />

      <AppHero
        icon="👥"
        title="チーム一覧"
        desc="サカまっちに登録している全チームを一覧表示し、条件で絞り込めます。"
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

      <section style={filterBox}>
        <div style={filterTitle}>条件で絞り込む</div>

        <div style={filterGrid}>
          <div style={fieldWrap}>
            <label style={label}>キーワード</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="チーム名・地域・メモなど"
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>カテゴリ</label>
            <input
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="例: G5"
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>都道府県</label>
            <select
              value={prefectureFilter}
              onChange={(e) => {
                setPrefectureFilter(e.target.value);
                setCityFilter("");
                setTownFilter("");
              }}
              style={input}
            >
              <option value="">すべて</option>
              {prefectureOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>市区町村</label>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setTownFilter("");
              }}
              style={input}
            >
              <option value="">すべて</option>
              {cityOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>町名</label>
            <select
              value={townFilter}
              onChange={(e) => setTownFilter(e.target.value)}
              style={input}
            >
              <option value="">すべて</option>
              {townOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>グラウンド</label>
            <select
              value={groundFilter}
              onChange={(e) =>
                setGroundFilter(e.target.value as "all" | "あり" | "なし")
              }
              style={input}
            >
              <option value="all">すべて</option>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>強さ</label>
            <select
              value={strengthFilter}
              onChange={(e) => setStrengthFilter(e.target.value)}
              style={input}
            >
              <option value="">すべて</option>
              <option value="SS">SS</option>
              <option value="S">S</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>駐輪場</label>
            <select
              value={bikeFilter}
              onChange={(e) =>
                setBikeFilter(
                  e.target.value as "all" | "あり" | "なし" | "不明"
                )
              }
              style={input}
            >
              <option value="all">すべて</option>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>所属人数（以上）</label>
            <input
              value={memberCountMin}
              onChange={(e) => setMemberCountMin(e.target.value)}
              inputMode="numeric"
              placeholder="例: 15"
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>駐輪台数（以上）</label>
            <input
              value={bikeCapacityMin}
              onChange={(e) => setBikeCapacityMin(e.target.value)}
              inputMode="numeric"
              placeholder="例: 20"
              style={input}
            />
          </div>
        </div>

        <div style={filterBottomRow}>
          <div style={resultText}>
            {loading || authLoading
              ? "読み込み中…"
              : `${filteredTeams.length}チーム表示 / 全${teams.length}チーム`}
          </div>

          <button type="button" className="sh-btn" onClick={clearFilters}>
            条件クリア
          </button>
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

const filterBox: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const filterTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  marginBottom: 12,
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const fieldWrap: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3b6a49",
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6e3d9",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const filterBottomRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
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