"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

type Toast = { type: "success" | "error" | "info"; text: string };

type RecentVenue = {
  id: string;
  name: string | null;
  area: string | null;
  address: string | null;
  has_parking: boolean | null;
  has_bike_parking: boolean | null;
  note: string | null;
};

export default function VenueNewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [hasParking, setHasParking] = useState(false);
  const [hasBikeParking, setHasBikeParking] = useState(false);
  const [note, setNote] = useState("");

  const [recentVenues, setRecentVenues] = useState<RecentVenue[]>([]);

  const canSave = useMemo(() => {
    return !!name.trim() && !!area.trim() && !saving && !loading;
  }, [name, area, saving, loading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    loadRecentVenues();
  }, []);

  async function loadRecentVenues() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id,name,area,address,has_parking,has_bike_parking,note")
        .order("updated_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `グラウンド読込失敗: ${error.message}` });
        setRecentVenues([]);
        setLoading(false);
        return;
      }

      setRecentVenues((data ?? []) as RecentVenue[]);
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "グラウンド読込に失敗しました" });
    } finally {
      setLoading(false);
    }
  }

  function applyRecentVenue(v: RecentVenue) {
    setName(v.name ?? "");
    setArea(v.area ?? "");
    setAddress(v.address ?? "");
    setHasParking(!!v.has_parking);
    setHasBikeParking(!!v.has_bike_parking);
    setNote(v.note ?? "");
    setToast({ type: "info", text: "過去のグラウンド情報を入力欄に反映しました" });
  }

  async function save() {
    if (!name.trim() || !area.trim()) {
      alert("グラウンド名・エリアは必須です");
      return;
    }

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const { error } = await supabase.from("venues").insert({
        name: name.trim(),
        area: area.trim(),
        address: address.trim() || null,
        has_parking: hasParking,
        has_bike_parking: hasBikeParking,
        note: note.trim() || null,
      });

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `保存失敗: ${error.message}` });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ 保存しました" });

      setName("");
      setArea("");
      setAddress("");
      setHasParking(false);
      setHasBikeParking(false);
      setNote("");

      router.push("/venues");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
      setSaving(false);
      return;
    }

    setSaving(false);
  }

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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>グラウンド登録</h1>
        <p style={heroText}>
          募集枠作成で選べるグラウンドを登録します。
          <br />
          以前登録したグラウンド情報も再利用できます。
        </p>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/venues" className="sh-btn">
          一覧へ
        </Link>
        <Link href="/mypage" className="sh-btn">
          マイページへ
        </Link>
      </div>

      {recentVenues.length > 0 ? (
        <section style={{ ...card, marginTop: 16 }}>
          <div style={sectionTitle}>最近のグラウンド</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {recentVenues.map((v) => (
              <div key={v.id} style={recentRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{v.name ?? "名称未設定"}</div>
                  <div style={recentSub}>
                    {v.area ?? "エリア未設定"}
                    {v.address ? ` / ${v.address}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => applyRecentVenue(v)}
                  disabled={saving}
                >
                  入力欄に反映
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>グラウンド名（必須）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder="例：世田谷公園 サッカー場"
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span>エリア（必須）</span>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={input}
              placeholder="例：世田谷・三宿 / 目黒 など"
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span>住所（任意）</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={input}
              placeholder="例：東京都世田谷区池尻1-5-27"
              disabled={saving}
            />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={hasParking}
                onChange={(e) => setHasParking(e.target.checked)}
                disabled={saving}
              />
              🚗 駐車場あり
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={hasBikeParking}
                onChange={(e) => setHasBikeParking(e.target.checked)}
                disabled={saving}
              />
              🚲 駐輪場あり
            </label>
          </div>

          <label style={label}>
            <span>メモ（任意）</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...input, minHeight: 90 }}
              disabled={saving}
            />
          </label>

          <div style={actionRow}>
            <Link href="/venues" className="sh-btn">
              キャンセル
            </Link>

            <button
              className="sh-btn sh-btn--primary"
              onClick={save}
              type="button"
              disabled={!canSave}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
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

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  fontFamily: "inherit",
  fontSize: 14,
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  border: "1px solid #eee",
  borderRadius: 10,
  background: "#fafafa",
};

const recentRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #eee",
  background: "#fafafa",
};

const recentSub: React.CSSProperties = {
  marginTop: 4,
  color: "#66756d",
  fontSize: 13,
  lineHeight: 1.6,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
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