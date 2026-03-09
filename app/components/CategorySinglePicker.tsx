"use client";

import React from "react";

type Option = { value: string; label: string };

export function CategorySinglePicker({
  title,
  options,
  value,
  onChange,
  disabled,
}: {
  title?: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={box}>
      {title && <div style={titleStyle}>{title}</div>}

      <div style={wrap}>
        {options.map((o) => {
          const active = value === o.value;

          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.value)}
              style={{
                ...btn,
                ...(active ? btnActive : {}),
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div style={helper}>
        ※ 1チームにつき1カテゴリです。  
        1アカウントで複数チーム登録できます。
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 12,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const wrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const btn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
};

const helper: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  marginTop: 8,
};