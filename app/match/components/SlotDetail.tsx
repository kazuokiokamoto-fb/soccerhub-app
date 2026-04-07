"use client";

import React, { useMemo } from "react";
import type { DbRequest, DbSlot, DbTeam, DbVenue } from "../types";
import { categoryLabel } from "@/app/lib/categories";

const DEFAULT_REQUEST_COMMENT =
  "はじめまして。練習試合を希望しています。条件が合えばぜひお願いします。";

function hhmm(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function levelToRankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function slotStatusLabel(status: "decided" | "open" | "other") {
  if (status === "decided") return "試合成立";
  if (status === "open") return "募集中";
  return "他チームで決定";
}

function slotStatusHeroStyle(
  status: "decided" | "open" | "other"
): React.CSSProperties {
  if (status === "decided") {
    return {
      background: "#166534",
      color: "#fff",
    };
  }

  if (status === "open") {
    return {
      background: "#1d4ed8",
      color: "#fff",
    };
  }

  return {
    background: "#6b7280",
    color: "#fff",
  };
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

function requestStatusBadgeStyle(status: DbRequest["status"]): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
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
  };
}

function teamNameById(allTeams: DbTeam[], teamId: string) {
  return allTeams.find((t) => t.id === teamId)?.name ?? "チーム未設定";
}

function buildVenueText(slot: DbSlot, venues: DbVenue[]) {
  const venue = venues.find((v) => v.id === slot.venue_id) ?? null;
  if (!venue) return "未設定";

  const parts = [venue.name, venue.address].filter(Boolean);
  return parts.join(" / ") || "未設定";
}

function buildWantedLevelText(slot: DbSlot) {
  const min = levelToRankLabel(slot.level_min);
  const max = levelToRankLabel(slot.level_max);
  if (min && max) return `${min}〜${max}`;
  if (min) return `${min}以上`;
  if (max) return `${max}以下`;
  return "指定なし";
}

