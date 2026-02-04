// app/match/components/SlotDetail.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DbRequest, DbSlot, DbVenue } from "../types";
import { supabase } from "@/app/lib/supabase";

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

// ✅ 常設DM（direct）を開く：thread_type='direct' のRPCを使う前提
async function openDm(myTeamId: string, otherTeamId: string) {
  const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
    my_team_id: myTeamId,
    other_team_id: otherTeamId,
  });
  if (error) throw error;
  return data as string; // thread_id(uuid文字列)
}

export function SlotDetail(props: {
  slot: DbSlot | null;
  isMine: boolean;
  meId: string;
  venues: DbVenue[];
  requests: DbRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;

  // ✅ 追加：自分のチーム一覧（DMで送信チームを決める）
  myTeams: { id: string; name: string }[];

  // ✅ 追加：申込み側で選択中のチームID（なければ先頭）
  requestTeamId: string;
}) {
  const router = useRouter();
  const { slot, isMine, meId, venues, requests, onAccept, onReject, myTeams, requestTeamId } = props;
  if (!slot) return null;

  const venue = venues.find((v) => v.id === slot.venue_id) || null;

  // accepted な request（最新）
  const acceptedReq = useMemo(() => {
    const accepted = requests.filter((r) => r.status === "accepted");
    if (accepted.length === 0) return null;
    return accepted.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] || null;
  }, [requests]);

  // ✅ チャット相手 = この募集枠のホストチーム
  const otherTeamId = slot.host_team_id;

  // ✅ 自分の送信チーム（申込みで選んだチームがあればそれ、なければ先頭）
  const myTeamId = requestTeamId || myTeams?.[0]?.id || "";

  const [opening, setOpening] = useState(false);

  const onOpenChat = async () => {
    if (!meId) return alert("ログインが必要です");
    if (!myTeamId) return alert("自分のチームがありません");
    if (!otherTeamId) return alert("相手チームが不明です");
    if (myTeamId === otherTeamId) return;

    setOpening(true);
    try {
      const threadId = await openDm(myTeamId, otherTeamId);
      router.push(`/chat/${threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(`チャット開始に失敗: ${e?.message ?? "unknown error"}`);
    } finally {
      setOpening(false);
    }
  };

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

      {/* ✅ SlotDetailは「ボタンだけ」：入力欄は一切出さない */}
      {!isMine ? (
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="sh-btn" type="button" onClick={onOpenChat} disabled={opening}>
            {opening ? "チャットを開いています…" : "💬 チャットを開く"}
          </button>
          <span style={{ color: "#777", fontSize: 12 }}>
            ※ チャットは /chat 画面に一本化（ここでは入力しません）
          </span>
        </div>
      ) : null}

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
                  <div style={{ color: "#777", fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</div>
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
                  <div style={{ marginTop: 8, color: "#777", fontSize: 12 }}>※ 承認/却下はホストだけができます</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {acceptedReq ? (
        <div style={{ marginTop: 10, color: "#166534", fontSize: 12 }}>✅ accepted です（チャットは上のボタンから）</div>
      ) : null}
    </div>
  );
}