// app/components/CheckboxGroup.tsx
"use client";

import React from "react";

type Option = { value: string; label: string };

export function CheckboxGroup(props: {
  title?: string;
  options: Option[];
  values: string[]; // 選択中
  onChange: (next: string[]) => void;
  columns?: number; // 表示の列数（2とか3）
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
          <div style={titleStyle}>{title}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="sh-btn" onClick={selectAll} disabled={disabled}>
              全選択
            </button>
            <button type="button" className="sh-btn" onClick={clearAll} disabled={disabled}>
              クリア
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ ...grid, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const checked = values.includes(o.value);
          return (
            <label key={o.value} style={{ ...item, opacity: disabled ? 0.6 : 1 }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setOne(o.value, e.target.checked)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>{o.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
};

const grid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const item: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid #f0f0f0",
  borderRadius: 12,
  background: "#fafafa",
};