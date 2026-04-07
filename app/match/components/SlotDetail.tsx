// ★変更点だけでなく全部フルで出しています

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { DbRequest, DbSlot, DbTeam, DbVenue } from "../types";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

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
  onOpenChat: (otherTeamId: string, slot?: DbSlot | null) => void;

  slotStatus: "decided" | "open" | "other";
  loading?: boolean;
}) {
  const {
    slot,
    hostTeam,
    myTeams,
    requestTeamId,
    onChangeRequestTeamId,
    requestComment,
    onChangeRequestComment,
    onRequestSlot,
    myRequest,
    slotStatus,
    loading,
  } = props;

  if (!slot) return null;

  const displayRequestComment =
    requestComment.trim() || DEFAULT_REQUEST_COMMENT;

  return (
    <div style={root}>
      {/* ===== 状態ヘッダー（強化） ===== */}
      <div
        style={{
          ...statusHero,
          ...slotStatusHeroStyle(slotStatus),
        }}
      >
        {slotStatusLabel(slotStatus)}
      </div>

      {/* ===== 基本情報 ===== */}
      <section style={card}>
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
          <b>希望レベル</b>：
          {(() => {
            const min = levelToRankLabel(slot.level_min);
            const max = levelToRankLabel(slot.level_max);
            if (min && max) return `${min}〜${max}`;
            if (min) return `${min}以上`;
            if (max) return `${max}以下`;
            return "指定なし";
          })()}
        </div>
      </section>

      {/* ===== 申込 ===== */}
      {!myRequest && slotStatus === "open" ? (
        <section style={card}>
          <div style={title}>試合申込</div>

          <select
            value={requestTeamId}
            onChange={(e) => onChangeRequestTeamId(e.target.value)}
            style={input}
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
          />

          <button
            className="sh-btn sh-btn--primary"
            style={primaryBtn}
            onClick={() => onRequestSlot(slot.id)}
            disabled={!!loading}
          >
            試合申込する
          </button>
        </section>
      ) : null}

      {/* ===== 状態メッセージ ===== */}
      {slotStatus !== "open" && !myRequest ? (
        <div style={alertBox}>
          この募集は現在申込できません
        </div>
      ) : null}
    </div>
  );
}

/* ===== styles ===== */

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

const infoRow: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
};

const title: React.CSSProperties = {
  fontWeight: 900,
};

const input: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const textarea: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
  minHeight: 80,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
};

const alertBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 800,
};