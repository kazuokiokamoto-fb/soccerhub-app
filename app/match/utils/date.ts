export function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    const dd = new Date(lastYmd + "T00:00:00");
    dd.setDate(dd.getDate() + 1);
    cells.push({
      ymd: formatYmd(dd),
      dayNum: dd.getDate(),
      inMonth: false,
    });
  }

  return cells;
}