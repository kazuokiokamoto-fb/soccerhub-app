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

  filterSummaryText?: string;
  onOpenFilters?: () => void;
  onShowList?: () => void;

  openOnly?: boolean;
  onToggleOpenOnly?: () => void;

  bandText?: string;
  titleText?: string;
}) {
  const {
    monthKey,
    loading,
    cells,
    selectedYmd,
    dayStatusSummaryByDate,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
    onCreateForDate,
    disableCreate,
    filterSummaryText,
    onOpenFilters,
    onShowList,
    openOnly = false,
    onToggleOpenOnly,
    bandText = "日程検索",
    titleText = "試合日で探す",
  } = props;

  const weekLabels = ["月", "火", "水", "木", "金", "土", "日"];

  return (
    <section style={{ ...card, marginTop: 14 }}>
      <div style={topHead}>
        <div style={topHeadLeft}>
          <div style={sectionBand}>{bandText}</div>
          <div style={topTitle}>{titleText}</div>
        </div>

        <div style={topHeadActions}>
          {onOpenFilters ? (
            <button
              type="button"
              className="sh-btn"
              onClick={onOpenFilters}
              disabled={loading}
            >
              条件変更
            </button>
          ) : null}

          {onShowList ? (
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={onShowList}
              disabled={loading}
            >
              募集表示
            </button>
          ) : null}
        </div>
      </div>

      <div style={filterSummaryBox}>
        <div style={filterSummaryLabel}>表示条件</div>

        <div style={filterSummaryTextStyle}>
          {filterSummaryText?.trim() || "すべての条件で表示中"}
        </div>

        {onToggleOpenOnly ? (
          <button
            type="button"
            onClick={onToggleOpenOnly}
            style={{
              ...openOnlyChip,
              ...(openOnly ? openOnlyChipActive : null),
            }}
            aria-pressed={openOnly}
          >
            {openOnly ? "募集中のみ表示中" : "募集中のみ表示"}
          </button>
        ) : null}
      </div>

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
          const summary = dayStatusSummaryByDate.get(c.ymd);
          const isSelected = c.ymd === selectedYmd;
          const isPast = isPastDate(c.ymd);
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
                ...(isPast ? calCellPast : null),
                opacity: c.inMonth ? 1 : 0.42,
              }}
            >
              <div
                style={{
                  ...dayNumText,
                  color: c.inMonth ? (isPast ? "#9ca3af" : dayColor) : "#c5cbd3",
                }}
              >
                {c.dayNum}
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
                  color: isPast
                    ? "#94a3b8"
                    : summary
                      ? summary.tone === "decided"
                        ? "#166534"
                        : summary.tone === "open"
                          ? "#1d4ed8"
                          : "#4b5563"
                      : "#9ca3af",
                }}
              >
                {summary ? summaryLabel(summary) : "-"}
              </div>

              <div
                style={{
                  ...summaryCountText,
                  color: isPast ? "#94a3b8" : summary ? "#065f46" : "#9ca3af",
                }}
              >
                {summary ? `${summary.count}件` : "-"}
              </div>
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
          募集する
        </button>
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 16,
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

const sectionBand: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#e8f5ec",
  color: "#145c2a",
  border: "1px solid #cfe8d7",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const topTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const topHeadActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterSummaryBox: React.CSSProperties = {
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dfeee3",
  background: "linear-gradient(135deg,#f5fbf6 0%,#eef8f0 100%)",
  display: "grid",
  gap: 6,
};

const filterSummaryLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#5b6d61",
  letterSpacing: "0.05em",
};

const filterSummaryTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#23412c",
  lineHeight: 1.6,
};

const openOnlyChip: React.CSSProperties = {
  marginTop: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 30,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #d8e5dc",
  background: "#fff",
  color: "#294234",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const openOnlyChipActive: React.CSSProperties = {
  border: "1px solid #145c2a",
  background: "#145c2a",
  color: "#fff",
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
  height: 57,
  padding: "5px 5px 4px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 1,
  overflow: "hidden",
};

const calCellPast: React.CSSProperties = {
  background: "#f8fafc",
};

const calCellSelected: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
  boxShadow: "0 0 0 3px rgba(134,239,172,0.18)",
};

const dayNumText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  lineHeight: 1,
};

const statusText: React.CSSProperties = {
  width: "100%",
  marginTop: 1,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1.05,
  whiteSpace: "nowrap",
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
  marginTop: 0,
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.05,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bottomRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
};