"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { DbRequest, DbSlot, DbTeam, DbVenue } from "../types";
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
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function sumRoster(roster?: Record<string, number> | null) {
  if (!roster) return 0;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function formatDesiredDates(desiredDates?: string[] | null) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";
  return arr.join(" / ");
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

function buildGoogleMapUrl(venue: DbVenue | null, slot: DbSlot) {
  const q = [
    venue?.name ?? "",
    venue?.address ?? "",
    venue?.area ?? "",
    slot.area ?? "",
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

function categoryTextFromValues(values?: string[] | null, fallback?: string | null) {
  if (Array.isArray(values) && values.length > 0) {
    const labels = categoryLabels(values);
    return labels.length > 0 ? labels.join(" / ") : values.join(" / ");
  }

  return categoryLabel(fallback) || fallback || "未設定";
}

function slotCategoryText(slot: any) {
  return categoryTextFromValues(slot?.categories, slot?.category);
}

function categoryTextFromTeam(team: DbTeam | null) {
  if (!team) return "未設定";
  return categoryTextFromValues(team.categories, team.category);
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
  myRequest: DbRequest | null;

  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onToggleClosed: (slotId: string, nextClosed: boolean) => void;
  onOpenChat: (otherTeamId: string) => void | Promise<void>;

  loading?: boolean;
}) {
  const {
    slot,
    hostTeam,
    allTeams,
    isMine,
    meId,
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
    loading,
  } = props;

  if (!slot) return null;

  const venue = venues.find((v) => v.id === slot.venue_id) || null;
  const googleMapUrl = buildGoogleMapUrl(venue, slot);

  const acceptedReq = useMemo(() => {
    const accepted = requests.filter((r) => r.status === "accepted");
    if (accepted.length === 0) return null;
    return (
      accepted.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] || null
    );
  }, [requests]);

  const otherTeamIdForChat = useMemo(() => {
    if (!acceptedReq) return "";
    if (isMine) return acceptedReq.requester_team_id;
    return slot.host_team_id;
  }, [acceptedReq, isMine, slot.host_team_id]);

  const canShowChatButton = useMemo(() => {
    if (!acceptedReq) return false;
    const isParticipant =
      !!meId && (meId === slot.owner_id || meId === acceptedReq.requester_user_id);
    return isParticipant && !!otherTeamIdForChat;
  }, [acceptedReq, meId, slot.owner_id, otherTeamIdForChat]);

  const memberCount =
    hostTeam?.member_count != null
      ? Number(hostTeam.member_count)
      : sumRoster(hostTeam?.roster_by_grade);

  const hostArea =
    (hostTeam?.area ?? "").trim() ||
    `${hostTeam?.prefecture ?? ""} ${hostTeam?.city ?? ""}${
      hostTeam?.town ? "・" + hostTeam.town : ""
    }`.trim() ||
    "未設定";

  const requesterTeamName = (teamId: string) => {
    return allTeams.find((t) => t.id === teamId)?.name ?? "チーム未設定";
  };

  const hostStrength =
    hostTeam?.strength_rank?.trim() ||
    levelToRankLabel(hostTeam?.level) ||
    "未設定";

  const slotCategoryDisplay = slotCategoryText(slot);
  const hostCategoryText = categoryTextFromTeam(hostTeam);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 16,
            color: "#1f5d30",
            marginBottom: 8,
          }}
        >
          募集詳細
        </div>

        <div style={{ color: "#555", lineHeight: 1.8 }}>
          日付：<b>{slot.date}</b>
          <br />
          時間：
          <b>
            {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
          </b>
          <br />
          エリア：{slot.area_text ?? slot.area ?? "—"} / カテゴリ：
          {slotCategoryDisplay}
          <br />
          グラウンド：
          {venue
            ? `${venue.name}${venue.address ? ` / ${venue.address}` : ""}`
            : "未設定"}
          <br />
          募集状態：<b>{slot.is_closed ? "締切" : "募集中"}</b>
          <br />
          希望相手：
          <b>
            {(() => {
              const min = levelToRankLabel(slot.level_min);
              const max = levelToRankLabel(slot.level_max);
              if (min && max) return `${min}〜${max}`;
              if (min) return `${min}以上`;
              if (max) return `${max}以下`;
              return "指定なし";
            })()}
          </b>
        </div>

        {googleMapUrl ? (
          <div style={{ marginTop: 10 }}>
            <a
              href={googleMapUrl}
              target="_blank"
              rel="noreferrer"
              className="sh-btn"
              style={{ textDecoration: "none" }}
            >
              📍 Googleマップで開く
            </a>
          </div>
        ) : null}
      </div>

      <div style={sectionBox}>
        <div style={sectionHeader}>
          <div style={sectionTitle}>相手チーム情報</div>
          {hostTeam?.id ? (
            <Link href={`/teams/${hostTeam.id}`} className="sh-btn">
              チーム詳細
            </Link>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <b>チーム名：</b>
            {hostTeam?.name || "未設定"}
          </div>
          <div>
            <b>エリア：</b>
            {hostArea}
          </div>
          <div>
            <b>カテゴリ：</b>
            {hostCategoryText}
          </div>
          <div>
            <b>強さ：</b>
            {hostStrength}
          </div>
          <div>
            <b>グラウンド提供：</b>
            {hostTeam?.has_ground ? "あり" : "なし"}
          </div>
          <div>
            <b>駐輪場：</b>
            {hostTeam?.bike_parking ?? "不明"}
          </div>
          <div>
            <b>駐輪場台数：</b>
            {hostTeam?.bike_parking_capacity ?? "未設定"}
          </div>
          <div>
            <b>所属人数：</b>
            {memberCount || 0}人
          </div>
          <div>
            <b>ユニフォーム：</b>
            {hostTeam?.uniform_main ?? "不明"}（メイン） /{" "}
            {hostTeam?.uniform_sub ?? "不明"}（サブ） /{" "}
            {hostTeam?.uniform_gk ?? "不明"}（GK）
          </div>
          <div>
            <b>希望枠：</b>
            {formatDesiredDates(hostTeam?.desired_dates)}
          </div>
          <div>
            <b>メモ：</b>
            {hostTeam?.note?.trim() || "なし"}
          </div>
        </div>
      </div>

      {!isMine ? (
        <div style={sectionBox}>
          <div style={sectionTitle}>試合申込</div>

          {slot.is_closed ? (
            <div style={{ color: "#991b1b", fontWeight: 700 }}>
              この募集は締切済みです。
            </div>
          ) : myRequest ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>現在の申込状況：</span>
                <span style={badgeStyle(myRequest.status)}>
                  {requestStatusLabel(myRequest.status)}
                </span>
              </div>

              <div>
                <b>申込チーム：</b>
                {requesterTeamName(myRequest.requester_team_id)}
              </div>

              {myRequest.comment?.trim() ? (
                <div style={commentBox}>
                  <div style={commentTitle}>申込コメント</div>
                  <div style={commentBody}>{myRequest.comment}</div>
                </div>
              ) : null}

              {myRequest.status === "pending" ? (
                <div>
                  <button
                    className="sh-btn"
                    type="button"
                    onClick={() => onCancelMyRequest(myRequest.id)}
                    disabled={!!loading}
                  >
                    申込みキャンセル
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={smallLabel}>申込みチーム</span>
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
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={smallLabel}>コメント（任意）</span>
                <textarea
                  value={requestComment}
                  onChange={(e) => onChangeRequestComment(e.target.value)}
                  placeholder="例：交流重視でぜひお願いします。"
                  style={textarea}
                  disabled={!!loading}
                />
              </label>

              <div>
                <button
                  className="sh-btn sh-btn--primary"
                  type="button"
                  onClick={() => onRequestSlot(slot.id)}
                  disabled={!!loading || myTeams.length === 0}
                >
                  試合申込
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={sectionBox}>
          <div style={sectionTitle}>募集管理</div>

          <button
            className="sh-btn"
            type="button"
            onClick={() => onToggleClosed(slot.id, !slot.is_closed)}
            disabled={!!loading}
          >
            {slot.is_closed ? "募集を再開する" : "募集を締切にする"}
          </button>
        </div>
      )}

      {canShowChatButton ? (
        <div>
          <button
            className="sh-btn"
            type="button"
            onClick={() => onOpenChat(otherTeamIdForChat)}
          >
            💬 チャットを開く
          </button>
        </div>
      ) : null}

      {isMine ? (
        <div style={sectionBox}>
          <div style={sectionTitle}>申込み一覧</div>

          {requests.length === 0 ? (
            <div style={{ color: "#777" }}>まだ申込みはありません。</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {requests.map((r) => (
                <div key={r.id} style={requestRow}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <b>{requesterTeamName(r.requester_team_id)}</b>
                      <span style={badgeStyle(r.status)}>
                        {requestStatusLabel(r.status)}
                      </span>
                    </div>
                    <div style={{ color: "#777", fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleString("ja-JP")}
                    </div>
                  </div>

                  {r.comment?.trim() ? (
                    <div style={{ ...commentBox, marginTop: 8 }}>
                      <div style={commentTitle}>コメント</div>
                      <div style={commentBody}>{r.comment}</div>
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => onAccept(r.id)}
                      disabled={r.status !== "pending" || !!slot.is_closed}
                    >
                      承認
                    </button>
                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => onReject(r.id)}
                      disabled={r.status !== "pending"}
                    >
                      却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const sectionBox: React.CSSProperties = {
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  fontWeight: 700,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  resize: "vertical",
  fontFamily: "inherit",
  fontSize: 14,
};

const requestRow: React.CSSProperties = {
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 10,
  background: "white",
};

const commentBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const commentTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const commentBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};