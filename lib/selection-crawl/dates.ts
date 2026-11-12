export const SELECTION_STALE_DAYS = 60;

export function jstYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function plusYears(ymd: string, years: number): string {
  const [yearText, monthText, dayText] = ymd.split("-");
  const year = Number(yearText) + years;
  const month = Number(monthText);
  const day = Number(dayText);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

export function isYmd(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function jstYmdFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return jstYmd(date);
}

function artifactSet(stamps: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const stamp of stamps) {
    const ymd = jstYmdFromIso(stamp);
    if (!ymd) continue;
    out.add(ymd);
    out.add(plusYears(ymd, 1));
  }
  return out;
}

export type DatedSelectionRow = {
  eventDate: string | null;
  eventDates: string[] | null;
  createdAt: string;
  fetchedAt?: string | null;
  lastSeenAt?: string | null;
};

function listedDates(row: DatedSelectionRow): string[] {
  const fromArray = (row.eventDates ?? []).filter(isYmd);
  if (fromArray.length > 0) return Array.from(new Set(fromArray));
  return isYmd(row.eventDate) ? [row.eventDate] : [];
}

/**
 * Dates kept for a group of rows that share one team and one source page.
 * A date that only ever equals the crawl day, or that day plus one year, is dropped
 * when the group has more than one row. A single row keeps its listed dates.
 */
export function keptDatesForGroup(rows: DatedSelectionRow[]): string[] {
  const collapseArtifacts = rows.length > 1;
  const kept = new Set<string>();
  for (const row of rows) {
    const artifacts = artifactSet([row.createdAt, row.fetchedAt, row.lastSeenAt]);
    for (const date of listedDates(row)) {
      if (collapseArtifacts && artifacts.has(date)) continue;
      kept.add(date);
    }
  }
  return Array.from(kept).sort();
}

export function chooseEventDate(dates: string[], today: string): string | null {
  const valid = Array.from(new Set(dates.filter(isYmd))).sort();
  const upcoming = valid.filter((date) => date >= today);
  if (upcoming.length > 0) return upcoming[0];
  if (valid.length > 0) return valid[valid.length - 1];
  return null;
}

export function dateIsExplicit(text: string, ymd: string): boolean {
  if (!isYmd(ymd)) return false;
  const [year, monthText, dayText] = ymd.split("-");
  const month = String(Number(monthText));
  const day = String(Number(dayText));
  const patterns = [
    `${year}年${month}月${day}日`,
    `${year}年${monthText}月${dayText}日`,
    `${year}-${monthText}-${dayText}`,
    `${year}/${monthText}/${dayText}`,
    `${year}.${monthText}.${dayText}`,
    `${year}-${month}-${day}`,
    `${year}/${month}/${day}`,
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

/** Drop the crawl day and the same month-day next year unless the page states that year. */
export function filterExtractedDates(dates: string[], now: Date, pageText: string): string[] {
  const today = jstYmd(now);
  const nextYear = plusYears(today, 1);
  return Array.from(new Set(dates.filter(isYmd)))
    .filter((date) => {
      if (date !== today && date !== nextYear) return true;
      return dateIsExplicit(pageText, date);
    })
    .sort();
}

export function displayStatusForDates(input: {
  dates: string[];
  today: string;
  deadline: string | null;
  rolling: boolean;
}): string {
  if (input.deadline && isYmd(input.deadline) && input.deadline < input.today) return "申込終了";
  if (input.dates.length === 0) return input.rolling ? "募集中" : "日付未取得";
  const latest = [...input.dates].sort().at(-1) ?? "";
  if (latest < input.today) return "開催終了";
  return "募集中";
}
