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
              }}
              disabled={disabled}
            >
              {v}
            </button>
          );
        })}
      </div>

      {bikeParking === "あり" && (
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
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 12,
};

const title: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const choiceWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const choiceBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
};

const choiceBtnActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
};

const listBox: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
  maxHeight: 170,
  overflowY: "auto",
};

const rowBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #edf1ee",
  background: "#fff",
};

const rowBtnActive: React.CSSProperties = {
  background: "#eef7f0",
};