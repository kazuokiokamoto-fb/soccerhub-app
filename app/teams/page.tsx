"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { supabase } from "../lib/supabase";
import { Team } from "../lib/types";

type DbTeam = {
  id: string;
  name: string;
  area: string;
  category: string;
  level: number;
  has_ground: boolean;
  bike_parking: string;
  uniform_main: string;
  uniform_sub: string;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null; // ← 曜日/時間帯の配列
  note: string | null;
  updated_at: string;
};

function toTeam(row: DbTeam): Team {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    category: row.category,
    level: row.level,
    hasGround: !!row.has_ground,
    bikeParking: row.bike_parking ?? "不明",
    uniformMain: row.uniform_main ?? "不明",
    uniformSub: row.uniform_sub ?? "不明",
    rosterByGrade:
      (row.roster_by_grade ?? { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0 }) as any,
    desiredDates: row.desired_dates ?? [],
    note: row.note ?? "",
    updatedAt: row.updated_at,
  };
}

type Toast = { type: "success" | "error" | "info"; text: string };

// ✅ desiredDates 表示を「土（時間帯問わず） / 祝日（午後）」にする
function formatAvailability(desiredDates?: string[]) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";

  const pretty = arr.map((s) => {
    const t = String(s).trim();
    if (!t) return "";
    const parts = t.split(/\s+/).filter(Boolean);

    // ["土"] → 土（時間帯問わず）
    if (parts.length === 1) return `${parts[0]}（時間帯問わず）`;

    // ["祝日","午後"] → 祝日（午後）
    const day = parts[0];
    const slot = parts.slice(1).join(" ");
    return `${day}（${slot}）`;
  });

  return pretty.filter(Boolean).join(" / ") || "未登録";
}

/**
 * ✅ ここがポイント
 * Page本体では useSearchParams を直接使わず、
 * Suspense の内側のコンポーネントで使う（Next の prerender 対策）
 */
export default function TeamsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: "#777" }}>読み込み中...</p>}>
      <TeamsPageInner />
    </Suspense>
  );
}

function TeamsPageInner() {
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created") || "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // 登録直後のトースト
  useEffect(() => {
    if (!createdId) return;
    setToast({ type: "success", text: "✅ チームを登録しました（一覧に反映）" });
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [createdId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select(
        "id,name,area,category,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `読み込みに失敗しました: ${error.message}` });
      setTeams([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DbTeam[];
    setTeams(rows.map(toTeam));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id: string) => {
    const ok = confirm("削除しますか？（※権限設定次第で失敗する場合があります）");
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
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setToast({ type: "success", text: "🗑 削除しました" });
  };

  const createdTeam = useMemo(
    () => teams.find((t) => t.id === createdId),
    [teams, createdId]
  );

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Toast */}
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

      <h1 style={{ margin: 0 }}>チーム一覧</h1>
      <p style={{ color: "#555", marginTop: 6 }}>Supabase（DB）から表示しています。</p>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <Link href="/" className="sh-btn">
          トップへ
        </Link>
        <Link href="/teams/new" className="sh-btn">
          ＋ チーム登録へ
        </Link>
        <button className="sh-btn" type="button" onClick={load}>
          再読み込み
        </button>
      </div>

      {createdId && createdTeam ? (
        <div style={{ ...miniInfo, marginTop: 12 }}>
          ✨ さっき登録したチーム： <b>{createdTeam.name}</b>（ハイライト中）
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {teams.length === 0 ? (
            <p style={{ color: "#777" }}>まだチームがありません。登録してみてください。</p>
          ) : (
            teams.map((t) => {
              const isCreated = createdId && t.id === createdId;
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
                    <div style={{ fontWeight: 800 }}>
                      {t.name} {isCreated ? "✅" : ""}
                    </div>

                    <button
                      className="sh-btn sh-btn--danger"
                      onClick={() => remove(t.id)}
                      type="button"
                    >
                      削除
                    </button>
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    {t.area} / {t.category} / 強さ {t.level} / グラウンド{" "}
                    {t.hasGround ? "あり" : "なし"} / 🚲 {t.bikeParking}
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    ユニ：{t.uniformMain}（メイン） / {t.uniformSub}（サブ）
                  </div>

                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    人数：G1 {t.rosterByGrade.G1} / G2 {t.rosterByGrade.G2} / G3{" "}
                    {t.rosterByGrade.G3} / G4 {t.rosterByGrade.G4} / G5{" "}
                    {t.rosterByGrade.G5} / G6 {t.rosterByGrade.G6}
                  </div>

                  {/* ✅ desiredDates 表示 */}
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

// --- toast styles ---
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