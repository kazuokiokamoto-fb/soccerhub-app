"use client";

import React, { useState } from "react";
import Link from "next/link";

import { VENUE_KEY } from "../../lib/keys";
import { safeLoad, safeSave } from "../../lib/storage";
import { Venue } from "../../lib/types";

function uid() {
  return "v_" + Math.random().toString(36).slice(2, 10);
}

export default function VenueNewPage() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [hasParking, setHasParking] = useState(false);
  const [hasBikeParking, setHasBikeParking] = useState(false);
  const [note, setNote] = useState("");

  const save = () => {
    if (!name.trim() || !area.trim()) {
      alert("グラウンド名・エリアは必須です");
      return;
    }

    const venue: Venue = {
      id: uid(),
      name: name.trim(),
      area: area.trim(),
      address: address.trim() || undefined,
      hasParking,
      hasBikeParking,
      note,
      updatedAt: new Date().toISOString(),
    };

    const current = safeLoad<Venue[]>(VENUE_KEY, []);
    const next = [venue, ...(Array.isArray(current) ? current : [])];
    safeSave(VENUE_KEY, next);

    // 入力をクリア
    setName("");
    setArea("");
    setAddress("");
    setHasParking(false);
    setHasBikeParking(false);
    setNote("");

    alert("保存しました（一覧へ戻って確認してください）");
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>グラウンド登録</h1>
      <p style={{ color: "#555", marginTop: 6 }}>localStorage に保存（後でDBに差し替え）</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/venues" className="sh-btn">
          一覧へ
        </Link>
        <Link href="/" className="sh-btn">
          トップへ
        </Link>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>グラウンド名（必須）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="例：世田谷公園 サッカー場" />
          </label>

          <label style={label}>
            <span>エリア（必須）</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} style={input} placeholder="例：世田谷・三宿 / 目黒 など" />
          </label>

          <label style={label}>
            <span>住所（任意）</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={input} placeholder="例：東京都世田谷区池尻1-5-27" />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={checkLabel}>
              <input type="checkbox" checked={hasParking} onChange={(e) => setHasParking(e.target.checked)} />
              🚗 駐車場あり
            </label>

            <label style={checkLabel}>
              <input type="checkbox" checked={hasBikeParking} onChange={(e) => setHasBikeParking(e.target.checked)} />
              🚲 駐輪場あり
            </label>
          </div>

          <label style={label}>
            <span>メモ（任意）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, minHeight: 90 }} />
          </label>

          <button className="sh-btn" onClick={save} type="button">
            保存
          </button>
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
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