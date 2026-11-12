"use client";

import React from "react";
import { RankSuggestion } from "@/app/components/RankSuggestion";
import {
  STRENGTH_GUIDES,
  levelToStrengthRank,
  strengthGuideByRank,
  strengthRankToLegacyLevel,
  type StrengthRank,
} from "@/app/match/constants/strengthGuides";

export type { StrengthRank };
export { strengthRankToLegacyLevel, levelToStrengthRank };

export function legacyLevelToStrengthRank(level?: number | null): StrengthRank {
  return levelToStrengthRank(level) || "A";
}

export function StrengthRankPicker(props: {
  value: StrengthRank | "";
  onChange: (rank: StrengthRank | "") => void;
  disabled?: boolean;
  title?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  suggestedRank?: StrengthRank | null;
  onApplySuggested?: (rank: StrengthRank) => void;
}) {
  const {
    value,
    onChange,
    disabled,
    title = "強さ（ランク選択）",
    allowEmpty = false,
    emptyLabel = "指定なし",
    suggestedRank = null,
    onApplySuggested,
  } = props;

  const selected = strengthGuideByRank(value) ?? strengthGuideByRank("A") ?? STRENGTH_GUIDES[2];

  return (
    <div style={wrap}>
      <div style={head}>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={subText}>ランクを押すと説明が切り替わります</div>
        </div>
      </div>

      <RankSuggestion
        suggested={suggestedRank ?? null}
        current={value}
        onApply={onApplySuggested}
        disabled={disabled}
      />

      <div style={rankList}>
        {allowEmpty ? (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            aria-pressed={value === ""}
            style={{
              ...rankRowBtn,
              ...(value === "" ? rankRowBtnActive : null),
              ...(disabled ? disabledStyle : null),
            }}
          >
            <div style={rankRowLeft}>
              <span style={rankCode}>指定なし</span>
              <span style={rankStars}>―――</span>
              <span style={rankLabel}>条件を限定せずに表示</span>
            </div>
            {value === "" ? <span style={selectedBadge}>選択中</span> : null}
          </button>
        ) : null}

        {STRENGTH_GUIDES.map((item) => {
          const active = item.rank === value;

          return (
            <button
              key={item.rank}
              type="button"
              onClick={() => onChange(item.rank)}
              disabled={disabled}
              aria-pressed={active}
              style={{
                ...rankRowBtn,
                ...(active ? rankRowBtnActive : null),
                ...(disabled ? disabledStyle : null),
              }}
            >
              <div style={rankRowLeft}>
                <span style={rankCode}>{item.rank}</span>
                <span style={rankStars}>{item.stars}</span>
                <span style={rankLabel}>{item.short}</span>
              </div>
              {active ? <span style={selectedBadge}>選択中</span> : null}
            </button>
          );
        })}
      </div>

      <div style={detailCard}>
        <div style={detailLabel}>説明</div>

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
              <div style={{ display: "grid", gap: 4 }}>
                <div style={detailShortLabel}>{selected.short}</div>
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

const rankList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const rankRowBtn: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dfe7e2",
  borderRadius: 16,
  background: "#fff",
  padding: "14px 16px",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const rankRowBtnActive: React.CSSProperties = {
  borderColor: "#bfdcc7",
  background: "#eef7f0",
  boxShadow: "0 6px 14px rgba(20,92,42,0.08)",
};

const rankRowLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  minWidth: 0,
};

const rankCode: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
  minWidth: 52,
};

const rankStars: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#7a5a00",
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};

const rankLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#314137",
  lineHeight: 1.5,
};

const selectedBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  minHeight: 28,
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const detailCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#ffffff",
  lineHeight: 1.75,
  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#5b6d61",
  marginBottom: 8,
  letterSpacing: 0.2,
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