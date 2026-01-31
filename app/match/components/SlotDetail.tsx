// app/match/components/SlotDetail.tsx
"use client";

import React, { useMemo } from "react";
import type { DbRequest, DbSlot, DbVenue } from "../types";
import { ChatPanel } from "./ChatPanel";

function hhmm(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function badgeStyle(status: DbRequest["status"]): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #eee",
    background:
      status === "accepted"
        ? "#ecfdf3"
        : status === "rejected"
        ? "#fef2f2"
        : status === "cancelled"
        ? "#f3f4f6"
        : "#eff6ff",
    color:
      status === "accepted"
        ? "#166534"
        : status === "rejected"
        ? "#991b1b"
        : status === "cancelled"
        ? "#374151"
        : "#1e3a8a",
    fontSize: 12,
    fontWeight: 800,
  };
}

export function SlotDetail(props: {
  slot: DbSlot | null;
  isMine: boolean;
  meId: string; // ★必須：accepted後チャット表示に使う
  venues: DbVenue[];
  requests: DbRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  const { slot, isMine, meId, venues, requests, onAccept, onReject } = props;
  if (!slot) return null;

  const venue = venues.find((v) => v.id === slot.venue_id) || null;

  // ★ accepted な request（基本1件想定。複数あっても最新を拾う）
  const acceptedReq = useMemo(() => {
    const accepted = requests.filter((r) => r.status === "accepted");
    if (accepted.length === 0) return null;
    // created_at が新しいものを優先
    return accepted.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] || null;
  }, [requests]);

  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>詳細</div>

      <div style={{ color: "#555", lineHeight: 1.8 }}>
        日付：<b>{slot.date}</b>
        <br />
        時間：<b>{hhmm(slot.start_time)}–{hhmm(slot.end_time)}</b>
        <br />
        エリア：{slot.area || "—"} / カテゴリ：{slot.category || "—"}
        <br />
        グラウンド：
        {venue ? `${venue.name}${venue.address ? ` / ${venue.address}` : ""}` : "未設定"}
      </div>

      {/* ===== 申込み一覧 ===== */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          申込み {requests.length ? `（${requests.length}件）` : ""}
        </div>

        {requests.length === 0 ? (
          <div style={{ color: "#777" }}>まだ申込みはありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {requests.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 10,
                  background: "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    status:
                    <span style={badgeStyle(r.status)}>{r.status}</span>
                  </div>
                  <div style={{ color: "#777", fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                  requester_team_id: <b>{r.requester_team_id}</b>
                </div>

                {isMine ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => onAccept(r.id)}
                      disabled={r.status !== "pending"}
                      title={r.status !== "pending" ? "pending のときだけ承認できます" : ""}
                    >
                      承認
                    </button>
                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => onReject(r.id)}
                      disabled={r.status !== "pending"}
                      title={r.status !== "pending" ? "pending のときだけ却下できます" : ""}
                    >
                      却下
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, color: "#777", fontSize: 12 }}>
                    ※ 承認/却下はホストだけができます
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== accepted後：チャット ===== */}
      {acceptedReq ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>💬 連絡・チャット</div>

          <ChatPanel
            request={acceptedReq}
            slotOwnerId={slot.owner_id}
            meId={meId}
            hostTeamId={slot.host_team_id}
            requesterTeamId={acceptedReq.requester_team_id}
            onToast={(t) => t && console.log(t)}
          />
        </div>
      ) : (
        <p style={{ margin: "12px 0 0", color: "#777", fontSize: 12 }}>
          ※ accepted になると、ここにチャットが表示されます。
        </p>
      )}
    </div>
  );
}