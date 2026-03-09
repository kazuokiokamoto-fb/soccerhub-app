"use client";

import React from "react";

const gradeLabels: any = {
  G1: "小1",
  G2: "小2",
  G3: "小3",
  G4: "小4",
  G5: "小5",
  G6: "小6",
};

export function RosterByGradeFields({
  gradeKeys,
  roster,
  setRoster,
  disabled,
}: any) {
  return (
    <div style={card}>
      <div style={title}>各学年の人数（ざっくり）</div>

      <div style={grid}>
        {gradeKeys.map((g: any) => (
          <label key={g} style={label}>
            <span style={labelTitle}>{gradeLabels[g]}</span>

            <input
              value={roster[g]}
              disabled={disabled}
              onChange={(e) =>
                setRoster({
                  ...roster,
                  [g]: e.target.value.replace(/[^\d]/g, ""),
                })
              }
              className="sh-input"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
};

const title: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const grid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, 1fr)",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
};