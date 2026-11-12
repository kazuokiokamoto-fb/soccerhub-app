"use client";

import type { CSSProperties } from "react";
import {
  STRENGTH_GUIDES,
  strengthGuideByRank,
  type StrengthRank,
} from "@/app/match/constants/strengthGuides";

export function RankSuggestion({
  suggested,
  current,
  onApply,
  disabled = false,
  hint = "目安です。別のランクでも大丈夫です。",
}: {
  suggested: StrengthRank | null;
  current?: string | null;
  onApply?: (rank: StrengthRank) => void;
  disabled?: boolean;
  hint?: string;
}) {
  if (!suggested) return null;
  const guide = strengthGuideByRank(suggested);
  const same = String(current ?? "").trim() === suggested;

  return (
    <div style={box} role="status">
      <p style={line}>
        所属からの目安: <strong style={rank}>{suggested}</strong>
      </p>
      {guide ? <p style={short}>{guide.short}</p> : null}
      {same ? (
        <p style={sameText}>いまの強さと同じです</p>
      ) : onApply ? (
        <button
          type="button"
          className="sh-btn"
          disabled={disabled}
          onClick={() => onApply(suggested)}
        >
          このランクにする
        </button>
      ) : null}
      <p style={hintStyle}>{hint}</p>
    </div>
  );
}

export function StrengthRankSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: StrengthRank | "";
  onChange: (rank: StrengthRank) => void;
  disabled?: boolean;
}) {
  const guide = strengthGuideByRank(value);

  return (
    <>
      <select
        className="sh-select"
        value={value}
        disabled={disabled}
        aria-label="強さ"
        onChange={(event) => onChange(event.target.value as StrengthRank)}
      >
        {STRENGTH_GUIDES.map((item) => (
          <option key={item.rank} value={item.rank}>
            {item.rank}
          </option>
        ))}
      </select>
      {guide ? <span style={caption}>{guide.short}</span> : null}
    </>
  );
}

const box: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  borderRadius: 16,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
};

const line: CSSProperties = {
  margin: 0,
  color: "#3a2b00",
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.5,
};

const rank: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const short: CSSProperties = {
  margin: 0,
  color: "#4d3a00",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
};

const sameText: CSSProperties = {
  margin: 0,
  color: "#3f6212",
  fontSize: 14,
  fontWeight: 800,
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#6b5a28",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5,
};

const caption: CSSProperties = {
  display: "block",
  marginTop: 6,
  color: "#3f4d45",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.4,
};
