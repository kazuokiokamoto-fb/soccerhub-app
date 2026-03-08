// app/components/CheckboxGroup.tsx
"use client";

import React from "react";

type Option = { value: string; label: string };

export function CheckboxGroup(props: {
  title?: string;
  options: Option[];
  values: string[];
  onChange: (next: string[]) => void;
  columns?: number;
  disabled?: boolean;
}) {
  const { title, options, values, onChange, columns = 3, disabled } = props;

  const setOne = (value: string, checked: boolean) => {
    const s = new Set(values);
    if (checked) s.add(value);
    else s.delete(value);
    onChange(Array.from(s));
  };

  const all = options.map((o) => o.value);

  const selectAll = () => onChange(all);
  const clearAll = () => onChange([]);

  return (
    <div style={box}>
      {title ? (
        <div style={head}>
          <div style={titleWrap}>
            <div style={titleStyle}>{title}</div>
            <div style={subText}>複数選択できます</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sh-btn sh-btn--ghost"
              onClick={selectAll}
              disabled={disabled}
            >
              全選択
            </button>
            <button
              type="button"
              className="sh-btn"
              onClick={clearAll}
              disabled={disabled}
            >
              クリア
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          ...grid,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {options.map((o) => {
          const checked = values.includes(o.value);

          return (
            <label
              key={o.value}
              style={{
                ...item,
                ...(checked ? itemChecked : null),
                ...(disabled ? itemDisabled : null),
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setOne(o.value, e.target.checked)}
                disabled={disabled}
                style={checkbox}
              />

              <span
                style={{
                  ...labelText,
                  ...(checked ? labelTextChecked : null),
                }}
              >
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const titleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const subText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const grid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const item: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid #edf1ee",
  borderRadius: 14,
  background: "#fafcfb",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const itemChecked: React.CSSProperties = {
  borderColor: "#bfdcc7",
  background: "#eef7f0",
  boxShadow: "0 2px 8px rgba(20,92,42,0.06)",
};

const itemDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const checkbox: React.CSSProperties = {
  width: 18,
  height: 18,
  accentColor: "#1e7f3c",
  flexShrink: 0,
};

const labelText: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  fontWeight: 600,
  lineHeight: 1.4,
};

const labelTextChecked: React.CSSProperties = {
  color: "#145c2a",
  fontWeight: 800,
};