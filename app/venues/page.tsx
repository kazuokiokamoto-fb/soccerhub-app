"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type VenueRow = {
  id: string;
  name: string | null;
  area: string | null;
  address: string | null;
  has_parking: boolean | null;
  has_bike_parking: boolean | null;
  parking_capacity?: number | null;
  bike_parking_capacity?: number | null;
  note: string | null;
  updated_at?: string | null;
};

type Toast = { type: "success" | "error" | "info"; text: string };

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("parking_capacity") || msg.includes("bike_parking_capacity")))
  );
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    setToast(null);

    try {
      const primaryRes = await supabase
        .from("venues")
        .select(
          "id,name,area,address,has_parking,has_bike_parking,parking_capacity,bike_parking_capacity,note,updated_at"
        )
        .order("updated_at", { ascending: false })
        .order("name", { ascending: true });

      if (primaryRes.error && isMissingColumnError(primaryRes.error)) {
        const fallbackRes = await supabase
          .from("venues")
          .select("id,name,area,address,has_parking,has_bike_parking,note,updated_at")
          .order("updated_at", { ascending: false })
          .order("name", { ascending: true });

        if (fallbackRes.error) {
          console.error(fallbackRes.error);
          setToast({
            type: "error",
            text: `グラウンド読込失敗: ${fallbackRes.error.message}`,
          });
          setVenues([]);
          setLoading(false);
          return;
        }

        setVenues((fallbackRes.data ?? []) as VenueRow[]);
        setLoading(false);
        return;
      }

      if (primaryRes.error) {
        console.error(primaryRes.error);
        setToast({
          type: "error",
          text: `グラウンド読込失敗: ${primaryRes.error.message}`,
        });
        setVenues([]);
        setLoading(false);
        return;
      }

      setVenues((primaryRes.data ?? []) as VenueRow[]);
    } catch (e: any) {
      console.error(e);
      setToast({
        type: "error",
        text: e?.message ?? "グラウンド読込に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const ok = window.confirm("このグラウンドを削除しますか？");
    if (!ok) return;

    setDeletingId(id);

    try {
      const { error } = await supabase.from("venues").delete().eq("id", id);

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `削除失敗: ${error.message}` });
        setDeletingId("");
        return;
      }

      setVenues((prev) => prev.filter((v) => v.id !== id));
      setToast({ type: "success", text: "✅ 削除しました" });
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "削除に失敗しました" });
    } finally {
      setDeletingId("");
    }
  }

  const venueCountText = useMemo(() => {
    if (loading) return "読み込み中…";
    return `${venues.length}件`;
  }, [loading, venues.length]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
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

      <section style={heroBox}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>グラウンド一覧</h1>
        <p style={heroText}>
          登録済みのグラウンドを確認・管理できます。
          <br />
          募集枠作成時にここで登録したグラウンドを選べます。
        </p>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/mypage" className="sh-btn">
          マイページへ
        </Link>

        <Link href="/venues/new" className="sh-btn sh-btn--primary">
          ＋グラウンド登録
        </Link>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={sectionHead}>
          <div style={sectionTitle}>登録済みグラウンド</div>
          <div style={countBadge}>{venueCountText}</div>
        </div>

        {loading ? (
          <div style={emptyBox}>読み込み中…</div>
        ) : venues.length === 0 ? (
          <div style={emptyBox}>
            まだグラウンドがありません。
            <br />
            「＋グラウンド登録」から追加してください。
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {venues.map((v) => (
              <div key={v.id} style={venueCard}>
                <div style={venueHead}>
                  <div style={{ minWidth: 0 }}>
                    <div style={venueName}>{v.name || "名称未設定"}</div>
                    <div style={venueSub}>
                      {v.area || "エリア未設定"}
                      {v.address ? ` / ${v.address}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => remove(v.id)}
                      disabled={deletingId === v.id}
                    >
                      {deletingId === v.id ? "削除中…" : "削除"}
                    </button>
                  </div>
                </div>

                <div style={metaRow}>
                  🚗 {v.has_parking ? "駐車場あり" : "駐車場なし"}
                  {v.parking_capacity != null ? `（${v.parking_capacity}台）` : ""}
                  {" / "}
                  🚲 {v.has_bike_parking ? "駐輪場あり" : "駐輪場なし"}
                  {v.bike_parking_capacity != null
                    ? `（${v.bike_parking_capacity}台）`
                    : ""}
                </div>

                {v.note?.trim() ? (
                  <div style={noteBox}>
                    <div style={noteTitle}>メモ</div>
                    <div style={noteBody}>{v.note}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 20,
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
};

const heroText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
};

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
  fontSize: 18,
};

const countBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 900,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#777",
  lineHeight: 1.8,
  textAlign: "center",
};

const venueCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
};

const venueHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const venueName: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#16391f",
};

const venueSub: React.CSSProperties = {
  marginTop: 4,
  color: "#66756d",
  fontSize: 13,
  lineHeight: 1.6,
};

const metaRow: React.CSSProperties = {
  marginTop: 8,
  color: "#4b5563",
  lineHeight: 1.7,
  fontSize: 14,
};

const noteBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const noteTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const noteBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
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