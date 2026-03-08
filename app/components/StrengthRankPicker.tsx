"use client";

import React from "react";

export type StrengthRank = "SS" | "S" | "A" | "B" | "C";

type StrengthDef = {
  rank: StrengthRank;
  shortLabel: string;
  title: string;
  bullets: string[];
  note: string;
  stars: string;
};

const STRENGTH_DEFS: StrengthDef[] = [
  {
    rank: "SS",
    shortLabel: "都・県リーグ 1・2部",
    title: "公式戦上位レベルの強度を想定したカテゴリー",
    bullets: [
      "都・県リーグ上位所属",
      "試合強度：★★★★★（非常に高い）",
      "球際・切り替えが速く、戦術理解度が高い",
      "公式戦同等レベルの緊張感ある試合を希望",
    ],
    note: "⭐︎ 「強度の高い実戦形式」を求めるチーム向け",
    stars: "★★★★★",
  },
  {
    rank: "S",
    shortLabel: "都・県リーグ 3・4部",
    title: "公式戦基準の競争力を持つカテゴリー",
    bullets: [
      "都・県リーグ所属",
      "試合強度：★★★★☆（高い）",
      "基礎技術が安定し、組織的な守備・攻撃ができる",
      "上位リーグ昇格を目指すレベル",
    ],
    note: "⭐︎ 「しっかり競り合える相手」を求めるチーム向け",
    stars: "★★★★☆",
  },
  {
    rank: "A",
    shortLabel: "地域リーグ 1・2部",
    title: "育成と競争のバランス型カテゴリー",
    bullets: [
      "地域リーグ上位所属",
      "試合強度：★★★☆☆（中〜やや高）",
      "個人技術向上＋チーム連携を重視",
      "チャレンジマッチにも適したレベル",
    ],
    note: "⭐︎ 「公式戦を想定しつつ育成も重視」するチーム向け",
    stars: "★★★☆☆",
  },
  {
    rank: "B",
    shortLabel: "地域リーグ 3・4部",
    title: "成長重視の実戦経験カテゴリー",
    bullets: [
      "地域リーグ所属",
      "試合強度：★★☆☆☆（やや穏やか）",
      "試合経験を積みながら基礎力を伸ばす段階",
      "バランスの良いマッチング向き",
    ],
    note: "⭐︎ 「経験を積みたい」「自信をつけたい」チーム向け",
    stars: "★★☆☆☆",
  },
  {
    rank: "C",
    shortLabel: "フレンドリー",
    title: "交流・経験重視カテゴリー",
    bullets: [
      "リーグ所属問わず",
      "試合強度：★☆☆☆☆（交流中心）",
      "新チーム編成・初心者中心・交流目的",
      "勝敗よりも経験や交流を重視",
    ],
    note: "⭐︎ 「楽しく真剣に」「幅広い交流」を希望するチーム向け",
    stars: "★☆☆☆☆",
  },
];

export function strengthRankToLegacyLevel(rank: StrengthRank): number {
  switch (rank) {
    case "SS":
      return 9;
    case "S":
      return 7;
    case "A":
      return 5;
    case "B":
      return 3;
    case "C":
      return 1;
    default:
      return 5;
  }
}

export function legacyLevelToStrengthRank(level?: number | null): StrengthRank {
  if (level == null) return "A";
  if (level >= 8) return "SS";
  if (level >= 6) return "S";
  if (level >= 4) return "A";
  if (level >= 2) return "B";
  return "C";
}

export function StrengthRankPicker(props: {
  value: StrengthRank;
  onChange: (rank: StrengthRank) => void;
  disabled?: boolean;
  title?: string;
}) {
  const { value, onChange, disabled, title = "強さ（ランク選択）" } = props;

  const selected = STRENGTH_DEFS.find((x) => x.rank === value) ?? STRENGTH_DEFS[2];

  return (
    <div style={wrap}>
      <div style={head}>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={subText}>ランクを押すと説明が切り替わります</div>
        </div>
      </div>

      <div style={rankGrid}>
        {STRENGTH_DEFS.map((item) => {
          const active = item.rank === value;

          return (
            <button
              key={item.rank}
              type="button"
              onClick={() => onChange(item.rank)}
              disabled={disabled}
              aria-pressed={active}
              style={{
                ...rankBtn,
                ...(active ? rankBtnActive : null),
                ...(disabled ? disabledStyle : null),
              }}
            >
              <div style={rankTopRow}>
                <div style={rankMain}>{item.rank}</div>
                {active ? <span style={selectedBadge}>選択中</span> : null}
              </div>

              <div style={{ ...starsText, color: active ? "#7a5a00" : "#7b7b7b" }}>
                {item.stars}
              </div>

              <div style={{ ...shortLabelText, color: active ? "#145c2a" : "#4e5a53" }}>
                {item.shortLabel}
              </div>
            </button>
          );
        })}
      </div>

      <div style={detailCard}>
        <div style={detailTop}>
          <div style={rankPill}>{selected.rank}</div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={detailShortLabel}>{selected.shortLabel}</div>
            <div style={detailStars}>{selected.stars}</div>
          </div>
        </div>

        <div style={detailTitle}>{selected.title}</div>

        <div style={bulletList}>
          {selected.bullets.map((b) => (
            <div key={b} style={bulletRow}>
              <span style={bulletMark}>•</span>
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div style={noteBox}>{selected.note}</div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const head: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const subText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#66756d",
};

const rankGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 8,
};

const rankBtn: React.CSSProperties = {
  padding: "12px 10px",
  borderRadius: 14,
  border: "1px solid #dfe7e2",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.15s ease",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const rankBtnActive: React.CSSProperties = {
  borderColor: "#bfdcc7",
  background: "#eef7f0",
  boxShadow: "0 6px 14px rgba(20,92,42,0.08)",
};

const rankTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const rankMain: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
  color: "#16391f",
};

const selectedBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 8px",
  minHeight: 22,
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const starsText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const shortLabelText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
};

const detailCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#ffffff",
  lineHeight: 1.75,
  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
};

const detailTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const rankPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 52,
  height: 36,
  padding: "0 14px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
  fontSize: 18,
};

const detailShortLabel: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#16391f",
};

const detailStars: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#7a5a00",
};

const detailTitle: React.CSSProperties = {
  marginTop: 12,
  fontWeight: 800,
  color: "#21342a",
};

const bulletList: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 8,
};

const bulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
  color: "#314137",
};

const bulletMark: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const noteBox: React.CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  color: "#4d3a00",
  fontWeight: 800,
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};