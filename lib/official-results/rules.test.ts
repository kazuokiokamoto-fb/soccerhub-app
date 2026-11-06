import assert from "node:assert/strict";
import test from "node:test";
import { isTeamManagerRole } from "./permissions.ts";
import { decideSubmit, obligation, sourceDoesNotSubmit } from "./rules.ts";

test("owners and coaches file the report; members do not", () => {
  assert.equal(isTeamManagerRole({ isOwner: true, memberRole: null }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "coach" }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "owner" }), true);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "manager" }), false);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: "member" }), false);
  assert.equal(isTeamManagerRole({ isOwner: false, memberRole: null }), false);
});

test("outstanding work is visible and never blocks the product", () => {
  assert.equal(obligation({ report: null }).code, "not_started");
  assert.equal(obligation({ report: null }).blocksProduct, false);
  assert.equal(obligation({ report: null }).lateSubmission, "allowed");
  assert.equal(
    obligation({ report: { state: "in_review", outcome: "unspecified" } }).code,
    "in_review",
  );
  assert.equal(
    obligation({ report: { state: "submitted", outcome: "no_official_results" } }).blocksProduct,
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
});