export function SlotDetail(props: {
  slot: DbSlot | null;
  hostTeam: DbTeam | null;
  allTeams: DbTeam[];
  isMine: boolean;
  meId: string;
  venues: DbVenue[];
  requests: DbRequest[];

  myTeams: DbTeam[];
  requestTeamId: string;
  onChangeRequestTeamId: (teamId: string) => void;
  requestComment: string;
  onChangeRequestComment: (v: string) => void;
  onRequestSlot: (slotId: string) => void;
  onCancelMyRequest: (requestId: string) => void;
  myRequest?: DbRequest | null;

  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onToggleClosed: (slotId: string, nextClosed: boolean) => void;
  onOpenChat: (otherTeamId: string, slot?: DbSlot | null) => void | Promise<void>;

  slotStatus: "decided" | "open" | "other";
  loading?: boolean;
}) {
  const {
    slot,
    hostTeam,
    allTeams,
    isMine,
    venues,
    requests,
    myTeams,
    requestTeamId,
    onChangeRequestTeamId,
    requestComment,
    onChangeRequestComment,
    onRequestSlot,
    onCancelMyRequest,
    myRequest,
    onAccept,
    onReject,
    onToggleClosed,
    onOpenChat,
    slotStatus,
    loading,
  } = props;

  if (!slot) return null;

  const resolvedMyRequest =
    myRequest ??
    requests.find(
      (r) =>
        r.slot_id === slot.id &&
        r.requester_team_id === requestTeamId &&
        r.status !== "cancelled"
    ) ??
    null;

  const acceptedRequest = useMemo(() => {
    return requests.find((r) => r.status === "accepted") ?? null;
  }, [requests]);

  const displayRequestComment =
    requestComment.trim() || DEFAULT_REQUEST_COMMENT;

  const wantedLevelText = buildWantedLevelText(slot);
  const venueText = buildVenueText(slot, venues);

  const chatTargetTeamId = useMemo(() => {
    if (!acceptedRequest) return "";

    if (isMine) {
      return acceptedRequest.requester_team_id;
    }

    return slot.host_team_id;
  }, [acceptedRequest, isMine, slot.host_team_id]);

  const canOpenChat = !!acceptedRequest && !!chatTargetTeamId;

  return (
    <div style={root}>
      <div
        style={{
          ...statusHero,
          ...slotStatusHeroStyle(slotStatus),
        }}
      >
        {slotStatusLabel(slotStatus)}
      </div>

      <section style={card}>
        <div style={sectionTitle}>募集情報</div>

        <div style={infoRow}>
          <b>日時</b>：{slot.date} {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
        </div>

        <div style={infoRow}>
          <b>エリア</b>：{slot.area_text ?? slot.area ?? "未設定"}
        </div>

        <div style={infoRow}>
          <b>カテゴリ</b>：
          {categoryLabel(slot.category) || slot.category || "未設定"}
        </div>

        <div style={infoRow}>
          <b>希望レベル</b>：{wantedLevelText}
        </div>

        <div style={infoRow}>
          <b>会場</b>：{venueText}
        </div>

        <div style={infoRow}>
          <b>募集チーム</b>：{hostTeam?.name ?? "チーム未設定"}
        </div>

        <div style={infoRow}>
          <b>募集状態</b>：{slot.is_closed ? "締切" : "受付中"}
        </div>
      </section>

      {!isMine && !resolvedMyRequest && slotStatus === "open" ? (
        <section style={card}>
          <div style={sectionTitle}>試合申込</div>

          <select
            value={requestTeamId}
            onChange={(e) => onChangeRequestTeamId(e.target.value)}
            style={input}
            disabled={!!loading || myTeams.length === 0}
          >
            {myTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <textarea
            value={displayRequestComment}
            onChange={(e) => onChangeRequestComment(e.target.value)}
            style={textarea}
            disabled={!!loading}
          />

          <button
            className="sh-btn sh-btn--primary"
            style={primaryBtn}
            onClick={() => onRequestSlot(slot.id)}
            disabled={!!loading || myTeams.length === 0}
          >
            試合申込する
          </button>
        </section>
      ) : null}

      {!isMine && resolvedMyRequest ? (
        <section style={card}>
          <div style={sectionTitle}>申込状況</div>

          <div style={statusRow}>
            <span style={requestStatusBadgeStyle(resolvedMyRequest.status)}>
              {requestStatusLabel(resolvedMyRequest.status)}
            </span>
          </div>

          <div style={infoRow}>
            <b>コメント</b>：
            {resolvedMyRequest.comment?.trim() || "なし"}
          </div>

          {resolvedMyRequest.status === "pending" && slotStatus === "open" ? (
            <button
              type="button"
              className="sh-btn"
              style={secondaryBtn}
              onClick={() => onCancelMyRequest(resolvedMyRequest.id)}
              disabled={!!loading}
            >
              申込み撤回
            </button>
          ) : null}
        </section>
      ) : null}

      {!isMine && slotStatus !== "open" && !resolvedMyRequest ? (
        <div style={alertBox}>この募集は現在申込できません</div>
      ) : null}

      {isMine ? (
        <section style={card}>
          <div style={sectionTitle}>募集管理</div>

          <button
            type="button"
            className="sh-btn"
            style={secondaryBtn}
            onClick={() => onToggleClosed(slot.id, !slot.is_closed)}
            disabled={!!loading || slotStatus === "decided"}
          >
            {slot.is_closed ? "募集を再開する" : "募集を締切にする"}
          </button>
        </section>
      ) : null}

      {isMine ? (
        <section style={card}>
          <div style={sectionTitle}>申込み一覧</div>

          {requests.length === 0 ? (
            <div style={emptyText}>まだ申込みはありません</div>
          ) : (
            <div style={requestList}>
              {requests.map((r) => (
                <div key={r.id} style={requestCard}>
                  <div style={requestHeader}>
                    <div style={requestTeamName}>
                      {teamNameById(allTeams, r.requester_team_id)}
                    </div>
                    <span style={requestStatusBadgeStyle(r.status)}>
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>

                  <div style={requestCommentBox}>
                    {r.comment?.trim() || "コメントなし"}
                  </div>

                  {r.status === "pending" && slotStatus === "open" ? (
                    <div style={requestActionRow}>
                      <button
                        type="button"
                        className="sh-btn sh-btn--primary"
                        onClick={() => onAccept(r.id)}
                        disabled={!!loading}
                      >
                        承認
                      </button>

                      <button
                        type="button"
                        className="sh-btn"
                        onClick={() => onReject(r.id)}
                        disabled={!!loading}
                      >
                        却下
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canOpenChat ? (
        <button
          type="button"
          className="sh-btn"
          style={chatBtn}
          onClick={() => onOpenChat(chatTargetTeamId, slot)}
          disabled={!!loading}
        >
          チャットを開く
        </button>
      ) : null}
    </div>
  );
}

const root: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const statusHero: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  fontWeight: 900,
  textAlign: "center",
};

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  color: "#16391f",
};

const infoRow: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
};

const input: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
};

const textarea: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
  minHeight: 80,
  resize: "vertical",
  fontFamily: "inherit",
  fontSize: 14,
  lineHeight: 1.6,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
};

const secondaryBtn: React.CSSProperties = {
  width: "100%",
};

const chatBtn: React.CSSProperties = {
  width: "100%",
};

const alertBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 800,
};

const statusRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const requestList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const requestCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  display: "grid",
  gap: 8,
};

const requestHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const requestTeamName: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
};

const requestCommentBox: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#444",
  whiteSpace: "pre-wrap",
};

const requestActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyText: React.CSSProperties = {
  fontSize: 14,
  color: "#666",
  lineHeight: 1.6,
};