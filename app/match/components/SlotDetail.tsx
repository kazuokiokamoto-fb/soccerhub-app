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
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
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
    fontWeight: 900,
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

function categoryTextFromValues(
  values?: string[] | null,
  fallback?: string | null
) {
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

function slotStatusHeroStyle(
  status: "decided" | "open" | "other"
): React.CSSProperties {
  if (status === "decided") {
    return {
      background: "rgba(255,255,255,0.18)",
      border: "1px solid rgba(255,255,255,0.24)",
      color: "#fff",
    };
  }

  if (status === "open") {
    return {
      background: "rgba(219,234,254,0.22)",
      border: "1px solid rgba(255,255,255,0.24)",
      color: "#fff",
    };
  }

  return {
    background: "rgba(243,244,246,0.20)",
    border: "1px solid rgba(255,255,255,0.24)",
    color: "#fff",
  };
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
  onOpenChat: (
    otherTeamId: string,
    slot?: DbSlot | null
  ) => void | Promise<void>;

  slotStatus: "decided" | "open" | "other";

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
    slotStatus,
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
      !!meId &&
      (meId === slot.owner_id || meId === acceptedReq.requester_user_id);
    return isParticipant && !!otherTeamIdForChat;
  }, [acceptedReq, meId, slot.owner_id, otherTeamIdForChat]);

  const requesterTeamName = (teamId: string) => {
    return allTeams.find((t) => t.id === teamId)?.name ?? "チーム未設定";
  };

  const slotCategoryDisplay = slotCategoryText(slot);

  const displayTeam = useMemo(() => {
    if (!acceptedReq) {
      return hostTeam;
    }

    if (isMine) {
      return (
        allTeams.find((t) => t.id === acceptedReq.requester_team_id) || null
      );
    }

    return hostTeam;
  }, [acceptedReq, isMine, hostTeam, allTeams]);

  const displayTeamName = displayTeam?.name?.trim() || "チーム未設定";

  const displayTeamStrength =
    displayTeam?.strength_rank?.trim() ||
    levelToRankLabel(displayTeam?.level) ||
    "未設定";

  const displayTeamMemberCount =
    displayTeam?.member_count != null
      ? Number(displayTeam.member_count)
      : sumRoster(displayTeam?.roster_by_grade);

  const displayTeamArea =
    (displayTeam?.area ?? "").trim() ||
    `${displayTeam?.prefecture ?? ""} ${displayTeam?.city ?? ""}${
      displayTeam?.town ? "・" + displayTeam.town : ""
    }`.trim() ||
    "未設定";

  const displayTeamCategoryText = categoryTextFromTeam(displayTeam);

  return (
    <div style={root}>
      <section style={heroCard}>
        <div style={heroHeader}>
          <div style={heroTitle}>募集詳細</div>
          <div
            style={{
              ...heroBadge,
              ...slotStatusHeroStyle(slotStatus),
            }}
          >
            {slotStatusLabel(slotStatus)}
          </div>
        </div>

        <div style={heroBody}>
          <div style={heroGrid}>
            <div style={heroItem}>
              <div style={heroLabel}>日付</div>
              <div style={heroValue}>{slot.date}</div>
            </div>

            <div style={heroItem}>
              <div style={heroLabel}>時間</div>
              <div style={heroValue}>
                {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
              </div>
            </div>

            <div style={heroItem}>
              <div style={heroLabel}>エリア</div>
              <div style={heroValue}>{slot.area_text ?? slot.area ?? "—"}</div>
            </div>

            <div style={heroItem}>
              <div style={heroLabel}>カテゴリ</div>
              <div style={heroValue}>{slotCategoryDisplay}</div>
            </div>

            <div style={heroItem}>
              <div style={heroLabel}>希望相手</div>
              <div style={heroValue}>
                {(() => {
                  const min = levelToRankLabel(slot.level_min);
                  const max = levelToRankLabel(slot.level_max);
                  if (min && max) return `${min}〜${max}`;
                  if (min) return `${min}以上`;
                  if (max) return `${max}以下`;
                  return "指定なし";
                })()}
              </div>
            </div>

            <div style={heroItem}>
              <div style={heroLabel}>グラウンド</div>
              <div style={heroValue}>
                {venue
                  ? `${venue.name}${venue.address ? ` / ${venue.address}` : ""}`
                  : "未設定"}
              </div>
            </div>
          </div>

          {googleMapUrl ? (
            <div style={{ marginTop: 12 }}>
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
      </section>

      <section style={sectionBox}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionEyebrow}>TEAM</div>
            <div style={sectionTitle}>相手チーム情報</div>
          </div>

          {displayTeam?.id ? (
            <Link href={`/teams/${displayTeam.id}`} className="sh-btn">
              チーム詳細
            </Link>
          ) : null}
        </div>

        <div style={infoGrid}>
          <InfoRow label="チーム名" value={displayTeamName} />
          <InfoRow label="エリア" value={displayTeamArea} />
          <InfoRow label="カテゴリ" value={displayTeamCategoryText} />
          <InfoRow label="強さ" value={displayTeamStrength} />
          <InfoRow
            label="グラウンド提供"
            value={displayTeam?.has_ground ? "あり" : "なし"}
          />
          <InfoRow
            label="駐輪場"
            value={displayTeam?.bike_parking ?? "不明"}
          />
          <InfoRow
            label="駐輪場台数"
            value={displayTeam?.bike_parking_capacity ?? "未設定"}
          />
          <InfoRow
            label="所属人数"
            value={`${displayTeamMemberCount || 0}人`}
          />
          <InfoRow
            label="ユニフォーム"
            value={`${displayTeam?.uniform_main ?? "不明"}（メイン） / ${
              displayTeam?.uniform_sub ?? "不明"
            }（サブ） / ${displayTeam?.uniform_gk ?? "不明"}（GK）`}
          />
          <InfoRow
            label="希望枠"
            value={formatDesiredDates(displayTeam?.desired_dates)}
          />
          <InfoRow
            label="メモ"
            value={displayTeam?.note?.trim() || "なし"}
            multiline
          />
        </div>
      </section>

      {!isMine ? (
        <section style={sectionBox}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>REQUEST</div>
              <div style={sectionTitle}>試合申込</div>
            </div>
          </div>

          {slotStatus === "other" ? (
            <div style={alertClosed}>この募集は他チームで決定済みです。</div>
          ) : slotStatus === "decided" && !myRequest ? (
            <div style={alertClosed}>この募集は決定済みです。</div>
          ) : slot.is_closed && !myRequest ? (
            <div style={alertClosed}>この募集は締切済みです。</div>
          ) : myRequest ? (
            <div style={requestStatusWrap}>
              <div style={statusHeaderCard}>
                <div style={statusHeaderLeft}>
                  <div style={statusHeaderTitle}>現在の申込状況</div>
                  <div style={statusHeaderSub}>
                    送信済みの申込内容を確認できます
                  </div>
                </div>
                <span style={badgeStyle(myRequest.status)}>
                  {requestStatusLabel(myRequest.status)}
                </span>
              </div>

              <div style={requestSummaryBox}>
                <InfoRow
                  label="申込チーム"
                  value={requesterTeamName(myRequest.requester_team_id)}
                />
              </div>

              {myRequest.comment?.trim() ? (
                <div style={messageCard}>
                  <div style={messageCardTitle}>申込コメント</div>
                  <div style={messageCardBody}>{myRequest.comment}</div>
                </div>
              ) : null}

              {myRequest.status === "pending" && slotStatus === "open" ? (
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
            <div style={requestFormWrap}>
              <div style={requestLeadCard}>
                <div style={requestLeadTitle}>この募集に申し込む</div>
                <div style={requestLeadText}>
                  申込み後はチャットでもやり取りできます。
                </div>
              </div>

              <label style={fieldWrap}>
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

              <label style={fieldWrap}>
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
                  disabled={
                    !!loading || myTeams.length === 0 || slotStatus !== "open"
                  }
                >
                  試合申込
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section style={sectionBox}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>MANAGE</div>
              <div style={sectionTitle}>募集管理</div>
            </div>
          </div>

          <div style={requestLeadCard}>
            <div style={requestLeadTitle}>募集状態を変更</div>
            <div style={requestLeadText}>
              現在の状態：{slotStatusLabel(slotStatus)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              className="sh-btn"
              type="button"
              onClick={() => onToggleClosed(slot.id, !slot.is_closed)}
              disabled={!!loading || slotStatus === "decided"}
            >
              {slot.is_closed ? "募集を再開する" : "募集を締切にする"}
            </button>
          </div>
        </section>
      )}

      {canShowChatButton ? (
        <div style={chatActionWrap}>
          <button
            className="sh-btn"
            type="button"
            onClick={() => onOpenChat(otherTeamIdForChat, slot)}
          >
            💬 チャットを開く
          </button>
        </div>
      ) : null}

      {isMine ? (
        <section style={sectionBox}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>REQUESTS</div>
              <div style={sectionTitle}>申込み一覧</div>
            </div>
          </div>

          {requests.length === 0 ? (
            <div style={{ color: "#777" }}>まだ申込みはありません。</div>
          ) : (
            <div style={requestList}>
              {requests.map((r) => (
                <div key={r.id} style={requestRow}>
                  <div style={requestRowTop}>
                    <div style={requestRowLeft}>
                      <div style={requestTeamTitle}>
                        {requesterTeamName(r.requester_team_id)}
                      </div>
                      <div style={requestMetaText}>
                        {new Date(r.created_at).toLocaleString("ja-JP")}
                      </div>
                    </div>

                    <span style={badgeStyle(r.status)}>
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>

                  {r.comment?.trim() ? (
                    <div style={{ ...messageCard, marginTop: 10 }}>
                      <div style={messageCardTitle}>コメント</div>
                      <div style={messageCardBody}>{r.comment}</div>
                    </div>
                  ) : null}

                  <div style={requestActionRow}>
                    <button
                      className="sh-btn sh-btn--primary"
                      type="button"
                      onClick={() => onAccept(r.id)}
                      disabled={
                        r.status !== "pending" ||
                        !!slot.is_closed ||
                        slotStatus !== "open"
                      }
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
        </section>
      ) : null}
    </div>
  );
}

function InfoRow(props: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  const { label, value, multiline = false } = props;

  return (
    <div style={infoRow}>
      <div style={infoLabel}>{label}</div>
      <div
        style={{
          ...infoValue,
          whiteSpace: multiline ? "pre-wrap" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const root: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const heroCard: React.CSSProperties = {
  border: "1px solid #dfeee3",
  borderRadius: 16,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "0 4px 14px rgba(20,92,42,0.05)",
};

const heroHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "12px 14px",
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
};

const heroTitle: React.CSSProperties = {
  color: "#fff",
  fontSize: 16,
  fontWeight: 900,
};

const heroBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const heroBody: React.CSSProperties = {
  padding: 14,
};

const heroGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const heroItem: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
};

const heroLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6d61",
  fontWeight: 800,
};

const heroValue: React.CSSProperties = {
  fontSize: 14,
  color: "#16391f",
  fontWeight: 800,
  lineHeight: 1.7,
};

const sectionBox: React.CSSProperties = {
  padding: 14,
  border: "1px solid #e5ece7",
  borderRadius: 14,
  background: "#fff",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionEyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "#5b6d61",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
  marginTop: 2,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const infoRow: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fafcfb",
  border: "1px solid #edf1ee",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6d61",
  fontWeight: 800,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
};

const alertClosed: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontWeight: 800,
};

const requestStatusWrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const statusHeaderCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 12,
  background: "#f6fbf7",
  border: "1px solid #dfeee3",
};

const statusHeaderLeft: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const statusHeaderTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
};

const statusHeaderSub: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const requestSummaryBox: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid #edf1ee",
};

const requestFormWrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const requestLeadCard: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "linear-gradient(135deg,#f5fbf6 0%,#eef8f0 100%)",
  border: "1px solid #dfeee3",
};

const requestLeadTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#16391f",
};

const requestLeadText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#5b6d61",
  lineHeight: 1.6,
};

const fieldWrap: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  fontWeight: 700,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d7ddd9",
  background: "white",
  fontSize: 14,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d7ddd9",
  background: "white",
  resize: "vertical",
  fontFamily: "inherit",
  fontSize: 14,
  lineHeight: 1.7,
};

const messageCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5ece7",
  background: "#fafcfb",
};

const messageCardTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#5b6d61",
  marginBottom: 6,
};

const messageCardBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
};

const chatActionWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
};

const requestList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const requestRow: React.CSSProperties = {
  padding: 12,
  border: "1px solid #e5ece7",
  borderRadius: 12,
  background: "#fff",
};

const requestRowTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const requestRowLeft: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const requestTeamTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
};

const requestMetaText: React.CSSProperties = {
  color: "#777",
  fontSize: 12,
};

const requestActionRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};