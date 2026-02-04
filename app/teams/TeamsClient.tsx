// app/teams/TeamsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PageHeader from "@/app/components/PageHeader";
import { supabase } from "../lib/supabase";
import { Team } from "../lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

type DbTeam = {
  id: string;
  name: string;
  area: string | null;
  category: string | null;
  categories: string[] | null;

  prefecture: string | null;
  city: string | null;
  town: string | null;

  level: number | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string;
  owner_id: string | null;
};

function toTeam(row: DbTeam): Team {
  return {
    id: row.id,
    name: row.name,
    area: row.area ?? "",
    category: row.category ?? "",
    level: Number(row.level ?? 5),
    hasGround: !!row.has_ground,
    bikeParking: row.bike_parking ?? "不明",
    uniformMain: row.uniform_main ?? "不明",
    uniformSub: row.uniform_sub ?? "不明",
    rosterByGrade: (row.roster_by_grade ?? { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0 }) as any,
    desiredDates: row.desired_dates ?? [],
    note: row.note ?? "",
    updatedAt: row.updated_at,
  };
}

type Toast = { type: "success" | "error" | "info"; text: string };

function formatAvailability(desiredDates?: string[]) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";

  const pretty = arr.map((s) => {
    const t = String(s).trim();
    if (!t) return "";
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return `${parts[0]}（時間帯問わず）`;
    const day = parts[0];
    const slot = parts.slice(1).join(" ");
    return `${day}（${slot}）`;
  });

  return pretty.filter(Boolean).join(" / ") || "未登録";
}

function norm(s?: string | null) {
  return (s ?? "").trim();
}

function compareStr(a: string, b: string) {
  // 日本語の並びをそれっぽく（完全な“あいうえお順”は別途辞書が必要）
  return a.localeCompare(b, "ja");
}

