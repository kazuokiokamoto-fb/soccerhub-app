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

export function StrengthRankPicker(props: {
  value: StrengthRank | "";
  onChange: (rank: StrengthRank | "") => void;
  disabled?: boolean;
  title?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const {
    value,
    onChange,
    disabled,
    title = "強さ（ランク選択）",
    allowEmpty = false,
    emptyLabel = "指定なし",
  } = props;

  const selected =
    STRENGTH_DEFS.find((x) => x.rank === value) ?? STRENGTH_DEFS[2];

  return (
    <div style={wrap}>
      <div>
        <div style={titleStyle}>{title}</div>
        <div style={subText}>ランクを押すと説明が切り替わります</div>
      </div>

      <div style={rankList}>
        {allowEmpty && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            style={{
              ...rankRow,
              ...(value === "" ? rankRowActive : {}),
            }}
          >
            <div style={rankLeft}>
              <div style={rankMain}>{emptyLabel}</div>
            </div>

            <div style={rankCenter}>―――</div>

            <div style={rankRight}>条件を限定せず表示</div>

            {value === "" && <span style={selectedBadge}>選択中</span>}
          </button>
        )}

        {STRENGTH_DEFS.map((item) => {
          const active = value === item.rank;

          return (
            <button
              key={item.rank}
              type="button"
              onClick={() => onChange(item.rank)}
              disabled={disabled}
              style={{
                ...rankRow,
                ...(active ? rankRowActive : {}),
              }}
            >
              <div style={rankLeft}>
                <div style={rankMain}>{item.rank}</div>
              </div>

              <div style={rankCenter}>{item.stars}</div>

              <div style={rankRight}>{item.shortLabel}</div>

              {active && <span style={selectedBadge}>選択中</span>}
            </button>
          );
        })}
      </div>

      <div style={detailCard}>
        <div style={detailHeader}>説明</div>

        {value === "" ? (
          <>
            <div style={detailTitle}>指定なし</div>

            <div style={bulletList}>
              <div style={bulletRow}>
                <span style={bulletMark}>•</span>
                <span>強さ条件を設定せずに検索します</span>
              </div>

              <div style={bulletRow}>
                <span style={bulletMark}>•</span>
                <span>より多くのチームや募集枠を表示したいときに使います</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={detailTop}>
              <div style={rankPill}>{selected.rank}</div>

              <div>
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
          </>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 14,
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

const rankList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const rankRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px 100px 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #dfe7e2",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const rankRowActive: React.CSSProperties = {
  background: "#eef7f0",
  borderColor: "#bfdcc7",
};

const rankLeft: React.CSSProperties = {
  fontWeight: 900,
};

const rankCenter: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#7a5a00",
};

const rankRight: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#2f4a39",
};

const rankMain: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const selectedBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#f5c542",
  fontSize: 11,
  fontWeight: 900,
};

const detailCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#ffffff",
};

const detailHeader: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 10,
  color: "#1f5d30",
};

const detailTop: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const rankPill: React.CSSProperties = {
  padding: "4px 14px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
};

const detailShortLabel: React.CSSProperties = {
  fontWeight: 900,
};

const detailStars: React.CSSProperties = {
  fontSize: 12,
  color: "#7a5a00",
};

const detailTitle: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 800,
};

const bulletList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
};

const bulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
};

const bulletMark: React.CSSProperties = {
  fontWeight: 900,
};

const noteBox: React.CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  fontWeight: 700,
};