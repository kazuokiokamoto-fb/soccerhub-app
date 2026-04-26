"use client";

import React from "react";

/**
 * 共通カレンダー用データ
 */
export type CalendarItem = {
  label: string; // 表示テキスト（例：決定 / 募集 / 交渉）
  count: number;
  tone: "decided" | "open" | "negotiating";
};

type HolidayMap = Map<string, string>;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
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

/**
 * 祝日（簡易版）
 */
function getHolidayName(ymd: string) {
  const holidays: Record<string, string> = {
    "2026-01-01": "元日",
    "2026-02-11": "建国記念の日",
    "2026-02-23": "天皇誕生日",
    "2026-03-20": "春分の日",
    "2026-04-29": "昭和の日",
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-07-20": "海の日",
    "2026-08-11": "山の日",
    "2026-09-21": "敬老の日",
    "2026-09-23": "秋分の日",
    "2026-10-12": "スポーツの日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",
  };

  return holidays[ymd] ?? "";
}

/**
 * tone → 色
 */
function getColor(tone: CalendarItem["tone"]) {
  if (tone === "decided") return "#16a34a"; // 緑
  if (tone === "open") return "#2563eb"; // 青
  if (tone === "negotiating") return "#f97316"; // オレンジ
  return "#6b7280";
}

export function MatchCalendarBase(props: {
  monthKey: string;
  cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }>;
  selectedYmd: string;
  itemsByDate: Map<string, CalendarItem[]>;
  onSelectDate: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const {
    monthKey,
    cells,
    selectedYmd,
    itemsByDate,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
  } = props;

  const weekLabels = ["月", "火", "水", "木", "金", "土", "日"];
  const today = todayYmd();

  return (
    <section style={wrap}>
      <div style={header}>
        <button onClick={onPrevMonth}>←</button>
        <div style={title}>{monthKey}</div>
        <button onClick={onNextMonth}>→</button>
      </div>

      <div style={weekGrid}>
        {weekLabels.map((w, i) => (
          <div
            key={w}
            style={{
              ...weekLabel,
              color: i === 5 ? "#2563eb" : i === 6 ? "#dc2626" : "#555",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div style={grid}>
        {cells.map((c) => {
          const isToday = c.ymd === today;
          const isPast = isPastDate(c.ymd);
          const weekday = getWeekday(c.ymd);
          const holiday = getHolidayName(c.ymd);

          const isSat = weekday === 6;
          const isSun = weekday === 0 || !!holiday;

          const items = itemsByDate.get(c.ymd) ?? [];

          return (
            <button
              key={c.ymd}
              onClick={() => onSelectDate(c.ymd)}
              style={{
                ...cell,
                ...(isPast ? cellPast : {}),
                ...(isToday ? cellToday : {}),
              }}
            >
              <div
                style={{
                  ...dayNum,
                  color: isPast
                    ? "#9ca3af"
                    : isSun
                    ? "#dc2626"
                    : isSat
                    ? "#2563eb"
                    : "#111",
                }}
              >
                {c.dayNum}
              </div>

              {holiday && (
                <div style={holidayText}>{holiday}</div>
              )}

              {items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    ...itemText,
                    color: isPast ? "#9ca3af" : getColor(it.tone),
                  }}
                >
                  {it.label} {it.count}件
                </div>
              ))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ===== style ===== */

const wrap: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
};

const title: React.CSSProperties = {
  fontWeight: 900,
};

const weekGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7,1fr)",
  marginBottom: 4,
};

const weekLabel: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 700,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7,1fr)",
  gap: 4,
};

const cell: React.CSSProperties = {
  height: 80,
  border: "1px solid #eee",
  borderRadius: 10,
  padding: 4,
  textAlign: "left",
  background: "#fff",
};

const cellPast: React.CSSProperties = {
  background: "#f3f4f6",
};

const cellToday: React.CSSProperties = {
  border: "2px solid #22c55e",
};

const dayNum: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
};

const holidayText: React.CSSProperties = {
  fontSize: 9,
  color: "#dc2626",
};

const itemText: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
};