import assert from "node:assert/strict";
import test from "node:test";
import { confirmableCandidate, decideStandingSubmit, parseStandingEdit } from "./submit.ts";

const draft = {
  state: "draft" as const,
  version: 2,
  category: null,
  rank: null,
  unknown: false,
};

test("confirm submits the crawled candidate and rejects a different body", () => {
  const candidate = { category: "U-15", rank: 2 };
  assert.deepEqual(
    decideStandingSubmit({
      current: draft,
      expectedVersion: 2,
      next: { category: "U-15", rank: 2, unknown: false },
      mode: "confirm",
      candidate,
    }),
    { action: "submit" },
  );
  assert.equal(
    decideStandingSubmit({
      current: draft,
      expectedVersion: 2,
      next: { category: "一般", rank: 1, unknown: false },
      mode: "confirm",
      candidate,
    }).action,
    "reject",
  );
  assert.equal(confirmableCandidate({ category: "U-15", rank: null }), null);
});

test("edit can submit a corrected rank or 順位なし・不明", () => {
  assert.deepEqual(
    decideStandingSubmit({
      current: draft,
      expectedVersion: 2,
      next: parseStandingEdit({ category: "一般", rank: null, unknown: true }),
      mode: "edit",
      candidate: { category: "U-15", rank: 2 },
    }),
    { action: "submit" },
  );
  assert.equal(parseStandingEdit({ category: "一般", rank: 4, unknown: false })?.rank, 4);
  assert.equal(parseStandingEdit({ category: "社会人", rank: 1, unknown: false }), null);
  assert.equal(parseStandingEdit({ category: "一般", rank: 0, unknown: false }), null);
});

test("a repeated standing submit is idempotent and a changed one is rejected", () => {
  const submitted = {
    state: "submitted" as const,
    version: 4,
    category: "U-12",
    rank: null,
    unknown: true,
  };
  assert.equal(
    decideStandingSubmit({
      current: submitted,
      expectedVersion: 1,
      next: { category: "U-12", rank: null, unknown: true },
      mode: "edit",
      candidate: null,
    }).action,
    "idempotent",
  );
  assert.equal(
    decideStandingSubmit({
      current: submitted,
      expectedVersion: 4,
      next: { category: "U-12", rank: 1, unknown: false },
      mode: "edit",
      candidate: null,
    }).action,
    "reject",
  );
  assert.equal(
    decideStandingSubmit({
      current: draft,
      expectedVersion: 1,
      next: { category: "U-12", rank: 1, unknown: false },
      mode: "edit",
      candidate: null,
    }).action,
    "reject",
  );
});
