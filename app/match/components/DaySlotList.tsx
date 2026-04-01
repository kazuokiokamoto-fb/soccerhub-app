"use client";

import React from "react";
import Link from "next/link";
import type { DbSlot, DbTeam, DbVenue, DbRequest } from "../types";
import { SlotDetail } from "./SlotDetail";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

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

function statusLabel(status: DbRequest["status"]) {
  switch (status) {
    case "pending":
      return "申込中";
    case "accepted":
      return "成立";
    case "rejected":
      return "見送り";
    case "cancelled":
      return "取消";
    default:
      return status;
  }
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

function slotCategoryText(slot: any) {
  if (Array.isArray(slot?.categories) && slot.categories.length > 0) {
    const labels = categoryLabels(slot.categories);
    return labels.length > 0 ? labels.join(" / ") : slot.categories.join(" / ");
  }

  return categoryLabel(slot?.category) || slot?.category || "カテゴリ未設定";
}

function slotStatusLabel(status: "decided" | "open" | "other") {
  switch (status) {
    case "decided":
      return "決定済";
    case "open":
      return "募集中";
    case "other":
      return "他決定";
    default:
      return "";
  }
}

function slotStatusBadgeStyle(status: "decided" | "open" | "other") {
  if (status === "decided") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    } as React.CSSProperties;
  }

  if (status === "open") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    } as React.CSSProperties;
  }

  return {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "1px solid #e5e7eb",
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
  slotStatusResolver: (slot: DbSlot) => "decided" | "open" | "other";
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
    slotStatusResolver,
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
      <h2 style={h2}>{selectedYmd} の募集一覧</h2>

      {slots.length === 0 ? (
        <p style={{ margin: "10px 0 0", color: "#777" }}>
          この条件に合う募集はありません。
        </p>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {slots.map((s) => {
            const isMine = !!meId && s.owner_id === meId;

            const hostTeam = allTeams.find((t) => t.id === s.host_team_id) ?? null;
            const hostTeamName = hostTeam?.name?.trim() || "チーム未設定";
            const rankText =
              hostTeam?.strength_rank?.trim() ||
              levelLabel(Number(hostTeam?.level ?? 0));

            const myReq = requestsForMonth.find(
              (r) =>
                r.slot_id === s.id &&
                r.requester_team_id === requestTeamId &&
                r.status !== "cancelled"
            );

            const categoryText = slotCategoryText(s);
            const isExpanded = selectedSlotId === s.id;
            const slotStatus = slotStatusResolver(s);

            return (
              <div
                key={s.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: isExpanded ? "2px solid #86efac" : "1px solid #e5e7eb",
                  background: isExpanded ? "#f0fdf4" : "#fff",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={slotHeaderRow}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={slotMainLine}>
                      {hhmm(s.start_time)}–{hhmm(s.end_time)} /{" "}
                      {s.area_text ?? s.area ?? "エリア未設定"} / {categoryText}
                      {isMine ? "（あなた）" : ""}
                    </div>

                    <div style={metaRow}>
                      <span
                        style={{
                          ...slotStatusBadge,
                          ...slotStatusBadgeStyle(slotStatus),
                        }}
                      >
                        {slotStatusLabel(slotStatus)}
                      </span>

                      {s.is_closed && slotStatus === "open" ? (
                        <span
                          style={{
                            ...statusBadgeStyle("cancelled"),
                            marginLeft: 0,
                          }}
                        >
                          締切
                        </span>
                      ) : null}

                      {!isMine && myReq ? (
                        <span
                          style={{
                            ...statusBadgeStyle(myReq.status),
                            marginLeft: 0,
                          }}
                        >
                          {statusLabel(myReq.status)}
                        </span>
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
                </div>

                <div style={buttonRow}>
                  <button
                    className="sh-btn sh-btn--primary"
                    type="button"
                    onClick={() => onToggleDetail(s.id)}
                    style={buttonWide}
                  >
                    {isExpanded ? "閉じる" : "募集詳細"}
                  </button>

                  {hostTeam?.id ? (
                    <Link
                      href={`/teams/${hostTeam.id}`}
                      className="sh-btn"
                      style={buttonLink}
                    >
                      チーム詳細
                    </Link>
                  ) : null}
                </div>

                {isExpanded ? (
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: "1px solid #eaeaea",
                    }}
                  >
                    <SlotDetail
                      slot={selectedSlot}
                      slotStatus={slotStatus}
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

const slotHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const slotMainLine: React.CSSProperties = {
  fontWeight: 900,
  lineHeight: 1.6,
  fontSize: 16,
  color: "#16391f",
};

const metaRow: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const slotStatusBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const hostTeamText: React.CSSProperties = {
  marginTop: 10,
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

const buttonRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const buttonWide: React.CSSProperties = {
  width: "100%",
  textAlign: "center",
};

const buttonLink: React.CSSProperties = {
  width: "100%",
  textAlign: "center",
  boxSizing: "border-box",
};