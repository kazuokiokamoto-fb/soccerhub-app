// app/teams/search/TeamsSearchClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

export default function TeamsSearchClient() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);

  const [teams, setTeams] = useState<DbTeam[]>([]);

  // filters
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefecture, setPrefecture] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [town, setTown] = useState<string>("");

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
      .select("id,name,area,category,categories,level,has_ground,bike_parking,uniform_main,uniform_sub,note,prefecture,city,town,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setTeams([]);
      setToast({ type: "error", text: `読み込みに失敗: ${error.message}` });
      setLoading(false);
      return;
    }

    setTeams((data ?? []) as any);
    setToast(null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setCategoryFilter([]);
    setPrefecture("");
    setCity("");
    setTown("");
  };

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      // ✅ categories（新）優先、無ければ category（旧）
      const cats =
        Array.isArray(t.categories) && t.categories.length > 0
          ? t.categories
          : t.category
          ? [t.category]
          : [];

      if (categoryFilter.length > 0) {
        if (cats.length === 0) return false;
        if (!cats.some((c) => c && categoryFilter.includes(String(c)))) return false;
      }

      if (prefecture && (t.prefecture ?? "") !== prefecture) return false;
      if (city && (t.city ?? "") !== city) return false;
      if (town && (t.town ?? "") !== town) return false;

      return true;
    });
  }, [teams, categoryFilter, prefecture, city, town]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success" ? toastSuccess : toast.type === "error" ? toastError : toastInfo),
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

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>チーム検索</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>エリアとカテゴリで絞り込めます。</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" className="sh-btn">トップ</Link>
          <Link href="/match" className="sh-btn">マッチング</Link>
          <Link href="/teams" className="sh-btn">自分のチーム</Link>
          <button className="sh-btn" type="button" onClick={load} disabled={loading}>
            {loading ? "更新中…" : "更新"}
          </button>
        </div>
      </header>

      <section style={filterWrap}>
        <AreaPickerKanto
          title="エリアで絞り込み（関東）"
          allowAll={true}
          allLabel="関東（すべて）"
          disabled={loading}
          prefecture={prefecture}
          setPrefecture={setPrefecture}
          city={city}
          setCity={setCity}
          town={town}
          setTown={setTown}
          townOptional={true}
        />

        <div style={{ marginTop: 12 }}>
          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={categoryFilter}
            onChange={setCategoryFilter}
            columns={3}
            disabled={loading}
          />
        </div>

        {categoryFilter.length > 0 || prefecture || city || town ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
              条件クリア
            </button>
            <span style={{ color: "#666", fontSize: 12 }}>
              絞り込み中：{prefecture || "（都県なし）"} / {city || "（市区町村なし）"} / {town || "（町名なし）"} /
              カテゴリ {categoryFilter.length}
            </span>
          </div>
        ) : (
          <div style={{ color: "#777", fontSize: 12, marginTop: 10 }}>
            ※ エリア（都県→市区町村→町名）とカテゴリで絞り込みできます
          </div>
        )}
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
                  <div style={{ fontWeight: 900 }}>{t.name ?? "（名称未設定）"}</div>
                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    {area} / {cats} / 強さ {t.level ?? 5} / グラウンド {t.has_ground ? "あり" : "なし"} / 🚲{" "}
                    {t.bike_parking ?? "不明"}
                  </div>
                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    ユニ：{t.uniform_main ?? "不明"}（メイン） / {t.uniform_sub ?? "不明"}（サブ）
                  </div>
                  {t.note ? (
                    <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>メモ：{t.note}</div>
                  ) : null}
                </div>
              );
            })
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

const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
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

const toastSuccess: React.CSSProperties = { background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" };
const toastError: React.CSSProperties = { background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
const toastInfo: React.CSSProperties = { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" };

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};