export default function TeamsClient({ createdId }: { createdId?: string }) {
  const created = createdId ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [dbTeams, setDbTeams] = useState<DbTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // ✅ 検索条件（カレンダーと同じ）
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [townFilter, setTownFilter] = useState<string>("");

  useEffect(() => {
    if (!created) return;
    setToast({ type: "success", text: "✅ チームを登録しました（検索結果に反映）" });
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [created]);

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
        "id,name,area,category,categories,prefecture,city,town,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,owner_id"
      );

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `読み込みに失敗しました: ${error.message}` });
      setDbTeams([]);
      setTeams([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DbTeam[];

    // ✅ 住所順（都県→市→町→チーム名）で並べる
    const sorted = [...rows].sort((a, b) => {
      const ap = norm(a.prefecture) || norm(a.area);
      const bp = norm(b.prefecture) || norm(b.area);
      if (ap !== bp) return compareStr(ap, bp);

      const ac = norm(a.city);
      const bc = norm(b.city);
      if (ac !== bc) return compareStr(ac, bc);

      const at = norm(a.town);
      const bt = norm(b.town);
      if (at !== bt) return compareStr(at, bt);

      return compareStr(norm(a.name), norm(b.name));
    });

    setDbTeams(sorted);
    setTeams(sorted.map(toTeam));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
  };

  const filteredDbTeams = useMemo(() => {
    return dbTeams.filter((t) => {
      // カテゴリ（複数）: categories があればそれ、無ければ category で判定
      if (categoryFilter.length > 0) {
        const cats = Array.isArray(t.categories) && t.categories.length > 0 ? t.categories : t.category ? [t.category] : [];
        const ok = cats.some((c) => c && categoryFilter.includes(String(c).trim()));
        if (!ok) return false;
      }

      if (prefectureFilter && norm(t.prefecture) !== prefectureFilter) return false;
      if (cityFilter && norm(t.city) !== cityFilter) return false;
      if (townFilter && norm(t.town) !== townFilter) return false;

      return true;
    });
  }, [dbTeams, categoryFilter, prefectureFilter, cityFilter, townFilter]);

  const filteredTeams = useMemo(() => filteredDbTeams.map(toTeam), [filteredDbTeams]);

  const createdTeam = useMemo(() => filteredTeams.find((t) => t.id === created), [filteredTeams, created]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        actions={
          <>
            <Link href="/teams/new" className="sh-btn">
              ＋ チーム登録へ
            </Link>
          </>
        }
      />

      {/* Toast */}
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

      {/* ✅ タイトルを「チーム検索」に変更 */}
      <h1 style={{ margin: 0 }}>チーム検索</h1>
      <p style={{ color: "#555", marginTop: 6 }}>エリア（都県→市区町村→町名）とカテゴリで絞り込みできます。</p>

      {/* ✅ 検索条件（カレンダーと同じ） */}
      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <AreaPickerKanto
            title="エリアで絞り込み（関東）"
            allowAll={true}
            allLabel="関東（すべて）"
            disabled={loading}
            prefecture={prefectureFilter}
            setPrefecture={setPrefectureFilter}
            city={cityFilter}
            setCity={setCityFilter}
            town={townFilter}
            setTown={setTownFilter}
            townOptional={true}
          />

          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={categoryFilter}
            onChange={setCategoryFilter}
            columns={3}
            disabled={loading}
          />

          {categoryFilter.length > 0 || prefectureFilter || cityFilter || townFilter ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
                条件クリア
              </button>
              <span style={{ color: "#666", fontSize: 12 }}>
                絞り込み中：
                {prefectureFilter ? ` ${prefectureFilter}` : "（都県なし）"} /
                {cityFilter ? ` ${cityFilter}` : "（市区町村なし）"} /
                {townFilter ? ` ${townFilter}` : "（町名なし）"} / カテゴリ {categoryFilter.length}
              </span>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>※ エリア（都県→市区町村→町名）とカテゴリで絞り込みできます</div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="sh-btn" type="button" onClick={load} disabled={loading}>
              {loading ? "更新中…" : "再読み込み"}
            </button>
            <div style={{ color: "#666", fontSize: 12, alignSelf: "center" }}>
              ヒット件数：{filteredTeams.length}
            </div>
          </div>
        </div>
      </section>

      {created && createdTeam ? (
        <div style={{ ...miniInfo, marginTop: 12 }}>
          ✨ さっき登録したチーム： <b>{createdTeam.name}</b>（検索結果内でハイライト）
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {filteredTeams.length === 0 ? (
            <p style={{ color: "#777" }}>条件に一致するチームがありません。</p>
          ) : (
            filteredTeams.map((t) => {
              const isCreated = created && t.id === created;
              return (
                <div
                  key={t.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: isCreated ? "2px solid #86efac" : "1px solid #eee",
                    background: isCreated ? "#f0fdf4" : "#fafafa",
                    boxShadow: isCreated ? "0 0 0 4px rgba(34,197,94,0.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>{t.name} {isCreated ? "✅" : ""}</div>

                    {/* ✅ ここは“検索結果”なので、編集/削除は出さない方が自然。
                        （自分のチーム編集はTOP→自分のチームで別導線にする想定） */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link className="sh-btn" href={`/teams/${t.id}/edit`}>
                        編集（仮）
                      </Link>
                    </div>
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    {t.area} / {t.category} / 強さ {t.level} / グラウンド {t.hasGround ? "あり" : "なし"} / 🚲 {t.bikeParking}
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    ユニ：{t.uniformMain}（メイン） / {t.uniformSub}（サブ）
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    人数：G1 {t.rosterByGrade.G1} / G2 {t.rosterByGrade.G2} / G3 {t.rosterByGrade.G3} / G4 {t.rosterByGrade.G4} / G5 {t.rosterByGrade.G5} / G6 {t.rosterByGrade.G6}
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    希望枠：{formatAvailability(t.desiredDates)}
                  </div>

                  {t.note ? (
                    <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                      メモ：{t.note}
                    </div>
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

const miniInfo: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  color: "#444",
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
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