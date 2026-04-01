// app/match/components/Calendar.tsx
"use client";

import React from "react";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: "decided" | "open" | "other";
};

export function Calendar(props: {
  monthKey: string;
  loading?: boolean;
  cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }>;
  selectedYmd: string;
  countByDate: Map<string, number>;
  dayStatusSummaryByDate: Map<string, DayCalendarSummary>;
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
    dayStatusSummaryByDate,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
    onCreateForDate,
    disableCreate,
  } = props;

  const weekLabels = ["月", "火", "水", "木", "金", "土", "日"];

  return (
    <section style={{ ...card, marginTop: 14 }}>
      <div style={headerRow}>
        <button className="sh-btn" type="button" onClick={onPrevMonth}>
          ← 前月
        </button>

        <div style={monthTitle}>{monthKey}</div>

        <button className="sh-btn" type="button" onClick={onNextMonth}>
          次月 →
        </button>
      </div>

      <div style={weekHeaderGrid}>
        {weekLabels.map((w, i) => (
          <div
            key={w}
            style={{
              ...weekLabel,
              color: i === 5 ? "#2563eb" : i === 6 ? "#dc2626" : "#666666",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div style={calendarGrid}>
        {cells.map((c, index) => {
          const totalCount = countByDate.get(c.ymd) ?? 0;
          const summary = dayStatusSummaryByDate.get(c.ymd);
          const isSelected = c.ymd === selectedYmd;
          const weekday = index % 7;

          const dayColor =
            weekday === 5
              ? "#2563eb"
              : weekday === 6
              ? "#dc2626"
              : "#374151";

          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => onSelectDate(c.ymd)}
              style={{
                ...calCell,
                ...(isSelected ? calCellSelected : null),
                opacity: c.inMonth ? 1 : 0.42,
              }}
            >
              <div
                style={{
                  ...dayNumText,
                  color: c.inMonth ? dayColor : "#9ca3af",
                }}
              >
                {c.dayNum}
              </div>

              <div style={countText}>{totalCount > 0 ? `${totalCount}件` : "-"}</div>

              {summary ? (
                <div
                  style={{
                    ...statusBadge,
                    ...(summary.tone === "decided"
                      ? statusBadgeDecided
                      : summary.tone === "open"
                      ? statusBadgeOpen
                      : statusBadgeOther),
                  }}
                >
                  {summary.label} {summary.count}
                </div>
              ) : (
                <div style={statusEmpty}>-</div>
              )}
            </button>
          );
        })}
      </div>

      <div style={bottomRow}>
        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={() => onCreateForDate(selectedYmd)}
          disabled={loading || disableCreate}
        >
          ＋募集枠を作る
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

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const monthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1.2,
  textAlign: "center",
};

const weekHeaderGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const weekLabel: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 800,
  fontSize: 12,
  minWidth: 0,
};

const calendarGrid: React.CSSProperties = {
  marginTop: 6,
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const calCell: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  minHeight: 86,
  padding: "8px 6px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 3,
  overflow: "hidden",
};

const calCellSelected: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
  boxShadow: "0 0 0 3px rgba(134,239,172,0.18)",
};

const dayNumText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 1.1,
};

const countText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 800,
  color: "#065f46",
  lineHeight: 1.2,
};

const statusBadge: React.CSSProperties = {
  marginTop: 2,
  minWidth: 0,
  maxWidth: "100%",
  padding: "2px 6px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusBadgeDecided: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const statusBadgeOpen: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
};

const statusBadgeOther: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#4b5563",
};

const statusEmpty: React.CSSProperties = {
  marginTop: 2,
  fontSize: 10,
  color: "#9ca3af",
  lineHeight: 1.2,
};

const bottomRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
};