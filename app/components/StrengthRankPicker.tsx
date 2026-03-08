"use client";

import React from "react";

export type StrengthRank = "SS" | "S" | "A" | "B" | "C";

type StrengthDef = {
  rank: StrengthRank;
  shortLabel: string;
  title: string;
  bullets: string[];
  note: string;
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
      <div style={{ fontWeight: 800 }}>{title}</div>

      <div style={rankGrid}>
        {STRENGTH_DEFS.map((item) => {
          const active = item.rank === value;
          return (
            <button
              key={item.rank}
              type="button"
              onClick={() => onChange(item.rank)}
              disabled={disabled}
              style={{
                ...rankBtn,
                ...(active ? rankBtnActive : null),
                ...(disabled ? disabledStyle : null),
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{item.rank}</div>
              <div style={{ fontSize: 12, marginTop: 6, color: active ? "#111" : "#666" }}>
                {item.shortLabel}
              </div>
            </button>
          );
        })}
      </div>

      <div style={detailCard}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{selected.rank}</div>
          <div style={{ fontWeight: 800 }}>{selected.shortLabel}</div>
        </div>

        <div style={{ marginTop: 8, fontWeight: 700 }}>{selected.title}</div>

        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {selected.bullets.map((b) => (
            <div key={b} style={bulletRow}>
              <span style={{ fontWeight: 900 }}>•</span>
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, fontWeight: 700 }}>{selected.note}</div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const rankGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 8,
};

const rankBtn: React.CSSProperties = {
  padding: "12px 10px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  textAlign: "center",
};

const rankBtnActive: React.CSSProperties = {
  borderColor: "#111",
  background: "#f7f7f7",
};

const detailCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fff",
  lineHeight: 1.7,
};

const bulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};