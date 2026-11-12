import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261111193000_team_affiliation_standings.sql", import.meta.url),
  "utf8",
);

test("the standing migration is additive and qualifies team ids", () => {
  assert.equal(/drop\s+table/i.test(sql), false);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /tm\.team_id = team_affiliations\.team_id/);
  assert.match(sql, /tm\.team_id = team_result_pages\.team_id/);
  assert.match(sql, /tm\.team_id = official_standing_candidates\.team_id/);
  assert.equal(sql.includes("tm.team_id = team_id"), false);
  assert.match(sql, /submission_kind = 'standing'/);
  assert.match(sql, /grant select on table public\.official_standing_candidates/);
  assert.equal(/grant\s+insert\s+on\s+table\s+public\.official_standing_candidates/i.test(sql), false);
});
