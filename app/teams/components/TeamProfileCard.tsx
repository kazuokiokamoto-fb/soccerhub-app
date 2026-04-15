"use client";

import React from "react";
import { categoryLabel } from "@/app/lib/categories";

export type TeamProfileCardRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  member_count?: number | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  note?: string | null;
};

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

export function teamStrengthLabel(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";
  if (team.strength_rank && String(team.strength_rank).trim()) {
    return String(team.strength_rank).trim();
  }
  return levelToRank(team.level) || "未設定";
}

export function teamStrengthShortDescription(team?: TeamProfileCardRow | null) {
  const rank = teamStrengthLabel(team);

  if (rank === "SS") return "全国・地域トップ級";
  if (rank === "S") return "都・県リーグ上位";
  if (rank === "A") return "都・県リーグ1・2部";
  if (rank === "B") return "地域リーグ・育成中心";
  if (rank === "C") return "交流・入門中心";
  return "未設定";
}

export function teamCategories(team?: TeamProfileCardRow | null) {
  if (!team) return [];
  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories;
  }
  if (team.category) {
    return [team.category];
  }
  return [];
}

export function teamCategoryText(team?: TeamProfileCardRow | null) {
  const categories = teamCategories(team);
  if (categories.length === 0) return "未設定";
  return categories.map((v) => categoryLabel(v) || v).join(" / ");
}

export function teamAreaText(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";

  const joined = [team.prefecture, team.city, team.town]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ・ ");

  return joined || team.area || "未設定";
}

export function uniformText(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";
  return (
    [team.uniform_main, team.uniform_sub]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" / ") || "未設定"
  );
}

export type TeamProfileCardProps = {
  team: TeamProfileCardRow;
  title?: string;
  mine?: boolean;
  onOpenStrengthHelp?: () => void;
  onOpenGeminiSearch?: () => void;
  showGeminiSection?: boolean;
};

export default function TeamProfileCard(props: TeamProfileCardProps) {
  const {
    team,
    title = "チーム詳細",
    mine = false,
    onOpenStrengthHelp,
    onOpenGeminiSearch,
    showGeminiSection = false,
  } = props;

  return (
    <section style={card}>
      <div style={sectionTitle}>{title}</div>

      <div style={teamNameRow}>
        <div style={teamName}>{team.name || "未設定"}</div>
        {mine ? <span style={mineBadge}>自分のチーム</span> : null}
      </div>

      <div style={teamMetaGrid}>
        <div style={teamMetaItem}>
          <div style={metaLabel}>カテゴリ</div>
          <div style={metaValue}>{teamCategoryText(team)}</div>
        </div>

        <div style={teamMetaItem}>
          <div style={metaLabel}>強さ</div>
          <div style={strengthValueRow}>
            <span style={strengthValueMain}>{teamStrengthLabel(team)}</span>
            <span style={strengthValueSub}>
              {teamStrengthShortDescription(team)}
            </span>

            {onOpenStrengthHelp ? (
              <button
                type="button"
                aria-label="強さの説明を見る"
                onClick={onOpenStrengthHelp}
                style={helpButton}
              >
                ?
              </button>
            ) : null}
          </div>
        </div>

        <div style={teamMetaItem}>
          <div style={metaLabel}>エリア</div>
          <div style={metaValue}>{teamAreaText(team)}</div>
        </div>

        <div style={teamMetaItem}>
          <div style={metaLabel}>チーム人数</div>
          <div style={metaValue}>
            {team.member_count != null ? `${team.member_count}人` : "未設定"}
          </div>
        </div>

        <div style={teamMetaItem}>
          <div style={metaLabel}>ユニフォーム</div>
          <div style={metaValue}>{uniformText(team)}</div>
        </div>

        {team.note ? (
          <div style={teamMetaItem}>
            <div style={metaLabel}>チームメモ</div>
            <div style={metaValue}>{team.note}</div>
          </div>
        ) : null}

        {showGeminiSection ? (
          <div style={teamMetaItem}>
            <div style={metaLabel}>Geminiによるチーム情報</div>
            <div style={metaValue}>
              Gemini用の検索文を確認してからコピーできます。
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="sh-btn"
                onClick={onOpenGeminiSearch}
              >
                Geminiでこのチームを調べる
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  borderRadius: 18,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const teamNameRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const mineBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const teamMetaGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 14,
};

const teamMetaItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const metaLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#6b7280",
  lineHeight: 1.4,
};

const metaValue: React.CSSProperties = {
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.7,
};

const strengthValueRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const strengthValueMain: React.CSSProperties = {
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.7,
  fontWeight: 800,
};

const strengthValueSub: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const helpButton: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid #b7dcbf",
  background: "#f3fbf5",
  color: "#1f5d30",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};