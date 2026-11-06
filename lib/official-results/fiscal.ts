// Japanese fiscal year, Asia/Tokyo. Japan has used a fixed UTC+9 offset since 1951.
// 2025年度 is 2025-04-01 through 2026-03-31. Its deadline is the end of 2026-05-31.
// Overdue display starts at 2026-06-01 00:00:00.000 Asia/Tokyo. Late submission stays allowed.

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const MIN_YEAR = 1990;

export const FISCAL_PERIOD_KIND = "jp_fiscal" as const;
export const DEADLINE_MONTH = 5;
export const DEADLINE_DAY = 31;
export const DEADLINE_TIME_ZONE = "Asia/Tokyo" as const;

export type YearPhase = "in_progress" | "due" | "overdue";

export type FiscalDuty = {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  deadlineDate: string;
  phase: YearPhase;
  blocksProduct: false;
  lateSubmission: "allowed";
};

export type PolicyShape = {
  periodKind: string;
  deadlineMonth: number;
  deadlineDay: number;
  deadlineTimeZone: string;
  enforcement: string;
  lateSubmission: string;
};

export type CanonicalPolicy = {
  periodKind: typeof FISCAL_PERIOD_KIND;
  deadlineMonth: typeof DEADLINE_MONTH;
  deadlineDay: typeof DEADLINE_DAY;
  deadlineTimeZone: typeof DEADLINE_TIME_ZONE;
  enforcement: "status_only";
  lateSubmission: "allowed";
};

export function isCanonicalPolicy(row: PolicyShape): row is CanonicalPolicy {
  return (
    row.periodKind === FISCAL_PERIOD_KIND &&
    row.deadlineMonth === DEADLINE_MONTH &&
    row.deadlineDay === DEADLINE_DAY &&
    row.deadlineTimeZone === DEADLINE_TIME_ZONE &&
    row.enforcement === "status_only" &&
    row.lateSubmission === "allowed"
  );
}

export function tokyoParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(instant.getTime() + TOKYO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function fiscalYearContaining(instant: Date): number {
  const parts = tokyoParts(instant);
  return parts.month >= 4 ? parts.year : parts.year - 1;
}

export function fiscalPeriod(fiscalYear: number): { start: string; end: string } {
  return {
    start: `${fiscalYear}-04-01`,
    end: `${fiscalYear + 1}-03-31`,
  };
}

/** April 1 00:00:00.000 Asia/Tokyo of the next fiscal year. */
export function periodEndsAt(fiscalYear: number): Date {
  return new Date(Date.UTC(fiscalYear + 1, 2, 31, 15, 0, 0, 0));
}

/** June 1 00:00:00.000 Asia/Tokyo after the deadline day. */
export function overdueStartsAt(fiscalYear: number): Date {
  return new Date(Date.UTC(fiscalYear + 1, 4, 31, 15, 0, 0, 0));
}

export function yearPhase(fiscalYear: number, now: Date): YearPhase {
  if (now.getTime() < periodEndsAt(fiscalYear).getTime()) return "in_progress";
  if (now.getTime() < overdueStartsAt(fiscalYear).getTime()) return "due";
  return "overdue";
}

export function describeDuty(fiscalYear: number, now: Date): FiscalDuty {
  const period = fiscalPeriod(fiscalYear);
  return {
    fiscalYear,
    periodStart: period.start,
    periodEnd: period.end,
    deadlineDate: `${fiscalYear + 1}-05-31`,
    phase: yearPhase(fiscalYear, now),
    blocksProduct: false,
    lateSubmission: "allowed",
  };
}

/** The fiscal year in progress, and the immediately previous fiscal year. */
export function listedDuties(now: Date): FiscalDuty[] {
  const current = fiscalYearContaining(now);
  return [current - 1, current].map((year) => describeDuty(year, now));
}

export function isReportingYear(year: number, now: Date): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= fiscalYearContaining(now);
}

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateInFiscalYear(value: string, fiscalYear: number): boolean {
  if (!isRealIsoDate(value)) return false;
  const period = fiscalPeriod(fiscalYear);
  return value >= period.start && value <= period.end;
}
