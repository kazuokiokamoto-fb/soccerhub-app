"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { VENUE_KEY } from "../lib/keys";
import { safeLoad, safeSave } from "../lib/storage";
import { Venue } from "../lib/types";
import { RequireAuth } from "../lib/guard";
import { useAuth } from "../lib/auth";

export default function VenuesPage() {
  const { user, isAdmin } = useAuth();

  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    const v = safeLoad<Venue[]>(VENUE_KEY, []);
    setVenues(Array.isArray(v) ? v : []);
  }, []);

  const remove = (id: string) => {
    if (!isAdmin) {
      alert("削除は管理者のみ可能です。");
      return;
    }
    const ok = confirm("削除しますか？");
    if (!ok) return;

    const next = venues.filter((v) => v.id !== id);
    setVenues(next);
    safeSave(VENUE_KEY, next);
  };

  return (
    <RequireAuth>
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>グラウンド一覧</h1>
        <p style={{ color: "#555", marginTop: 6 }}>
          localStorage のグラウンドデータを表示します（後で地図や検索を足します）。
        </p>

        <p style={{ color: "#777", marginTop: 6, fontSize: 13 }}>
          ログイン中：{user?.email} {isAdmin ? "（管理者）" : ""}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/" className="sh-btn">
            トップへ
          </Link>

          <Link href="/venues/new" className="sh-btn">
            ＋ グラウンド登録へ
          </Link>
        </div>

        {!isAdmin && (
          <p style={{ color: "#888", marginTop: 10, fontSize: 13 }}>
            ※削除は管理者のみ表示・実行できます
          </p>
        )}

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {venues.length === 0 ? (
            <div style={{ ...card, background: "#fafafa", color: "#777" }}>
              まだグラウンドがありません。「グラウンド登録へ」から追加してください。
            </div>
          ) : (
            venues.map((v) => (
              <div key={v.id} style={{ ...card, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>{v.name}</div>

                  {isAdmin ? (
                    <button
                      className="sh-btn sh-btn--danger"
                      onClick={() => remove(v.id)}
                      type="button"
                    >
                      削除
                    </button>
                  ) : null}
                </div>

                <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                  {v.area}
                  {v.address ? ` / ${v.address}` : ""}
                </div>

                <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                  🚗 {v.hasParking ? "あり" : "なし"} / 🚲{" "}
                  {v.hasBikeParking ? "あり" : "なし"}
                </div>

                {v.note ? (
                  <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                    メモ：{v.note}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </main>
    </RequireAuth>
  );
}

const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fff",
};