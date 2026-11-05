import assert from "node:assert/strict";
import test from "node:test";
import { isTeamManagerRole } from "./permissions.ts";
import { decideSubmit, isReportingYear, obligation, sourceDoesNotSubmit } from "./rules.ts";

const policyUnset = {
  yearStatus: "unset" as const,
  reportingYear: null,
  deadlineMonth: null,
  deadlineDay: null,
  enforcement: "status_only" as const,
};

test("only owners, coaches, and managers file the report", () => {
  assert.equal(isTeamManagerRole({ isOwner: true, memberRole: null }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "coach" }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "manager" }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "member" }), false);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: null }), false);
});

test("an unset policy does not invent a due year or a block", () => {
  const status = obligation({ policy: policyUnset, report: null });
  assert.equal(status.code, "year_unset");
  assert.equal(status.blocksProduct, false);
  assert.equal(status.deadline, null);
});

test("a configured year shows outstanding work without blocking", () => {
  const policy = { ...policyUnset, yearStatus: "configured" as const, reportingYear: 2025 };
  assert.equal(obligation({ policy, report: null }).code, "not_started");
  assert.equal(
    obligation({ policy, report: { state: "in_review", outcome: "unspecified" } }).code,
    "in_review",
  );
  assert.equal(
    obligation({
      policy,
      report: { state: "submitted", outcome: "no_official_results" },
    }).blocksProduct,
    false,
  );
});

test("network retrieval does not change the report into a submission", () => {
  assert.equal(sourceDoesNotSubmit("draft"), "draft");
  assert.equal(sourceDoesNotSubmit("in_review"), "in_review");
});

test("submit is explicit, idempotent, and rejects a mismatched replay", () => {
  assert.deepEqual(
    decideSubmit({
      current: { state: "draft", outcome: "unspecified", version: 3 },
      expectedVersion: 3,
      nextOutcome: "has_results",
      includedLineCount: 1,
    }),
    { action: "submit" },
  );
  assert.deepEqual(
    decideSubmit({
      current: { state: "submitted", outcome: "no_official_results", version: 4 },
      expectedVersion: 2,
      nextOutcome: "no_official_results",
      includedLineCount: 0,
    }),
    { action: "idempotent" },
  );
  assert.equal(
    decideSubmit({
      current: { state: "submitted", outcome: "has_results", version: 4 },
      expectedVersion: 4,
      nextOutcome: "no_official_results",
      includedLineCount: 0,
    }).action,
    "reject",
  );
  assert.equal(
    decideSubmit({
      current: { state: "draft", outcome: "unspecified", version: 3 },
      expectedVersion: 2,
      nextOutcome: "has_results",
      includedLineCount: 1,
    }).action,
    "reject",
  );
  assert.equal(
    decideSubmit({
      current: { state: "draft", outcome: "unspecified", version: 1 },
      expectedVersion: 1,
      nextOutcome: "no_official_results",
      includedLineCount: 1,
    }).action,
    "reject",
  );
  assert.equal(isReportingYear(1989, new Date("2026-01-01T00:00:00Z")), false);
  assert.equal(isReportingYear(2026, new Date("2026-06-01T00:00:00Z")), true);
});
