import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractStanding } from "./extract.ts";

const tablePage = readFileSync(new URL("./fixtures/standings-table.html", import.meta.url), "utf8");
const prosePage = readFileSync(new URL("./fixtures/standings-prose.html", import.meta.url), "utf8");
const wrongYear = readFileSync(new URL("./fixtures/standings-2026.html", import.meta.url), "utf8");

test("a standings table yields the team rank and category for that fiscal year", () => {
  const hit = extractStanding({
    html: tablePage,
    teamName: "青葉FC",
    fiscalYear: 2025,
    categoryHint: "U-15",
  });
  assert.ok(hit);
  assert.equal(hit.rank, 2);
  assert.equal(hit.category, "U-15");
  assert.equal(hit.confidence, "high");
  assert.match(hit.evidence, /青葉FC/);
  assert.ok(hit.evidence.length <= 240);
});

test("prose can record a rank written after the team name", () => {
  const hit = extractStanding({
    html: prosePage,
    teamName: "青葉FC",
    fiscalYear: 2025,
  });
  assert.ok(hit);
  assert.equal(hit.rank, 3);
  assert.equal(hit.category, "一般");
});

test("another fiscal year and a missing team produce no candidate", () => {
  assert.equal(
    extractStanding({ html: wrongYear, teamName: "青葉FC", fiscalYear: 2025 }),
    null,
  );
  assert.equal(
    extractStanding({ html: tablePage, teamName: "存在しないFC", fiscalYear: 2025 }),
    null,
  );
});
