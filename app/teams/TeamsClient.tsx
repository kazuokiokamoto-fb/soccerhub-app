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
  owner_id: string;
  name: string | null;
  area: string | null;

  // 旧: category / 新: categories どちらも来る可能性
  category: string | null;
  categories: string[] | null;

  level: number | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string;

  // 並び替え・検索に使う
  prefecture: string | null;
  city: string | null;
  town: string | null;
};

type Toast = { type: "success" | "error" | "info"; text: string };

function toTeam(row: DbTeam): Team {
  const cats =
    Array.isArray(row.categories) && row.categories.length > 0
      ? row.categories
      : row.category
      ? [row.category]
      : [];

  return {
    id: row.id,
    name: (row.name ?? "").trim() || "（名称未設定）",
    area: (row.area ?? "").trim() || "（エリア未設定）",
    category: cats[0] ?? (row.category ?? "（カテゴリ未設定）"),
    level: Number(row.level ?? 5),
    hasGround: !!row.has_ground,
    bikeParking: row.bike_parking ?? "不明",
    uniformMain: row.uniform_main ?? "不明",
    uniformSub: row.uniform_sub ?? "不明",
    rosterByGrade: (row.roster_by_grade ?? { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0 }) as any,
    desiredDates: row.desired_dates ?? [],
    note: row.note ?? "",
    updatedAt: row.updated_at,
    // 追加プロパティは Team 型に無いので UI 内で row を別保持して使う
  };
}

function formatAvailability(desiredDates?: string[]) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";
  const pretty = arr
    .map((s) => {
      const t = String(s).trim();
      if (!t) return "";
      const parts = t.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return `${parts[0]}（時間帯問わず）`;
      const day = parts[0];
      const slot = parts.slice(1).join(" ");
      return `${day}（${slot}）`;
    })
    .filter(Boolean);
  return pretty.join(" / ") || "未登録";
}

function jaSort(a: string, b: string) {
  return (a ?? "").localeCompare(b ?? "", "ja");
}

