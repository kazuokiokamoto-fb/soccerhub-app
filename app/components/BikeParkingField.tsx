"use client";

import React from "react";

export function BikeParkingField({
  bikeParking,
  setBikeParking,
  bikeParkingCapacity,
  setBikeParkingCapacity,
  capacityOptions,
  disabled,
}: any) {
  return (
    <div style={box}>
      <div style={title}>🚲 駐輪場</div>

      <div style={choiceWrap}>
        {(["なし", "あり"] as const).map((v) => {
          const active = bikeParking === v;

          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setBikeParking(v);
                if (v === "なし") setBikeParkingCapacity("");
              }}
              style={{
                ...choiceBtn,
                ...(active ? choiceBtnActive : {}),
                ...(disabled ? disabledStyle : {}),
              }}
              disabled={disabled}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div style={helperText}>
        {bikeParking === "あり"
          ? "駐輪可能台数（目安）を選択してください。"
          : "駐輪場が無い場合は「なし」を選択してください。"}
      </div>

      {bikeParking === "あり" && (
        <>
          <div style={statusRow}>
            <div style={statusLabel}>駐輪可能台数</div>
            <div style={statusText}>
              {bikeParkingCapacity
                ? `選択中：${capacityOptions.find((opt: any) => opt.value === bikeParkingCapacity)?.label ?? bikeParkingCapacity}`
                : `候補 ${capacityOptions.length} 件`}
            </div>
          </div>

          <div style={helperText}>※ 概算でOKです。</div>

          <div style={listBox}>
            {capacityOptions.map((opt: any) => {
              const active = bikeParkingCapacity === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBikeParkingCapacity(opt.value)}
                  style={{
                    ...rowBtn,
                    ...(active ? rowBtnActive : {}),
                    ...(disabled ? disabledStyle : {}),
                  }}
                  disabled={disabled}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 12,
  display: "grid",
  gap: 10,
};

const title: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const choiceWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const choiceBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  fontWeight: 800,
  cursor: "pointer",
};

const choiceBtnActive: React.CSSProperties = {
  background: "#145c2a",
  borderColor: "#145c2a",
  color: "#fff",
  boxShadow: "0 6px 14px rgba(20,92,42,0.14)",
};

const statusRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap",
};

const statusLabel: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const statusText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};

const listBox: React.CSSProperties = {
  display: "grid",
  gap: 6,
  maxHeight: 148,
  overflowY: "auto",
  paddingRight: 2,
};

const rowBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #edf1ee",
  background: "#fff",
  color: "#23412c",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
};

const rowBtnActive: React.CSSProperties = {
  background: "#eef7f0",
  borderColor: "#bfdcc7",
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};