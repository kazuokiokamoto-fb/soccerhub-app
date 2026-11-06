import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decideSubmit } from "./rules.ts";
import {
  dateInFiscalYear,
  describeDuty,
  fiscalPeriod,
  fiscalYearContaining,
  isCanonicalPolicy,
  isReportingYear,
  listedDuties,
  overdueStartsAt,
  periodEndsAt,
} from "./fiscal.ts";

const may31End = new Date("2026-05-31T14:59:59.999Z");
const june1Start = new Date("2026-05-31T15:00:00.000Z");
const march31End = new Date("2026-03-31T14:59:59.999Z");
const april1Start = new Date("2026-03-31T15:00:00.000Z");

test("2025年度 runs from April 1 through the next March 31", () => {
  assert.deepEqual(fiscalPeriod(2025), { start: "2025-04-01", end: "2026-03-31" });
  assert.equal(dateInFiscalYear("2025-04-01", 2025), true);
  assert.equal(dateInFiscalYear("2026-03-31", 2025), true);
  assert.equal(dateInFiscalYear("2025-03-31", 2025), false);
  assert.equal(dateInFiscalYear("2026-04-01", 2025), false);
  assert.equal(dateInFiscalYear("2026-02-31", 2025), false);
});

test("the fiscal year changes at April 1 00:00 Asia/Tokyo", () => {
  assert.equal(fiscalYearContaining(march31End), 2025);
  assert.equal(fiscalYearContaining(april1Start), 2026);
  assert.equal(describeDuty(2025, march31End).phase, "in_progress");
  assert.equal(describeDuty(2025, april1Start).phase, "due");
  assert.equal(periodEndsAt(2025).toISOString(), "2026-03-31T15:00:00.000Z");
});

test("May 31 is still on time and June 1 00:00 Asia/Tokyo is overdue", () => {
  const onTime = describeDuty(2025, may31End);
  const overdue = describeDuty(2025, june1Start);
  assert.equal(onTime.deadlineDate, "2026-05-31");
  assert.equal(onTime.phase, "due");
  assert.equal(overdue.phase, "overdue");
  assert.equal(overdue.blocksProduct, false);
  assert.equal(overdue.lateSubmission, "allowed");
  assert.equal(overdueStartsAt(2025).toISOString(), "2026-05-31T15:00:00.000Z");
  assert.equal(june1Start.getTime() - may31End.getTime(), 1);
});

test("the home list shows the current fiscal year and the one before it", () => {
  assert.deepEqual(
    listedDuties(march31End).map((duty) => [duty.fiscalYear, duty.phase]),
    [
      [2024, "overdue"],
      [2025, "in_progress"],
    ],
  );
  assert.deepEqual(
    listedDuties(april1Start).map((duty) => [duty.fiscalYear, duty.phase]),
    [
      [2025, "due"],
      [2026, "in_progress"],
    ],
  );
  assert.deepEqual(
    listedDuties(june1Start).map((duty) => [duty.fiscalYear, duty.phase]),
    [
      [2025, "overdue"],
      [2026, "in_progress"],
    ],
  );
});

test("an overdue year can still be submitted and does not block the product", () => {
  const duty = describeDuty(2025, june1Start);
  assert.equal(duty.blocksProduct, false);
  assert.deepEqual(
    decideSubmit({
      current: { state: "draft", outcome: "unspecified", version: 2 },
      expectedVersion: 2,
      nextOutcome: "no_official_results",
      includedLineCount: 0,
    }),
    { action: "submit" },
  );
  assert.equal(isReportingYear(2026, june1Start), true);
  assert.equal(isReportingYear(2027, june1Start), false);
  assert.equal(isReportingYear(2026, march31End), false);
});

test("the stored policy is the decided fiscal-year rule", () => {
  assert.equal(
    isCanonicalPolicy({
      periodKind: "jp_fiscal",
      deadlineMonth: 5,
      deadlineDay: 31,
      deadlineTimeZone: "Asia/Tokyo",
      enforcement: "status_only",
      lateSubmission: "allowed",
    }),
    true,
  );
  assert.equal(
    isCanonicalPolicy({
      periodKind: "unset",
      deadlineMonth: 5,
      deadlineDay: 31,
      deadlineTimeZone: "Asia/Tokyo",
      enforcement: "status_only",
      lateSubmission: "allowed",
    }),
    false,
  );
});

test("login, matches, chat, calendar, and scheduling do not consult official results", () => {
  const paths = [
    "middleware.ts",
    "app/login/page.tsx",
    "app/match/page.tsx",
    "app/match/my-schedule/page.tsx",
    "app/chat/page.tsx",
    "app/calendar/page.tsx",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.equal(source.includes("official-results"), false, path);
    assert.equal(source.includes("official_result"), false, path);
  }
});