export default function TeamsClient({ createdId }: { createdId?: string }) {
  const created = createdId ?? "";

  const [meId, setMeId] = useState<string>("");

  const [rows, setRows] = useState<DbTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // 検索条件
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [townFilter, setTownFilter] = useState<string>("");

  useEffect(() => {
    if (!created) return;
    setToast({ type: "success", text: "✅ チームを登録しました（一覧に反映）" });
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [created]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id ?? ""));
  }, []);

  // ✅ /teams は「検索」なので 全チームを読む（RLSで見える範囲に限られる）
  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,area,category,categories,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,prefecture,city,town"
      )
      // 住所順（prefecture/city/town が入ってる前提。nullは後ろに回るのでクライアントでも整列）
      .order("prefecture", { ascending: true })
      .order("city", { ascending: true })
      .order("town", { ascending: true })
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `読み込みに失敗しました: ${error.message}` });
      setRows([]);
      setLoading(false);
      return;
    }

    const r = (data ?? []) as DbTeam[];

    // DBのorderが効かない/NULL混在でも綺麗にするため、クライアントで最終整列（あいうえお順）
    r.sort((a, b) => {
      const pa = a.prefecture ?? "";
      const pb = b.prefecture ?? "";
      const ca = a.city ?? "";
      const cb = b.city ?? "";
      const ta = a.town ?? "";
      const tb = b.town ?? "";
      const s1 = jaSort(pa, pb);
      if (s1 !== 0) return s1;
      const s2 = jaSort(ca, cb);
      if (s2 !== 0) return s2;
      const s3 = jaSort(ta, tb);
      if (s3 !== 0) return s3;
      // 同住所は新しい順
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    });

    setRows(r);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setQ("");
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
  };

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((row) => {
      // エリア
      if (prefectureFilter && (row.prefecture ?? "") !== prefectureFilter) return false;
      if (cityFilter && (row.city ?? "") !== cityFilter) return false;
      if (townFilter && (row.town ?? "") !== townFilter) return false;

      // カテゴリ（複数）
      const cats =
        Array.isArray(row.categories) && row.categories.length > 0
          ? row.categories
          : row.category
          ? [row.category]
          : [];
      if (categoryFilter.length > 0) {
        // どれか1つでも一致でOK
        const hit = cats.some((c) => categoryFilter.includes((c ?? "").trim()));
        if (!hit) return false;
      }

      // キーワード（チーム名 or エリア or city/town）
      if (qq) {
        const blob = [
          row.name ?? "",
          row.area ?? "",
          row.prefecture ?? "",
          row.city ?? "",
          row.town ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(qq)) return false;
      }

      return true;
    });
  }, [rows, q, categoryFilter, prefectureFilter, cityFilter, townFilter]);

  const myRows = useMemo(() => filteredRows.filter((r) => !!meId && r.owner_id === meId), [filteredRows, meId]);
  const otherRows = useMemo(() => filteredRows.filter((r) => !(!!meId && r.owner_id === meId)), [filteredRows, meId]);

  const remove = async (id: string) => {
    const ok = confirm("削除しますか？（※自分のチームのみ削除できます）");
    if (!ok) return;

    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      console.error(error);
      setToast({
        type: "error",
        text: `削除に失敗しました: ${error.message}\n（RLSの権限設定が原因のことが多いです）`,
      });
      return;
    }
    setRows((prev) => prev.filter((t) => t.id !== id));
    setToast({ type: "success", text: "🗑 削除しました" });
  };

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <PageHeader
        actions={
          <>
            <Link href="/teams/new" className="sh-btn">
              ＋ チーム登録へ
            </Link>
            <button className="sh-btn" type="button" onClick={load} disabled={loading}>
              {loading ? "更新中…" : "更新"}
            </button>
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

      <h1 style={{ margin: 0 }}>チーム検索</h1>
      <p style={{ color: "#555", marginTop: 6 }}>
        条件で絞り込みできます（自分のチームは編集できます）。
      </p>

      {/* 検索UI */}
      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>キーワード</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例：三宿 / 世田谷 / U-12 など"
              style={input}
            />
          </label>

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

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
              条件クリア
            </button>
            <span style={{ color: "#666", fontSize: 12 }}>
              ヒット：{filteredRows.length} 件（自分 {myRows.length} / 他 {otherRows.length}）
            </span>
          </div>
        </div>
      </section>

      {loading ? <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p> : null}

      {/* 自分のチーム */}
      <section style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>自分のチーム</h2>
        {meId ? null : <p style={{ color: "#777" }}>※ログインすると「自分のチーム」の編集ができます。</p>}
        {myRows.length === 0 ? (
          <p style={{ color: "#777" }}>まだありません。まずは「＋チーム登録へ」から作成してください。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myRows.map((row) => {
              const t = toTeam(row);
              const cats =
                Array.isArray(row.categories) && row.categories.length > 0
                  ? row.categories
                  : row.category
                  ? [row.category]
                  : [];
              const catsText = cats.filter(Boolean).join(" / ") || "（カテゴリ未設定）";

              return (
                <div key={t.id} style={cardMine}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{t.name}</div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <Link className="sh-btn" href={`/teams/${t.id}/edit`}>
                        編集
                      </Link>
                      <button className="sh-btn sh-btn--danger" onClick={() => remove(t.id)} type="button">
                        削除
                      </button>
                    </div>
                  </div>

                  <div style={line}>
                    {(row.prefecture ?? "").trim() || "—"} {(row.city ?? "").trim() || ""}{row.town ? `・${row.town}` : ""} / {catsText} / 強さ {t.level} / グラウンド{" "}
                    {t.hasGround ? "あり" : "なし"} / 🚲 {t.bikeParking}
                  </div>

                  <div style={line}>ユニ：{t.uniformMain}（メイン） / {t.uniformSub}（サブ）</div>
                  <div style={line}>
                    人数：G1 {t.rosterByGrade.G1} / G2 {t.rosterByGrade.G2} / G3 {t.rosterByGrade.G3} / G4 {t.rosterByGrade.G4} / G5 {t.rosterByGrade.G5} / G6 {t.rosterByGrade.G6}
                  </div>
                  <div style={line}>希望枠：{formatAvailability(t.desiredDates)}</div>
                  {t.note ? <div style={line}>メモ：{t.note}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 他のチーム */}
      <section style={{ marginTop: 20 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>他のチーム（検索結果）</h2>
        {otherRows.length === 0 ? (
          <p style={{ color: "#777" }}>該当なし</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {otherRows.map((row) => {
              const t = toTeam(row);
              const cats =
                Array.isArray(row.categories) && row.categories.length > 0
                  ? row.categories
                  : row.category
                  ? [row.category]
                  : [];
              const catsText = cats.filter(Boolean).join(" / ") || "（カテゴリ未設定）";

              return (
                <div key={t.id} style={cardOther}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{t.name}</div>
                    {/* 他チームは編集/削除なし */}
                  </div>

                  <div style={line}>
                    {(row.prefecture ?? "").trim() || "—"} {(row.city ?? "").trim() || ""}{row.town ? `・${row.town}` : ""} / {catsText} / 強さ {t.level} / グラウンド{" "}
                    {t.hasGround ? "あり" : "なし"} / 🚲 {t.bikeParking}
                  </div>

                  <div style={line}>ユニ：{t.uniformMain}（メイン） / {t.uniformSub}（サブ）</div>
                  <div style={line}>
                    人数：G1 {t.rosterByGrade.G1} / G2 {t.rosterByGrade.G2} / G3 {t.rosterByGrade.G3} / G4 {t.rosterByGrade.G4} / G5 {t.rosterByGrade.G5} / G6 {t.rosterByGrade.G6}
                  </div>
                  <div style={line}>希望枠：{formatAvailability(t.desiredDates)}</div>
                  {t.note ? <div style={line}>メモ：{t.note}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
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

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const line: React.CSSProperties = { color: "#666", marginTop: 6, lineHeight: 1.7 };

const cardMine: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
};

const cardOther: React.CSSProperties = {
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