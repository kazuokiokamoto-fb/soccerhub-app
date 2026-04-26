"use client";

import React from "react";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: "decided" | "open" | "other";
};

type HolidayMap = Map<string, string>;

function summaryLabel(summary: DayCalendarSummary) {
  if (summary.tone === "decided") return "決定済";
  if (summary.tone === "open") return "募集中";
  return "他決定";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return {
    y: y || 1970,
    m: m || 1,
    d: d || 1,
  };
}

function isPastDate(ymd: string) {
  const { y, m, d } = parseYmd(ymd);
  const target = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return target < today;
}

function todayYmd() {
  const now = new Date();
  return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getWeekday(ymd: string) {
  const { y, m, d } = parseYmd(ymd);
  return new Date(y, m - 1, d).getDay();
}

function nthMonday(year: number, month: number, nth: number) {
  const first = new Date(year, month - 1, 1);
  const firstDay = first.getDay();
  const firstMonday = 1 + ((8 - firstDay) % 7);
  return firstMonday + (nth - 1) * 7;
}

function vernalEquinoxDay(year: number) {
  if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year: number) {
  if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function addHoliday(map: HolidayMap, year: number, month: number, day: number, name: string) {
  map.set(toYmd(year, month, day), name);
}

function buildJapaneseHolidayMap(year: number) {
  const map: HolidayMap = new Map();

  addHoliday(map, year, 1, 1, "元日");

  if (year >= 2000) addHoliday(map, year, 1, nthMonday(year, 1, 2), "成人の日");
  else addHoliday(map, year, 1, 15, "成人の日");

  addHoliday(map, year, 2, 11, "建国記念の日");

  if (year >= 2020) addHoliday(map, year, 2, 23, "天皇誕生日");
  if (year >= 1989 && year <= 2018) addHoliday(map, year, 12, 23, "天皇誕生日");

  addHoliday(map, year, 3, vernalEquinoxDay(year), "春分の日");

  if (year >= 2007) addHoliday(map, year, 4, 29, "昭和の日");
  else if (year >= 1989) addHoliday(map, year, 4, 29, "みどりの日");
  else addHoliday(map, year, 4, 29, "天皇誕生日");

  addHoliday(map, year, 5, 3, "憲法記念日");
  addHoliday(map, year, 5, 4, "みどりの日");
  addHoliday(map, year, 5, 5, "こどもの日");

  if (year >= 2003) addHoliday(map, year, 7, nthMonday(year, 7, 3), "海の日");
  else if (year >= 1996) addHoliday(map, year, 7, 20, "海の日");

  if (year >= 2016) addHoliday(map, year, 8, 11, "山の日");

  if (year >= 2003) addHoliday(map, year, 9, nthMonday(year, 9, 3), "敬老の日");
  else addHoliday(map, year, 9, 15, "敬老の日");

  addHoliday(map, year, 9, autumnEquinoxDay(year), "秋分の日");

  if (year >= 2000) addHoliday(map, year, 10, nthMonday(year, 10, 2), "スポーツの日");
  else addHoliday(map, year, 10, 10, "体育の日");

  addHoliday(map, year, 11, 3, "文化の日");
  addHoliday(map, year, 11, 23, "勤労感謝の日");

  if (year === 2019) {
    addHoliday(map, 2019, 5, 1, "即位の日");
    addHoliday(map, 2019, 10, 22, "即位礼正殿の儀");
  }

  if (year === 2020) {
    addHoliday(map, 2020, 7, 23, "海の日");
    addHoliday(map, 2020, 7, 24, "スポーツの日");
    addHoliday(map, 2020, 8, 10, "山の日");
    map.delete("2020-07-20");
    map.delete("2020-08-11");
    map.delete("2020-10-12");
  }

  if (year === 2021) {
    addHoliday(map, 2021, 7, 22, "海の日");
    addHoliday(map, 2021, 7, 23, "スポーツの日");
    addHoliday(map, 2021, 8, 8, "山の日");
    map.delete("2021-07-19");
    map.delete("2021-08-11");
    map.delete("2021-10-11");
  }

  addSubstituteHolidays(map, year);
  addCitizenHolidays(map, year);

  return map;
}

function addSubstituteHolidays(map: HolidayMap, year: number) {
  const holidays = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [ymd] of holidays) {
    const { y, m, d } = parseYmd(ymd);
    const date = new Date(y, m - 1, d);

    if (date.getDay() !== 0) continue;

    let next = new Date(date);
    next.setDate(next.getDate() + 1);

    while (true) {
      const nextYmd = toYmd(next.getFullYear(), next.getMonth() + 1, next.getDate());
      if (!map.has(nextYmd)) {
        map.set(nextYmd, "振替休日");
        break;
      }
      next.setDate(next.getDate() + 1);
    }
  }
}

function addCitizenHolidays(map: HolidayMap, year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  const d = new Date(start);
  d.setDate(d.getDate() + 1);

  while (d < end) {
    const ymd = toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());

    if (!map.has(ymd)) {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);

      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const prevYmd = toYmd(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
      const nextYmd = toYmd(next.getFullYear(), next.getMonth() + 1, next.getDate());

      if (map.has(prevYmd) && map.has(nextYmd)) {
        map.set(ymd, "国民の休日");
      }
    }

    d.setDate(d.getDate() + 1);
  }
}

function getJapaneseHolidayName(ymd: string) {
  const { y } = parseYmd(ymd);
  return buildJapaneseHolidayMap(y).get(ymd) ?? "";
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
        {cells.map((c) => {
          const summary = dayStatusSummaryByDate.get(c.ymd);
          const fallbackCount = countByDate.get(c.ymd) ?? 0;
          const displayCount = summary?.count ?? fallbackCount;

          const isSelected = c.ymd === selectedYmd;
          const isToday = c.ymd === today;
          const isPast = isPastDate(c.ymd);
          const weekday = getWeekday(c.ymd);
          const holidayName = getJapaneseHolidayName(c.ymd);

          const isSaturday = weekday === 6;
          const isSunday = weekday === 0;
          const isHoliday = !!holidayName;

          const dayColor =
            isSunday || isHoliday ? "#dc2626" : isSaturday ? "#2563eb" : "#374151";

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
              aria-label={`${c.ymd} ${isToday ? "今日 " : ""}${holidayName ? `${holidayName} ` : ""}${ariaStatus} ${ariaCount}`}
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

              {holidayName ? (
                <div
                  style={{
                    ...holidayText,
                    color: isPast ? "#94a3b8" : "#dc2626",
                  }}
                >
                  {holidayName}
                </div>
              ) : null}

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
  height: 88,
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

const holidayText: React.CSSProperties = {
  width: "100%",
  fontSize: 9,
  fontWeight: 900,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusText: React.CSSProperties = {
  width: "100%",
  marginTop: 3,
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