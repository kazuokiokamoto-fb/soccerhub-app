"use client";

import React, { useMemo } from "react";
import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: "decided" | "open" | "other";
};

function toCalendarItem(summary: DayCalendarSummary): CalendarItem | null {
  if (summary.tone === "decided") {
    return {
      label: "決定",
      count: summary.count,
      tone: "decided",
    };
  }

  if (summary.tone === "open") {
    return {
      label: "募集",
      count: summary.count,
      tone: "open",
    };
  }

  // 「他決」は非表示
  return null;
}

export function Calendar(props: {
  monthKey: string;
  loading?: boolean;
  cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }>;
  selectedYmd: string;
  countByDate: Map<string, number>;
  dayStatusSummaryByDate: Map<string, DayCalendarSummary>;
  itemsByDate?: Map<string, CalendarItem[]>;
  onSelectDate: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCreateForDate: (ymd: string) => void;
  disableCreate?: boolean;
  selectedDateSummaryText?: string;
  titleText?: string;
}) {
  const {
    monthKey,
    loading,
    cells,
    selectedYmd,
    countByDate,
    dayStatusSummaryByDate,
    itemsByDate,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
    onCreateForDate,
    disableCreate,
    selectedDateSummaryText,
    titleText = "試合日で探す",
  } = props;

  const normalizedItemsByDate = useMemo(() => {
    if (itemsByDate) return itemsByDate;

    const map = new Map<string, CalendarItem[]>();

    for (const cell of cells) {
      const summary = dayStatusSummaryByDate.get(cell.ymd);
      const fallbackCount = countByDate.get(cell.ymd) ?? 0;

      if (summary) {
        const item = toCalendarItem(summary);
        if (item) {
          map.set(cell.ymd, [item]);
        }
        continue;
      }

      if (fallbackCount > 0) {
        map.set(cell.ymd, [
          {
            label: "募集",
            count: fallbackCount,
            tone: "open",
          },
        ]);
      }
    }

    return map;
  }, [cells, countByDate, dayStatusSummaryByDate, itemsByDate]);

  return (
    <section style={card}>
      {/* タイトル */}
      <div style={topHead}>
        <div style={topHeadLeft}>
          <div style={topTitle} className="ui-title">
            {titleText}
          </div>
        </div>
      </div>

      {/* サマリー */}
      <div style={summaryBar}>
        <div style={summaryLeft}>
          {selectedDateSummaryText?.trim() || "日付を選択してください"}
        </div>

        <div style={summaryRight}>
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

      {/* 凡例 */}
      <div style={legendRow}>
        <div style={legendItem}>
          <span style={{ ...legendChip, background: "#16a34a" }} />
          <span>決定</span>
        </div>

        <div style={legendItem}>
          <span style={{ ...legendChip, background: "#2563eb" }} />
          <span>募集</span>
        </div>

        <div style={legendItem}>
          <span style={{ ...legendChip, ...legendSelectedChip }} />
          <span>選択中</span>
        </div>
      </div>

      {/* カレンダー本体 */}
      <MatchCalendarBase
        monthKey={monthKey}
        cells={cells}
        selectedYmd={selectedYmd}
        itemsByDate={normalizedItemsByDate}
        onSelectDate={onSelectDate}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />
    </section>
  );
}

/* =========================
   styles
========================= */

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
  marginTop: 8,
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