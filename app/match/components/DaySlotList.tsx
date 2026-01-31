// app/match/components/DaySlotList.tsx
"use client";

import React from "react";
import type { DbSlot, DbTeam, DbVenue, DbRequest } from "../types";
import { SlotDetail } from "./SlotDetail";

function hhmm(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function statusBadgeStyle(status: DbRequest["status"]) {
  return {
    marginLeft: 8,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #eee",
    fontSize: 12,
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
  } as React.CSSProperties;
}

export function DaySlotList(props: {
  selectedYmd: string;
  slots: DbSlot[];
  venues: DbVenue[];
  myTeams: DbTeam[];
  meId: string;

  // ★月内のrequests全部（この中から「自分の申込み済み」を探す）
  requestsForMonth: DbRequest[];

  selectedSlotId: string;
  onToggleDetail: (slotId: string) => void;

  requestTeamId: string;
  onChangeRequestTeamId: (teamId: string) => void;
  onRequestSlot: (slotId: string) => void;

  // ★追加：自分の申込みキャンセル
  onCancelMyRequest: (requestId: string) => void;

  selectedSlot: DbSlot | null;
  selectedSlotRequests: DbRequest[];
  isMineSlot: boolean;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;

  loading?: boolean;
}) {
  const {
    selectedYmd,
    slots,
    venues,
    myTeams,
    meId,
    requestsForMonth,
    selectedSlotId,
    onToggleDetail,
    requestTeamId,
    onChangeRequestTeamId,
    onRequestSlot,
    onCancelMyRequest,
    selectedSlot,
    selectedSlotRequests,
    isMineSlot,
    onAccept,
    onReject,
    loading,
  } = props;

  return (
    <section style={{ ...card, marginTop: 14 }}>
      <h2 style={h2}>{selectedYmd} の募集中</h2>

      {slots.length === 0 ? (
        <p style={{ margin: "10px 0 0", color: "#777" }}>この日はまだ募集がありません。</p>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {slots.map((s) => {
            const isMine = !!meId && s.owner_id === meId;
            const venue = venues.find((v) => v.id === s.venue_id) || null;

            // ★自分がこの枠に申込み済みか？（cancelled は除外して「いま有効な申込み」だけ）
            const myReq = requestsForMonth.find(
              (r) => r.slot_id === s.id && r.requester_user_id === meId && r.status !== "cancelled"
            );

            // 申込みボタン無効条件
            const disableRequest = !!loading || myTeams.length === 0 || isMine || !!myReq;

            const requestBtnTitle = isMine
              ? "自分の募集には申込みできません"
              : myReq
              ? "申込み済みです"
              : myTeams.length === 0
              ? "先に自分のチームを作ってください"
              : "";

            // ★キャンセルできるのは「自分の申込みが pending」のときだけ（accepted/rejectedはキャンセル不可）
            const canCancel = !!myReq && myReq.status === "pending";

            return (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: selectedSlotId === s.id ? "2px solid #86efac" : "1px solid #eee",
                  background: selectedSlotId === s.id ? "#f0fdf4" : "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900, lineHeight: 1.35 }}>
                    {hhmm(s.start_time)}–{hhmm(s.end_time)} / {s.area || "エリア未設定"} /{" "}
                    {s.category || "カテゴリ未設定"} {isMine ? "（あなた）" : ""}
                    {/* ★申込み済みバッジ（自分の枠ではない時だけ） */}
                    {!isMine && myReq ? (
                      <span style={statusBadgeStyle(myReq.status)}>{myReq.status}</span>
                    ) : null}
                  </div>

                  <button className="sh-btn" type="button" onClick={() => onToggleDetail(s.id)}>
                    {selectedSlotId === s.id ? "閉じる" : "詳細"}
                  </button>
                </div>

                <div style={{ marginTop: 6, color: "#666", lineHeight: 1.6 }}>
                  グラウンド：
                  {venue ? `${venue.name}${venue.area ? `（${venue.area}）` : ""}` : "未設定"}
                </div>

                {/* 申込みUI（自分の枠じゃない時だけ） */}
                {!isMine ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={{ display: "grid", gap: 6, flex: "1 1 220px" }}>
                      <span style={{ fontSize: 12, color: "#555" }}>申込みチーム</span>
                      <select
                        value={requestTeamId}
                        onChange={(e) => onChangeRequestTeamId(e.target.value)}
                        style={input}
                        disabled={!!loading || myTeams.length === 0 || !!myReq}
                        title={myReq ? "申込み済みのため変更できません" : ""}
                      >
                        {myTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="sh-btn"
                        type="button"
                        onClick={() => onRequestSlot(s.id)}
                        disabled={disableRequest}
                        title={requestBtnTitle}
                      >
                        {myReq ? `申込み済み（${myReq.status}）` : "対戦申込み（pending）"}
                      </button>

                      {/* ★キャンセルボタン（自分の申込みが pending のときだけ表示） */}
                      {canCancel ? (
                        <button
                          className="sh-btn"
                          type="button"
                          onClick={() => onCancelMyRequest(myReq!.id)}
                          disabled={!!loading}
                          title="申込みを取り消します"
                        >
                          申込みキャンセル
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* 詳細 */}
                {selectedSlotId === s.id ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eaeaea" }}>
                    <SlotDetail
                      slot={selectedSlot}
                      isMine={isMineSlot}
                      meId={meId}
                      venues={venues}
                      requests={selectedSlotRequests}
                      onAccept={onAccept}
                      onReject={onReject}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fff",
};

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};