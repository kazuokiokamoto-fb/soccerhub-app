export function ymdToday() {
  const d = new Date();
  return formatYmd(d);
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function weekdayIndexMondayFirst(date: Date) {
  const w = date.getDay();
  return (w + 6) % 7;
}

export function isPastYmd(ymd: string) {
  return ymd < ymdToday();
}

export function getYmdWeekdayIndex(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.getDay(); // 0:日 1:月 ... 6:土
}

export function isSaturdayYmd(ymd: string) {
  return getYmdWeekdayIndex(ymd) === 6;
}

export function isSundayYmd(ymd: string) {
  return getYmdWeekdayIndex(ymd) === 0;
}

export type CalendarCell = {
  ymd: string;
  dayNum: number;
  inMonth: boolean;
};

export function buildCalendarCells(monthDate: Date): CalendarCell[] {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const prefix = weekdayIndexMondayFirst(first);
  const daysInMonth = last.getDate();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < prefix; i++) {
    const d = new Date(first);
    d.setDate(1 - (prefix - i));
    cells.push({
      ymd: formatYmd(d),
      dayNum: d.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    cells.push({
      ymd: formatYmd(d),
      dayNum: day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const lastYmd = cells[cells.length - 1]!.ymd;
    const dd = new Date(`${lastYmd}T00:00:00`);
    dd.setDate(dd.getDate() + 1);
    cells.push({
      ymd: formatYmd(dd),
      dayNum: dd.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

/**
 * 祝日API：全年度対応
 * https://holidays-jp.github.io/api/v1/date.json
 */
let holidayCache: Record<string, string> = {};
let holidayLoadingPromise: Promise<Record<string, string>> | null = null;

export async function loadJapaneseHolidays() {
  if (Object.keys(holidayCache).length > 0) {
    return holidayCache;
  }

  if (holidayLoadingPromise) {
    return holidayLoadingPromise;
  }

  holidayLoadingPromise = fetch("https://holidays-jp.github.io/api/v1/date.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error("祝日データの取得に失敗しました");
      }
      return res.json();
    })
    .then((data: Record<string, string>) => {
      holidayCache = data;
      return holidayCache;
    })
    .catch((e) => {
      console.error("loadJapaneseHolidays error:", e);
      holidayCache = {};
      return holidayCache;
    });

  return holidayLoadingPromise;
}

export function getJapaneseHolidayName(ymd: string) {
  return holidayCache[ymd] ?? "";
}

export function isJapaneseHoliday(ymd: string) {
  return !!getJapaneseHolidayName(ymd);
}

export function isHolidayOrSundayYmd(ymd: string) {
  return isSundayYmd(ymd) || isJapaneseHoliday(ymd);
}