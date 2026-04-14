"use client";

import React from "react";
import Link from "next/link";
import type { DbSlot, DbTeam, DbVenue, DbRequest } from "../types";
import { SlotDetail } from "./SlotDetail";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

const DEFAULT_REQUEST_COMMENT =
  "はじめまして。練習試合を希望しています。条件が合えばぜひお願いします。";

function hhmm(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function slotCategoryText(slot: DbSlot | any) {
  if (Array.isArray(slot?.categories) && slot.categories.length > 0) {
    const labels = categoryLabels(slot.categories);
    return labels.length > 0 ? labels.join(" / ") : slot.categories.join(" / ");
  }
  return categoryLabel(slot?.category) || slot?.category || "カテゴリ未設定";
}

function slotStatusLabel(status: "decided" | "open" | "other") {
  if (status === "decided") return "決定済";
  if (status === "open") return "募集中";
  return "他決定";
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

function buildTeamDetailQuery(params: {
  slotId?: string | null;
  date?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set("from", "match-calendar");
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);
  return qs.toString();
}

function requestStatusLabel(status: DbRequest["status"]) {
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

function requestStatusBadgeStyle(status: DbRequest["status"]) {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #eee",
    fontSize: 12,
    fontWeight: 900,
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
  slotStatusResolver: (slot: DbSlot) => "decided" | "open" | "other";
  onToggleDetail: (slotId: string) => void;
  requestTeamId: string;
  onChangeRequestTeamId: (teamId: string) => void;
  requestComment: string;
  onChangeRequestComment: (v: string) => void;
  onRequestSlot: (slotId: string) => void;
  onCancelMyRequest: (requestId: string) => void;
  onOpenChatWithTeam: (
    otherTeamId: string,
    slot?: DbSlot | null
  ) => void | Promise<void>;
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
    onAccept,
    onReject,
    onToggleClosed,
    loading,
  } = props;

  React.useEffect(() => {
    if (!selectedSlotId) return;
    if (requestComment.trim()) return;

    const targetSlot = slots.find((slot) => slot.id === selectedSlotId);
    if (!targetSlot) return;

    const isMine = !!meId && targetSlot.owner_id === meId;
    if (isMine) return;

    onChangeRequestComment(DEFAULT_REQUEST_COMMENT);
  }, [
    selectedSlotId,
    slots,
    meId,
    requestComment,
    onChangeRequestComment,
  ]);

  const sortedSlots = React.useMemo(() => {
    return [...slots].sort((a, b) => {
      const aKey = `${a.date} ${a.start_time}`;
      const bKey = `${b.date} ${b.start_time}`;
      return aKey.localeCompare(bKey);
    });
  }, [slots]);

  return (
    <section style={card} className="ui-card">
      {sortedSlots.length === 0 ? (
        <div style={emptyBox}>
          <div style={emptyTitle} className="ui-title">
            該当する募集がありません
          </div>
          <div style={emptySub} className="ui-meta">
            条件を緩めるか、別の日付を選んでください
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sortedSlots.map((s) => {
            const isMine = !!meId && s.owner_id === meId;

            const slotRequests = requestsForMonth.filter((r) => r.slot_id === s.id);

            const myReq =
              slotRequests.find(
                (r) =>
                  r.requester_team_id === requestTeamId &&
                  r.status !== "cancelled"
              ) ?? null;

            const acceptedReq =
              slotRequests.find((r) => r.status === "accepted") ?? null;

            const hostTeam =
              allTeams.find((t) => t.id === s.host_team_id) ?? null;

            const opponentTeam = acceptedReq
              ? allTeams.find((t) => t.id === acceptedReq.requester_team_id) ?? null
              : null;

            const displayTeam =
              acceptedReq && isMine ? opponentTeam ?? hostTeam : hostTeam;

            const detailTeam =
              acceptedReq && isMine ? opponentTeam ?? hostTeam : hostTeam;

            const slotStatus = slotStatusResolver(s);
            const isExpanded = selectedSlotId === s.id;

            const teamDetailQuery = buildTeamDetailQuery({
              slotId: s.id,
              date: s.date,
            });

            return (
              <div
                key={s.id}
                style={{
                  ...slotCard,
                  ...(isExpanded ? slotCardExpanded : {}),
                }}
                className="ui-card"
              >
                <div style={slotBubbleRow}>
                  <div style={avatarCircle}>⚽️</div>

                  <div style={slotBubbleMain}>
                    <div style={slotTopRow}>
                      <div style={timeBadge}>
                        {hhmm(s.start_time)}–{hhmm(s.end_time)}
                      </div>

                      <div style={badgeRow}>
                        <span
                          style={{
                            ...slotStatusBadge,
                            ...slotStatusBadgeStyle(slotStatus),
                          }}
                        >
                          {slotStatusLabel(slotStatus)}
                        </span>

                        {!isMine && myReq ? (
                          <span style={requestStatusBadgeStyle(myReq.status)}>
                            {requestStatusLabel(myReq.status)}
                          </span>
                        ) : null}

                        {s.is_closed && slotStatus === "open" ? (
                          <span style={requestStatusBadgeStyle("cancelled")}>
                            締切
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div style={teamNameRow}>
                      <div style={teamName} className="ui-title">
                        {displayTeam?.name || "チーム未設定"}
                      </div>
                      {isMine ? <span style={mineBadge}>あなたの募集</span> : null}
                    </div>

                    {slotStatus === "decided" && opponentTeam ? (
                      <div style={decidedNote} className="ui-body">
                        対戦相手：{opponentTeam.name}
                      </div>
                    ) : null}

                    <div style={slotSubLine} className="ui-body">
                      📍 {s.area_text ?? s.area ?? "未設定"}
                    </div>

                    <div style={slotSubLine} className="ui-body">
                      🏷 {slotCategoryText(s)}
                    </div>

                    <div style={buttonRow}>
                      <button
                        type="button"
                        className="sh-btn sh-btn--primary"
                        onClick={() => onToggleDetail(s.id)}
                      >
                        {isExpanded ? "閉じる" : "募集詳細"}
                      </button>

                      {displayTeam?.id ? (
                        <Link
                          href={`/teams/${displayTeam.id}?${teamDetailQuery}`}
                          className="sh-btn sh-btn--ghost"
                          style={teamDetailLink}
                        >
                          チーム詳細
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div style={detailWrap}>
                    <SlotDetail
                      slot={s}
                      slotStatus={slotStatus}
                      hostTeam={detailTeam}
                      allTeams={allTeams}
                      isMine={isMine}
                      meId={meId}
                      venues={venues}
                      requests={slotRequests}
                      myTeams={myTeams}
                      requestTeamId={requestTeamId}
                      onChangeRequestTeamId={onChangeRequestTeamId}
                      requestComment={requestComment}
                      onChangeRequestComment={onChangeRequestComment}
                      onRequestSlot={onRequestSlot}
                      onCancelMyRequest={onCancelMyRequest}
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

const emptyBox: React.CSSProperties = {
  padding: 24,
  textAlign: "center",
};

const emptyTitle: React.CSSProperties = {
  marginBottom: 6,
};

const emptySub: React.CSSProperties = {
  lineHeight: 1.7,
};

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
};

const slotCard: React.CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
};

const slotCardExpanded: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
};

const slotBubbleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: 10,
  padding: 14,
};

const avatarCircle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "#dcfce7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  flexShrink: 0,
};

const slotBubbleMain: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const slotTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
  flexWrap: "wrap",
};

const timeBadge: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  lineHeight: 1.2,
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
};

const slotStatusBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const teamNameRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.4,
};

const mineBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #fde68a",
  fontSize: 11,
  fontWeight: 900,
};

const decidedNote: React.CSSProperties = {
  lineHeight: 1.6,
};

const slotSubLine: React.CSSProperties = {
  lineHeight: 1.6,
};

const buttonRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 2,
};

const teamDetailLink: React.CSSProperties = {
  textAlign: "center",
};

const detailWrap: React.CSSProperties = {
  padding: 12,
  borderTop: "1px solid #e5e7eb",
};