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
    marginLeft: 0,
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

function strengthBadgeStyle(rankText: string) {
  if (rankText === "SS") {
    return {
      background: "#14532d",
      color: "#fff",
      border: "1px solid #14532d",
    } as React.CSSProperties;
  }
  if (rankText === "S") {
    return {
      background: "#166534",
      color: "#fff",
      border: "1px solid #166534",
    } as React.CSSProperties;
  }
  if (rankText === "A") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    } as React.CSSProperties;
  }
  if (rankText === "B") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
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

  return (
    <section style={{ ...card, marginTop: 14 }}>
      <div style={sectionHead}>
        <h2 style={h2}>{selectedYmd} の募集一覧</h2>
        <div style={sectionSub}>{slots.length}件</div>
      </div>

      {slots.length === 0 ? (
        <p style={{ margin: "10px 0 0", color: "#777", lineHeight: 1.8 }}>
          この条件に合う募集はありません。
        </p>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {slots.map((s) => {
            const isMine = !!meId && s.owner_id === meId;

            const hostTeam =
              allTeams.find((t) => t.id === s.host_team_id) ?? null;
            const hostTeamName = hostTeam?.name?.trim() || "チーム未設定";
            const rankText =
              hostTeam?.strength_rank?.trim() ||
              levelLabel(Number(hostTeam?.level ?? 0));

            const slotRequests = requestsForMonth.filter((r) => r.slot_id === s.id);

            const myReq = slotRequests.find(
              (r) =>
                r.requester_team_id === requestTeamId &&
                r.status !== "cancelled"
            );

            const acceptedReq =
              slotRequests
                .filter((r) => r.status === "accepted")
                .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ??
              null;

            const categoryText = slotCategoryText(s);
            const isExpanded = selectedSlotId === s.id;
            const slotStatus = slotStatusResolver(s);

            const displayTeamForLink =
              slotStatus === "decided" && isMine && acceptedReq
                ? allTeams.find((t) => t.id === acceptedReq.requester_team_id) ??
                  hostTeam
                : hostTeam;

            const detailTeam =
              slotStatus === "decided" && isMine && acceptedReq
                ? allTeams.find((t) => t.id === acceptedReq.requester_team_id) ??
                  hostTeam
                : hostTeam;

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
              >
                <div style={slotBubbleRow}>
                  <div style={avatarCircle}>⚽️</div>

                  <div style={slotBubbleMain}>
                    <div style={slotTopRow}>
                      <div style={timeBadge}>
                        {hhmm(s.start_time)}–{hhmm(s.end_time)}
                      </div>

                      <div style={rightBadgeRow}>
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
                            }}
                          >
                            締切
                          </span>
                        ) : null}

                        {!isMine && myReq ? (
                          <span
                            style={{
                              ...statusBadgeStyle(myReq.status),
                            }}
                          >
                            {statusLabel(myReq.status)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div style={teamNameRow}>
                      <span style={teamName}>{hostTeamName}</span>
                      {isMine ? <span style={mineBadge}>あなたの募集</span> : null}
                    </div>

                    <div style={slotSubLine}>
                      📍 {s.area_text ?? s.area ?? "エリア未設定"}
                    </div>

                    <div style={slotSubLine}>
                      🏷 {categoryText}
                    </div>

                    <div style={slotInfoRow}>
                      <div
                        style={{
                          ...rankBadge,
                          ...strengthBadgeStyle(rankText),
                        }}
                      >
                        強さ {rankText}
                      </div>

                      <div style={wantedBadge}>
                        希望相手 {renderWantedLevelRange(s)}
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

                      {displayTeamForLink?.id ? (
                        <Link
                          href={`/teams/${displayTeamForLink.id}?${teamDetailQuery}`}
                          className="sh-btn"
                          style={buttonLink}
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
  borderRadius: 18,
  background: "#fff",
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const sectionSub: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
};

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#16391f",
};

const slotCard: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  background: "#fff",
  overflow: "hidden",
  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
};

const slotCardExpanded: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
  boxShadow: "0 8px 24px rgba(20,92,42,0.08)",
};

const slotBubbleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: 10,
  padding: 14,
  alignItems: "start",
};

const avatarCircle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "#dcfce7",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  flexShrink: 0,
};

const slotBubbleMain: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const slotTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const timeBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
};

const rightBadgeRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
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
  fontWeight: 900,
  color: "#16391f",
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

const slotSubLine: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.6,
};

const slotInfoRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 2,
};

const rankBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const wantedBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f7faf8",
  border: "1px solid #e5ece7",
  color: "#1f5d30",
  fontSize: 12,
  fontWeight: 900,
};

const buttonRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginTop: 4,
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

const detailWrap: React.CSSProperties = {
  padding: "0 14px 14px",
  borderTop: "1px solid #dbe9de",
};