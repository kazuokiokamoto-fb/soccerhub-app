"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";

type Toast = { type: "success" | "error" | "info"; text: string };

type Option = {
  value: string;
  label: string;
};

type DbTeam = {
  id: string;
  owner_id: string | null;
  name: string | null;

  area: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  address_detail?: string | null;

  category: string | null;
  categories: string[] | null;

  level: number | null;
  strength_rank?: string | null;

  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;

  member_count?: number | null;
  roster_by_grade?: Record<string, number> | null;

  uniform_main: string | null;
  uniform_sub: string | null;

  desired_dates?: string[] | null;
  note: string | null;

  updated_at: string;
};

const KANTO_PREFECTURES: Option[] = [
  { value: "東京都", label: "東京都" },
  { value: "神奈川県", label: "神奈川県" },
  { value: "千葉県", label: "千葉県" },
  { value: "埼玉県", label: "埼玉県" },
  { value: "茨城県", label: "茨城県" },
  { value: "栃木県", label: "栃木県" },
  { value: "群馬県", label: "群馬県" },
];

const STRENGTH_OPTIONS: Option[] = [
  { value: "SS", label: "SS" },
  { value: "S", label: "S" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

function normalizeOptions(
  options: Array<string | { value: string; label: string }>
): Option[] {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

function levelLabel(level: number): StrengthRank {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function norm(v?: string | null) {
  return (v ?? "").trim();
}

function buildAreaText(team: DbTeam) {
  const direct = norm(team.area);
  if (direct) return direct;

  const composed = `${team.prefecture ?? ""} ${team.city ?? ""}${
    team.town ? "・" + team.town : ""
  }`.trim();

  return composed || "（エリア未設定）";
}

function getStrength(team: DbTeam): StrengthRank {
  return (
    (team.strength_rank as StrengthRank | null) ||
    levelLabel(Number(team.level ?? 0))
  ) as StrengthRank;
}

function getMemberCount(team: DbTeam) {
  if (typeof team.member_count === "number") return team.member_count;

  const roster = (team.roster_by_grade ?? {}) as Record<string, number>;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v === "50+") return 50;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatBikeParking(team: DbTeam) {
  if (team.bike_parking === "あり") {
    if (team.bike_parking_capacity) {
      if (team.bike_parking_capacity === "50+") return "あり（50台以上）";
      return `あり（${team.bike_parking_capacity}台）`;
    }
    return "あり";
  }
  return team.bike_parking ?? "不明";
}

function formatDesiredDates(arr?: string[] | null) {
  const values = Array.isArray(arr) ? arr.filter(Boolean) : [];
  if (values.length === 0) return "未登録";
  return values.join(" / ");
}

export default function TeamsSearchClient() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<DbTeam[]>([]);

  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string[]>([]);
  const [draftPrefectureFilter, setDraftPrefectureFilter] = useState<string[]>([]);
  const [draftCityFilter, setDraftCityFilter] = useState<string[]>([]);
  const [draftStrengthFilter, setDraftStrengthFilter] = useState<StrengthRank[]>([]);
  const [draftGroundFilter, setDraftGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [draftBikeFilter, setDraftBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [draftBikeCapacityMin, setDraftBikeCapacityMin] = useState("");
  const [draftMemberCountMin, setDraftMemberCountMin] = useState("");
  const [draftHasNoteOnly, setDraftHasNoteOnly] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [strengthFilter, setStrengthFilter] = useState<StrengthRank[]>([]);
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [bikeFilter, setBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [bikeCapacityMin, setBikeCapacityMin] = useState("");
  const [memberCountMin, setMemberCountMin] = useState("");
  const [hasNoteOnly, setHasNoteOnly] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const categoryOptions = useMemo(() => {
    return normalizeOptions(
      CATEGORY_OPTIONS as Array<string | { value: string; label: string }>
    );
  }, []);

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
      setToast({ type: "error", text: `読み込みに失敗しました: ${error.message}` });
      setLoading(false);
      return;
    }

    setTeams((data ?? []) as DbTeam[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const prefectureOptions = useMemo(() => {
    return KANTO_PREFECTURES;
  }, []);

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(
        teams
          .filter((t) => {
            if (draftPrefectureFilter.length === 0) return true;
            return draftPrefectureFilter.includes(norm(t.prefecture));
          })
          .map((t) => norm(t.city))
          .filter(Boolean)
      )
    )
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map((v) => ({ value: v, label: v }));
  }, [teams, draftPrefectureFilter]);

  const applyFilters = () => {
    setKeyword(draftKeyword);
    setCategoryFilter([...draftCategoryFilter]);
    setPrefectureFilter([...draftPrefectureFilter]);
    setCityFilter([...draftCityFilter]);
    setStrengthFilter([...draftStrengthFilter]);
    setGroundFilter(draftGroundFilter);
    setBikeFilter(draftBikeFilter);
    setBikeCapacityMin(draftBikeCapacityMin);
    setMemberCountMin(draftMemberCountMin);
    setHasNoteOnly(draftHasNoteOnly);
  };

  const clearFilters = () => {
    setDraftKeyword("");
    setDraftCategoryFilter([]);
    setDraftPrefectureFilter([]);
    setDraftCityFilter([]);
    setDraftStrengthFilter([]);
    setDraftGroundFilter("all");
    setDraftBikeFilter("all");
    setDraftBikeCapacityMin("");
    setDraftMemberCountMin("");
    setDraftHasNoteOnly(false);

    setKeyword("");
    setCategoryFilter([]);
    setPrefectureFilter([]);
    setCityFilter([]);
    setStrengthFilter([]);
    setGroundFilter("all");
    setBikeFilter("all");
    setBikeCapacityMin("");
    setMemberCountMin("");
    setHasNoteOnly(false);
  };

  const hasDraftChanges = useMemo(() => {
    return (
      draftKeyword !== keyword ||
      JSON.stringify(draftCategoryFilter) !== JSON.stringify(categoryFilter) ||
      JSON.stringify(draftPrefectureFilter) !== JSON.stringify(prefectureFilter) ||
      JSON.stringify(draftCityFilter) !== JSON.stringify(cityFilter) ||
      JSON.stringify(draftStrengthFilter) !== JSON.stringify(strengthFilter) ||
      draftGroundFilter !== groundFilter ||
      draftBikeFilter !== bikeFilter ||
      draftBikeCapacityMin !== bikeCapacityMin ||
      draftMemberCountMin !== memberCountMin ||
      draftHasNoteOnly !== hasNoteOnly
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
    draftStrengthFilter,
    strengthFilter,
    draftGroundFilter,
    groundFilter,
    draftBikeFilter,
    bikeFilter,
    draftBikeCapacityMin,
    bikeCapacityMin,
    draftMemberCountMin,
    memberCountMin,
    draftHasNoteOnly,
    hasNoteOnly,
  ]);

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      const cats =
        Array.isArray(t.categories) && t.categories.length > 0
          ? t.categories
          : t.category
          ? [t.category]
          : [];

      if (categoryFilter.length > 0) {
        if (!cats.some((c) => c && categoryFilter.includes(String(c).trim()))) {
          return false;
        }
      }

      if (prefectureFilter.length > 0) {
        if (!prefectureFilter.includes(norm(t.prefecture))) return false;
      }

      if (cityFilter.length > 0) {
        if (!cityFilter.includes(norm(t.city))) return false;
      }

      if (strengthFilter.length > 0) {
        if (!strengthFilter.includes(getStrength(t))) return false;
      }

      if (groundFilter !== "all") {
        const val = t.has_ground ? "あり" : "なし";
        if (val !== groundFilter) return false;
      }

      if (bikeFilter !== "all") {
        const val = (t.bike_parking ?? "不明") as "あり" | "なし" | "不明";
        if (val !== bikeFilter) return false;
      }

      if (bikeCapacityMin) {
        const cap = parseBikeCapacity(t.bike_parking_capacity);
        if (cap == null || cap < Number(bikeCapacityMin)) return false;
      }

      if (memberCountMin) {
        const count = Number(getMemberCount(t));
        if (count < Number(memberCountMin)) return false;
      }

      if (hasNoteOnly && !norm(t.note)) return false;

      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const hay = [
          t.name,
          t.area,
          t.prefecture,
          t.city,
          t.category,
          ...(t.categories ?? []),
          t.note,
          t.uniform_main,
          t.uniform_sub,
          t.bike_parking,
          t.bike_parking_capacity,
          getStrength(t),
          String(getMemberCount(t)),
        ]
          .filter(Boolean)
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
    strengthFilter,
    groundFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
    hasNoteOnly,
  ]);

  const appliedSummary = useMemo(() => {
    const parts: string[] = [];
    if (keyword) parts.push(`キーワード: ${keyword}`);
    if (prefectureFilter.length > 0) parts.push(`都県: ${prefectureFilter.join(" / ")}`);
    if (cityFilter.length > 0) parts.push(`市区町村: ${cityFilter.join(" / ")}`);
    if (categoryFilter.length > 0) parts.push(`カテゴリ: ${categoryFilter.join(" / ")}`);
    if (strengthFilter.length > 0) parts.push(`強さ: ${strengthFilter.join(" / ")}`);
    if (groundFilter !== "all") parts.push(`グラウンド: ${groundFilter}`);
    if (bikeFilter !== "all") parts.push(`駐輪場: ${bikeFilter}`);
    if (bikeCapacityMin) parts.push(`駐輪場台数: ${bikeCapacityMin}台以上`);
    if (memberCountMin) parts.push(`人数: ${memberCountMin}人以上`);
    if (hasNoteOnly) parts.push("メモありのみ");
    return parts;
  }, [
    keyword,
    prefectureFilter,
    cityFilter,
    categoryFilter,
    strengthFilter,
    groundFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
    hasNoteOnly,
  ]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
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

      <AppTabNav />

      <AppHero
        icon="🔎"
        title="チーム検索"
        desc="地域やカテゴリ、強さ、駐輪場、人数などの条件から対戦相手候補を探せます。"
      />

      <div style={heroNoteBox}>
        <div style={heroNoteText}>
          ※市区町村は、現在チーム登録がある地域のみ表示されます。
          <br />
          近隣エリアも含めて探すと、対戦相手が見つかりやすくなります。
        </div>
      </div>

      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span style={labelTitle}>キーワード検索</span>
            <input
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              className="sh-input"
              placeholder="例：三宿 / 青 / 強度高め / U-12 / SS"
              disabled={loading}
            />
          </label>

          <div style={sectionCard}>
            <div style={sectionHeaderRow}>
              <div>
                <div style={sectionTitle}>都県</div>
                <div style={sectionSubText}>複数選択できます</div>
              </div>

              <div style={chipActionRow}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    setDraftPrefectureFilter(KANTO_PREFECTURES.map((p) => p.value));
                  }}
                  disabled={loading}
                >
                  全選択
                </button>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    setDraftPrefectureFilter([]);
                    setDraftCityFilter([]);
                  }}
                  disabled={loading}
                >
                  クリア
                </button>
              </div>
            </div>

            <div style={chipWrap}>
              {prefectureOptions.map((opt) => {
                const active = draftPrefectureFilter.includes(opt.value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setDraftPrefectureFilter((prev) => {
                        const exists = prev.includes(opt.value);
                        const next = exists
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value];

                        setDraftCityFilter((prevCities) => {
                          if (next.length === 0) return prevCities;

                          const allowedCities = new Set(
                            teams
                              .filter((t) => next.includes(norm(t.prefecture)))
                              .map((t) => norm(t.city))
                              .filter(Boolean)
                          );

                          return prevCities.filter((city) => allowedCities.has(city));
                        });

                        return next;
                      });
                    }}
                    style={{
                      ...prefChip,
                      ...(active ? prefChipActive : prefChipInactive),
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <CheckboxGroup
            title="市区町村で絞り込み（複数）"
            options={cityOptions}
            values={draftCityFilter}
            onChange={setDraftCityFilter}
            columns={3}
            disabled={loading}
            useChipUI={true}
          />

          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={categoryOptions}
            values={draftCategoryFilter}
            onChange={setDraftCategoryFilter}
            columns={3}
            disabled={loading}
            useChipUI={true}
          />

          <CheckboxGroup
            title="強さ（複数）"
            options={STRENGTH_OPTIONS}
            values={draftStrengthFilter}
            onChange={(values) => setDraftStrengthFilter(values as StrengthRank[])}
            columns={5}
            disabled={loading}
            useChipUI={true}
          />

          <div style={twoCols}>
            <label style={label}>
              <span style={labelTitle}>グラウンド提供</span>
              <select
                value={draftGroundFilter}
                onChange={(e) =>
                  setDraftGroundFilter(e.target.value as "all" | "あり" | "なし")
                }
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>駐輪場</span>
              <select
                value={draftBikeFilter}
                onChange={(e) =>
                  setDraftBikeFilter(e.target.value as "all" | "あり" | "なし" | "不明")
                }
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
                <option value="不明">不明</option>
              </select>
            </label>
          </div>

          <div style={threeCols}>
            <label style={label}>
              <span style={labelTitle}>駐輪場台数（以上）</span>
              <select
                value={draftBikeCapacityMin}
                onChange={(e) => setDraftBikeCapacityMin(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="5">5台以上</option>
                <option value="10">10台以上</option>
                <option value="15">15台以上</option>
                <option value="20">20台以上</option>
                <option value="25">25台以上</option>
                <option value="30">30台以上</option>
                <option value="40">40台以上</option>
                <option value="50">50台以上</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>チーム所属人数（以上）</span>
              <select
                value={draftMemberCountMin}
                onChange={(e) => setDraftMemberCountMin(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="5">5人以上</option>
                <option value="10">10人以上</option>
                <option value="15">15人以上</option>
                <option value="20">20人以上</option>
                <option value="25">25人以上</option>
                <option value="30">30人以上</option>
              </select>
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={draftHasNoteOnly}
                onChange={(e) => setDraftHasNoteOnly(e.target.checked)}
                disabled={loading}
              />
              メモ入力があるチームのみ
            </label>
          </div>

          <div style={actionRow}>
            <button
              className="sh-btn sh-btn--primary"
              type="button"
              onClick={applyFilters}
              disabled={loading || !hasDraftChanges}
            >
              {loading ? "更新中…" : "この条件で表示"}
            </button>

            <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
              条件クリア
            </button>

            <button className="sh-btn" type="button" onClick={load} disabled={loading}>
              {loading ? "更新中…" : "再読み込み"}
            </button>

            <div style={{ color: "#666", fontSize: 12 }}>
              ヒット件数：{filtered.length}
            </div>
          </div>

          {appliedSummary.length > 0 ? (
            <div style={appliedBox}>
              <div style={appliedTitle}>現在の表示条件</div>
              <div style={appliedText}>{appliedSummary.join(" / ")}</div>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>
              ※ 条件を入れて「この条件で表示」を押すと、一覧に反映されます
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={emptyBox}>条件に合うチームがありません。</div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} style={card}>
                <div style={cardTop}>
                  <div>
                    <div style={teamName}>{t.name ?? "（名称未設定）"}</div>
                    <div style={subLine}>
                      📍 {buildAreaText(t)}
                      <br />
                      🏷{" "}
                      {Array.isArray(t.categories) && t.categories.length > 0
                        ? t.categories.join(" / ")
                        : t.category ?? "未設定"}
                      {" / "}💪 強さ {getStrength(t)}
                    </div>
                  </div>

                  <div style={badge}>{getStrength(t)}</div>
                </div>

                <div style={infoGrid}>
                  <div style={infoBox}>
                    <div style={infoLabel}>グラウンド・駐輪場</div>
                    <div style={infoValue}>
                      グラウンド {t.has_ground ? "あり" : "なし"} / 駐輪場 {formatBikeParking(t)}
                    </div>
                  </div>

                  <div style={infoBox}>
                    <div style={infoLabel}>所属人数・希望枠</div>
                    <div style={infoValue}>
                      {getMemberCount(t)}人 / {formatDesiredDates(t.desired_dates)}
                    </div>
                  </div>

                  <div style={infoBox}>
                    <div style={infoLabel}>ユニフォーム</div>
                    <div style={infoValue}>
                      {t.uniform_main ?? "不明"}（メイン） / {t.uniform_sub ?? "不明"}（サブ）
                    </div>
                  </div>

                  {t.note ? (
                    <div style={infoBox}>
                      <div style={infoLabel}>メモ</div>
                      <div style={infoValue}>{t.note}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/matches" className="sh-btn sh-btn--primary">
                    このまま試合を探す
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const heroNoteBox: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const heroNoteText: React.CSSProperties = {
  fontSize: 13,
  color: "#55635a",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
};

const sectionCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const sectionHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
  fontSize: 16,
};

const sectionSubText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#7a7a7a",
};

const chipActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const chipWrap: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const prefChip: React.CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid #cfd8d3",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const prefChipActive: React.CSSProperties = {
  background: "#2f7d32",
  borderColor: "#2f7d32",
  color: "#fff",
  boxShadow: "0 6px 14px rgba(47,125,50,0.18)",
};

const prefChipInactive: React.CSSProperties = {
  background: "#fff",
  color: "#2d3b31",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 12px",
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fafafa",
  minHeight: 48,
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  alignItems: "start",
};

const threeCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  alignItems: "start",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const appliedBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: "10px 12px",
};

const appliedTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const appliedText: React.CSSProperties = {
  fontSize: 13,
  color: "#444",
  lineHeight: 1.7,
};

const card: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const subLine: React.CSSProperties = {
  color: "#666",
  marginTop: 8,
  lineHeight: 1.8,
};

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontWeight: 900,
  fontSize: 12,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
};

const emptyBox: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
};

const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};