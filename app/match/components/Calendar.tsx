// app/match/components/Calendar.tsx
"use client";

import React from "react";

export function Calendar(props: {
  monthKey: string;
  loading?: boolean;
  cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }>;
  selectedYmd: string;
  countByDate: Map<string, number>;
  onSelectDate: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCreateForDate: (ymd: string) => void;
  disableCreate?: boolean;
}) {
  const {
    monthKey,
    loading,
    cells,
    selectedYmd,
    countByDate,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
    onCreateForDate,
    disableCreate,
  } = props;

  return (
    <section style={{ ...card, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button className="sh-btn" type="button" onClick={onPrevMonth}>
          ← 前月
        </button>

        <div style={{ fontWeight: 900, fontSize: 18 }}>{monthKey}</div>

        <button className="sh-btn" type="button" onClick={onNextMonth}>
          次月 →
        </button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
          <div key={w} style={{ textAlign: "center", fontWeight: 800, color: "#666", fontSize: 12 }}>
            {w}
          </div>
        ))}

        {cells.map((c) => {
          const n = countByDate.get(c.ymd) ?? 0;
          const isSelected = c.ymd === selectedYmd;

          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => onSelectDate(c.ymd)}
              style={{
                ...calCell,
                opacity: c.inMonth ? 1 : 0.45,
                border: isSelected ? "2px solid #86efac" : "1px solid #eee",
                background: isSelected ? "#f0fdf4" : "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 900 }}>{c.dayNum}</div>
                {n > 0 ? <div style={badge}>{n}</div> : null}
              </div>
              <div style={{ marginTop: 6, color: "#777", fontSize: 12, textAlign: "left" }}>
                {n > 0 ? "募集中" : "—"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button className="sh-btn" type="button" onClick={() => onCreateForDate(selectedYmd)} disabled={loading || disableCreate}>
          ＋ {selectedYmd} に募集を作る
        </button>
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fff",
};

const calCell: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  minHeight: 76,
  cursor: "pointer",
  textAlign: "left",
};

const badge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#111827",
  color: "white",
  fontSize: 12,
  fontWeight: 900,
};