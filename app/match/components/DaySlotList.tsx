// app/match/components/DaySlotList.tsx
"use client";

import React from "react";
import type { DbSlot, DbTeam, DbVenue, DbRequest } from "../types";
import { SlotDetail } from "./SlotDetail";

function hhmm(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function levelLabel(level: number) {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function levelToRankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (!level && level !== 0) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function renderWantedLevelRange(slot: DbSlot) {
  const min = levelToRankLabel(slot.level_min);
  const max = levelToRankLabel(slot.level_max);

  if (min && max) return `${min}〜${max}`;
  if (min) return `${min}以上`;
  if (max) return `${max}以下`;
  return "指定なし";
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
  allTeams: DbTeam[];
  myTeams: DbTeam[];
  meId: string;

  requestsForMonth: DbRequest[];

  selectedSlotId: string;
  onToggleDetail: (slotId: string) => void;

  requestTeamId: string;
  onChangeRequestTeamId: (teamId: string) => void;
  requestComment: string;
  onChangeRequestComment: (v: string) => void;
  onRequestSlot: (slotId: string) => void;

  onCancelMyRequest: (requestId: string) => void;
  onOpenChatWithTeam: (otherTeamId: string) => void | Promise<void>;

  selectedSlot: DbSlot | null;
  selectedHostTeam: DbTeam | null;
  selectedSlotRequests: DbRequest[];
  isMineSlot: boolean;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onToggleClosed: (slotId: string, nextClosed: boolean) => void;

  loading?: boolean;
}) {
  const {
    selectedYmd,
    slots,
    venues,
    allTeams,
    myTeams,
    meId,
    requestsForMonth,
    selectedSlotId,
    onToggleDetail,
    requestTeamId,
    onChangeRequestTeamId,
    requestComment,
    onChangeRequestComment,
    onRequestSlot,
    onCancelMyRequest,
    onOpenChatWithTeam,
    selectedSlot,
    selectedHostTeam,
    selectedSlotRequests,
    isMineSlot,
    onAccept,
    onReject,
    onToggleClosed,
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

            const hostTeam =
              allTeams.find((t) => t.id === s.host_team_id) ?? null;

            const hostTeamName =
              hostTeam?.name?.trim() || "チーム未設定";

            const rankText =
              hostTeam?.strength_rank?.trim() ||
              levelLabel(Number(hostTeam?.level ?? 0));

            const myReq = requestsForMonth.find(
              (r) =>
                r.slot_id === s.id &&
                r.requester_user_id === meId &&
                r.status !== "cancelled"
            );

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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, lineHeight: 1.35 }}>
                      {hhmm(s.start_time)}–{hhmm(s.end_time)} / {s.area_text ?? s.area ?? "エリア未設定"} /{" "}
                      {s.category || "カテゴリ未設定"} {isMine ? "（あなた）" : ""}
                      {s.is_closed ? (
                        <span style={{ ...statusBadgeStyle("cancelled"), marginLeft: 8 }}>締切</span>
                      ) : null}
                      {!isMine && myReq ? (
                        <span style={statusBadgeStyle(myReq.status)}>{myReq.status}</span>
                      ) : null}
                    </div>

                    <div style={hostTeamText}>
                      募集中チーム：<b>{hostTeamName}</b>
                    </div>

                    <div style={rankTextStyle}>
                      強さランク：<b>{rankText}</b>
                    </div>

                    <div style={wantedTextStyle}>
                      希望相手：<b>{renderWantedLevelRange(s)}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="sh-btn" type="button" onClick={() => onToggleDetail(s.id)}>
                      {selectedSlotId === s.id ? "閉じる" : "詳細"}
                    </button>
                  </div>
                </div>

                {selectedSlotId === s.id ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eaeaea" }}>
                    <SlotDetail
                      slot={selectedSlot}
                      hostTeam={selectedHostTeam}
                      allTeams={allTeams}
                      isMine={isMineSlot}
                      meId={meId}
                      venues={venues}
                      requests={selectedSlotRequests}
                      myTeams={myTeams}
                      requestTeamId={requestTeamId}
                      onChangeRequestTeamId={onChangeRequestTeamId}
                      requestComment={requestComment}
                      onChangeRequestComment={onChangeRequestComment}
                      onRequestSlot={onRequestSlot}
                      onCancelMyRequest={onCancelMyRequest}
                      myRequest={myReq ?? null}
                      onAccept={onAccept}
                      onReject={onReject}
                      onToggleClosed={onToggleClosed}
                      onOpenChat={onOpenChatWithTeam}
                      loading={loading}
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

const hostTeamText: React.CSSProperties = {
  marginTop: 8,
  color: "#4b5563",
  fontSize: 14,
  lineHeight: 1.5,
};

const rankTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#4b5563",
  fontSize: 14,
  lineHeight: 1.5,
};

const wantedTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#1f5d30",
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 700,
};