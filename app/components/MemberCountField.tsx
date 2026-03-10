"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function MemberCountField({
  value,
  onChange,
  disabled = false,
}: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // 数字だけ許可
    const cleaned = raw.replace(/[^\d]/g, "");

    onChange(cleaned);
  };

  return (
    <div style={card}>
      <div style={title}>チーム所属人数（概算人数でも可）</div>

      <label style={label}>
        <span style={labelTitle}>人数</span>

        <input
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="sh-input"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="例：18"
        />
      </label>

      <div style={helperText}>
        ※ 現在このカテゴリで活動している、おおよその人数でOKです。
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  display: "grid",
  gap: 10,
};

const title: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};