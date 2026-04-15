"use client";

import React from "react";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: "decided" | "open" | "other";
};

function summaryLabel(summary: DayCalendarSummary) {
  if (summary.tone === "decided") return "決定済";
  if (summary.tone === "open") return "募集中";
  return "他決定";
}

function isPastDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return target < today;
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  selectedDateSummaryText?: string;
  onOpenCalendarHelp?: () => void;
  titleText?: string;
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
    selectedDateSummaryText,
    onOpenCalendarHelp,
    titleText = "試合日で探す",
  } = props;

  const weekLabels = ["月", "火", "水", "木", "金", "土", "日"];
  const today = todayYmd();

  return (
    <section style={card}>
      <div style={topHead}>
        <div style={topHeadLeft}>
          <div style={topTitle} className="ui-title">
            {titleText}
          </div>
        </div>
      </div>

      <div style={summaryBar}>
        <div style={summaryLeft}>
          {selectedDateSummaryText?.trim() || "日付を選択してください"}
        </div>

        <div style={summaryRight}>
          {onOpenCalendarHelp ? (
            <button
              type="button"
              className="sh-btn"
              onClick={onOpenCalendarHelp}
              disabled={loading}
            >
              決・募・他とは
            </button>
          ) : null}

          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={() => onCreateForDate(selectedYmd)}
            disabled={loading || disableCreate}
          >
            募集する
          </button>
        </div>
      </div>

      <div style={legendRow}>
        <div style={legendItem}>
          <span style={{ ...legendChip, ...legendSelectedChip }} />
          <span>選択中</span>
        </div>
      </div>

      <div style={headerRow}>
        <button
          className="sh-btn"
          type="button"
          onClick={onPrevMonth}
          disabled={loading}
        >
          ← 前月
        </button>

        <div style={monthTitle}>{monthKey}</div>

        <button
          className="sh-btn"
          type="button"
          onClick={onNextMonth}
          disabled={loading}
        >
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
          const summary = dayStatusSummaryByDate.get(c.ymd);
          const fallbackCount = countByDate.get(c.ymd) ?? 0;
          const displayCount = summary?.count ?? fallbackCount;

          const isSelected = c.ymd === selectedYmd;
          const isToday = c.ymd === today;
          const isPast = isPastDate(c.ymd);
          const weekday = index % 7;

          const dayColor =
            weekday === 5
              ? "#2563eb"
              : weekday === 6
                ? "#dc2626"
                : "#374151";

          const statusColor = isPast
            ? "#94a3b8"
            : summary
              ? summary.tone === "decided"
                ? "#166534"
                : summary.tone === "open"
                  ? "#1d4ed8"
                  : "#4b5563"
              : "#9ca3af";

          const countColor = isPast
            ? "#94a3b8"
            : displayCount > 0
              ? "#065f46"
              : "#9ca3af";

          const ariaStatus = summary ? summaryLabel(summary) : "予定なし";
          const ariaCount = displayCount > 0 ? `${displayCount}件` : "0件";

          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => onSelectDate(c.ymd)}
              style={{
                ...calCell,
                ...(isPast ? calCellPast : null),
                ...(isToday ? calCellToday : null),
                ...(isSelected ? calCellSelected : null),
                opacity: c.inMonth ? 1 : 0.42,
              }}
              aria-pressed={isSelected}
              aria-label={`${c.ymd} ${isToday ? "今日 " : ""}${ariaStatus} ${ariaCount}`}
            >
              <div style={cellTopRow}>
                <div
                  style={{
                    ...dayNumText,
                    color: c.inMonth ? (isPast ? "#9ca3af" : dayColor) : "#c5cbd3",
                  }}
                >
                  {c.dayNum}
                </div>
              </div>

              <div
                style={{
                  ...statusText,
                  ...(summary
                    ? summary.tone === "decided"
                      ? statusTextDecided
                      : summary.tone === "open"
                        ? statusTextOpen
                        : statusTextOther
                    : statusTextEmpty),
                  color: statusColor,
                }}
              >
                {summary ? summaryLabel(summary) : "-"}
              </div>

              <div
                style={{
                  ...summaryCountText,
                  color: countColor,
                }}
              >
                {displayCount > 0 ? `${displayCount}件` : "-"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
  border: "1px solid #dce9df",
  borderRadius: 14,
  background: "#fff",
};

const topHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const topHeadLeft: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const topTitle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const summaryBar: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 14,
  background: "#f7fbf8",
  border: "1px solid #dce9df",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryLeft: React.CSSProperties = {
  fontSize: 13,
  color: "#3b6a49",
  lineHeight: 1.55,
};

const summaryRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginLeft: "auto",
  justifyContent: "flex-end",
};

const legendRow: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 4,
  marginBottom: 8,
  fontSize: 12,
  color: "#66756d",
};

const legendItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const legendChip: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  display: "inline-block",
};

const legendSelectedChip: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
};

const headerRow: React.CSSProperties = {
  marginTop: 12,
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
  color: "#16391f",
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
  height: 82,
  padding: "7px 6px 5px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 2,
  overflow: "hidden",
};

const calCellPast: React.CSSProperties = {
  background: "#f8fafc",
};

const calCellToday: React.CSSProperties = {
  border: "2px solid #93c5fd",
  boxShadow: "0 0 0 2px rgba(147,197,253,0.18)",
};

const calCellSelected: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
  boxShadow: "0 0 0 3px rgba(134,239,172,0.18)",
};

const cellTopRow: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 4,
};

const dayNumText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  lineHeight: 1,
};

const statusText: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1.15,
  whiteSpace: "normal",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusTextDecided: React.CSSProperties = {
  color: "#166534",
};

const statusTextOpen: React.CSSProperties = {
  color: "#1d4ed8",
};

const statusTextOther: React.CSSProperties = {
  color: "#4b5563",
};

const statusTextEmpty: React.CSSProperties = {
  color: "#9ca3af",
};

const summaryCountText: React.CSSProperties = {
  width: "100%",
  marginTop: 1,
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.15,
  whiteSpace: "normal",
  overflow: "hidden",
  textOverflow: "ellipsis",
};