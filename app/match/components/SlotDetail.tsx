// app/match/components/SlotDetail.tsx
"use client";

import React, { useMemo } from "react";
import type { DbRequest, DbSlot, DbVenue } from "../types";

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
  meId: string;
  venues: DbVenue[];
  requests: DbRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;

  // ✅ 追加：/chat/[threadId] を開く（親がRPC→router.push）
  onOpenChat: (otherTeamId: string) => void | Promise<void>;
}) {
  const { slot, isMine, meId, venues, requests, onAccept, onReject, onOpenChat } = props;
  if (!slot) return null;

  const venue = venues.find((v) => v.id === slot.venue_id) || null;

  // accepted を最新優先で1件拾う
  const acceptedReq = useMemo(() => {
    const accepted = requests.filter((r) => r.status === "accepted");
    if (accepted.length === 0) return null;
    return accepted.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] || null;
  }, [requests]);

  // ✅ この枠で「自分が相手にチャットする」ための otherTeamId
  const otherTeamIdForChat = useMemo(() => {
    if (!acceptedReq) return "";
    // 自分がホストなら相手は requesterTeam
    if (isMine) return acceptedReq.requester_team_id;
    // 自分が申込側なら相手は hostTeam
    return slot.host_team_id;
  }, [acceptedReq, isMine, slot.host_team_id]);

  const canShowChatButton = useMemo(() => {
    if (!acceptedReq) return false;
    // 参加者以外には出さない（安全）
    const isParticipant = meId && (meId === slot.owner_id || meId === acceptedReq.requester_user_id);
    return !!isParticipant && !!otherTeamIdForChat;
  }, [acceptedReq, meId, slot.owner_id, otherTeamIdForChat]);

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

      {/* ✅ accepted の時だけ「チャットを開く」ボタン */}
      {canShowChatButton ? (
        <div style={{ marginTop: 14 }}>
          <button className="sh-btn" type="button" onClick={() => onOpenChat(otherTeamIdForChat)}>
            💬 チャットを開く
          </button>
          <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
            ※ チャットは /chat 画面に一本化しています
          </div>
        </div>
      ) : (
        <p style={{ margin: "12px 0 0", color: "#777", fontSize: 12 }}>
          ※ accepted になると「チャットを開く」ボタンが表示されます。
        </p>
      )}

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
    </div>
  );
}