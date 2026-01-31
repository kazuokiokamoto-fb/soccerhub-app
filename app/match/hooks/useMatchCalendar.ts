// app/match/hooks/useMatchCalendar.ts
"use client";

import { useMemo } from "react";

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function weekdayIndexMondayFirst(date: Date) {
  // Mon=0..Sun=6
  const w = date.getDay(); // Sun=0..Sat=6
  return (w + 6) % 7;
}

export function useMatchCalendar(monthDate: Date) {
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(monthDate);
    const last = endOfMonth(monthDate);

    const prefix = weekdayIndexMondayFirst(first);
    const daysInMonth = last.getDate();

    const cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }> = [];

    // prefix
    for (let i = 0; i < prefix; i++) {
      const d = new Date(first);
      d.setDate(1 - (prefix - i));
      cells.push({ ymd: formatYmd(d), dayNum: d.getDate(), inMonth: false });
    }
    // month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      cells.push({ ymd: formatYmd(d), dayNum: day, inMonth: true });
    }
    // suffix to complete weeks
    while (cells.length % 7 !== 0) {
      const lastYmd = cells[cells.length - 1]?.ymd;
      const dd = new Date(lastYmd + "T00:00:00");
      dd.setDate(dd.getDate() + 1);
      cells.push({ ymd: formatYmd(dd), dayNum: dd.getDate(), inMonth: false });
    }

    return cells;
  }, [monthDate]);

  return {
    monthKey,
    calendarCells,
    addMonths,
    startOfMonth,
  };
}