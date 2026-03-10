"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

type Toast = { type: "success" | "error" | "info"; text: string };

type DbTeam = {
  id: string;
  name: string | null;
  area: string | null;
  category: string | null;
  categories: string[] | null;
  level: number | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  note: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  updated_at: string;
};

function levelLabel(level: number) {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

export default function TeamsSearchClient() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);

  const [teams, setTeams] = useState<DbTeam[]>([]);

  // 入力中
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string[]>([]);
  const [draftPrefecture, setDraftPrefecture] = useState<string>("");
  const [draftCity, setDraftCity] = useState<string>("");
  const [draftTown, setDraftTown] = useState<string>("");
  const [draftGroundFilter, setDraftGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [draftStrengthFilter, setDraftStrengthFilter] = useState<string>("");

  // 適用中
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefecture, setPrefecture] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [town, setTown] = useState<string>("");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [strengthFilter, setStrengthFilter] = useState<string>("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async () => {
    setLoading(true);
    setToast({ type: "info", text: "読み込み中…" });

    const { data, error } = await supabase
      .from("teams")
      .select(
        "id,name,area,category,categories,level,has_ground,bike_parking,uniform_main,uniform_sub,note,prefecture,city,town,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setTeams([]);
      setToast({ type: "error", text: `読み込みに失敗: ${error.message}` });
      setLoading(false);
      return;
    }

    setTeams((data ?? []) as DbTeam[]);
    setToast(null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setKeyword(draftKeyword);
    setCategoryFilter(draftCategoryFilter);
    setPrefecture(draftPrefecture);
    setCity(draftCity);
    setTown(draftTown);
    setGroundFilter(draftGroundFilter);
    setStrengthFilter(draftStrengthFilter);
  };

  const clearFilters = () => {
    setDraftKeyword("");
    setDraftCategoryFilter([]);
    setDraftPrefecture("");
    setDraftCity("");
    setDraftTown("");
    setDraftGroundFilter("all");
    setDraftStrengthFilter("");

    setKeyword("");
    setCategoryFilter([]);
    setPrefecture("");
    setCity("");
    setTown("");
    setGroundFilter("all");
    setStrengthFilter("");
  };

  const hasDraftChanges = useMemo(() => {
    return (
      draftKeyword !== keyword ||
      JSON.stringify(draftCategoryFilter) !== JSON.stringify(categoryFilter) ||
      draftPrefecture !== prefecture ||
      draftCity !== city ||
      draftTown !== town ||
      draftGroundFilter !== groundFilter ||
      draftStrengthFilter !== strengthFilter
    );
  }, [
    draftKeyword,
    keyword,
    draftCategoryFilter,
    categoryFilter,
    draftPrefecture,
    prefecture,
    draftCity,
    city,
    draftTown,
    town,
    draftGroundFilter,
    groundFilter,
    draftStrengthFilter,
    strengthFilter,
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
        if (cats.length === 0) return false;
        if (!cats.some((c) => c && categoryFilter.includes(String(c).trim()))) return false;
      }

      if (prefecture && (t.prefecture ?? "") !== prefecture) return false;
      if (city && (t.city ?? "") !== city) return false;
      if (town && (t.town ?? "") !== town) return false;

      if (groundFilter !== "all") {
        const val = t.has_ground ? "あり" : "なし";
        if (val !== groundFilter) return false;
      }

      if (strengthFilter) {
        const rank = levelLabel(Number(t.level ?? 0));
        if (rank !== strengthFilter) return false;
      }

      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const hay = [
          t.name,
          t.area,
          t.category,
          ...(t.categories ?? []),
          t.prefecture,
          t.city,
          t.town,
          t.note,
          t.uniform_main,
          t.uniform_sub,
          t.bike_parking,
          levelLabel(Number(t.level ?? 0)),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [teams, keyword, categoryFilter, prefecture, city, town, groundFilter, strengthFilter]);

  const appliedSummary = useMemo(() => {
    const parts: string[] = [];
    if (keyword) parts.push(`キーワード: ${keyword}`);
    if (prefecture) parts.push(`都県: ${prefecture}`);
    if (city) parts.push(`市区町村: ${city}`);
    if (town) parts.push(`町名: ${town}`);
    if (categoryFilter.length > 0) parts.push(`カテゴリ: ${categoryFilter.join(" / ")}`);
    if (strengthFilter) parts.push(`強さ: ${strengthFilter}`);
    if (groundFilter !== "all") parts.push(`グラウンド提供: ${groundFilter}`);
    return parts;
  }, [keyword, prefecture, city, town, categoryFilter, strengthFilter, groundFilter]);

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
          <button type="button" onClick={() => setToast(null)} style={toastClose} aria-label="閉じる">
            ×
          </button>
        </div>
      ) : null}

      <header style={pageHead}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>チーム検索</h1>
          <p style={{ margin: "6px 0 0", color: "#555", lineHeight: 1.7 }}>
            地域やカテゴリ、強さなどの条件から、対戦相手候補のチームを探せます。
          </p>
        </div>
      </header>

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

          <AreaPickerKanto
            title="エリアで絞り込み（関東）"
            allowAll={true}
            allLabel="関東（すべて）"
            disabled={loading}
            prefecture={draftPrefecture}
            setPrefecture={setDraftPrefecture}
            city={draftCity}
            setCity={setDraftCity}
            town={draftTown}
            setTown={setDraftTown}
            townOptional={true}
          />

          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={draftCategoryFilter}
            onChange={setDraftCategoryFilter}
            columns={3}
            disabled={loading}
          />

          <div style={twoCols}>
            <label style={label}>
              <span style={labelTitle}>強さ</span>
              <select
                value={draftStrengthFilter}
                onChange={(e) => setDraftStrengthFilter(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="SS">SS</option>
                <option value="S">S</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>グラウンド提供</span>
              <select
                value={draftGroundFilter}
                onChange={(e) => setDraftGroundFilter(e.target.value as "all" | "あり" | "なし")}
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
              </select>
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

            <div style={{ color: "#666", fontSize: 12 }}>ヒット件数：{filtered.length}</div>
          </div>

          {appliedSummary.length > 0 ? (
            <div style={appliedBox}>
              <div style={appliedTitle}>現在の表示条件</div>
              <div style={appliedText}>{appliedSummary.join(" / ")}</div>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>
              ※ 条件を入力して「この条件で表示」を押すと、検索結果に反映されます
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {filtered.length === 0 ? (
            <p style={{ color: "#777" }}>条件に合うチームがありません。</p>
          ) : (
            filtered.map((t) => {
              const cats =
                Array.isArray(t.categories) && t.categories.length > 0
                  ? t.categories.join(", ")
                  : (t.category ?? "未設定");

              const area =
                (t.area ?? "").trim() ||
                `${t.prefecture ?? ""} ${t.city ?? ""}${t.town ? "・" + t.town : ""}`.trim() ||
                "（エリア未設定）";

              return (
                <div key={t.id} style={card}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {t.name ?? "（名称未設定）"}
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    📍 {area}
                    <br />
                    🏷 {cats} / 💪 強さ {levelLabel(Number(t.level ?? 0))} / 🏟 グラウンド{" "}
                    {t.has_ground ? "あり" : "なし"} / 🚲 {t.bike_parking ?? "不明"}
                  </div>

                  <div style={infoGrid}>
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
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}

const pageHead: React.CSSProperties = {
  marginBottom: 12,
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
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
  padding: 14,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fafafa",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fff",
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