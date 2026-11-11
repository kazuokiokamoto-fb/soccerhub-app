import assert from "node:assert/strict";
import test from "node:test";
import { canFileOfficialReport, mergeHomeTeams } from "./membership.ts";

test("a coach who does not own a team still belongs to that team", () => {
  const teams = mergeHomeTeams({
    owned: [],
    members: [{ team_id: "team-coach", role: "coach" }],
  });
  assert.deepEqual(teams, [{ id: "team-coach", role: "coach" }]);
  assert.equal(canFileOfficialReport(teams), true);
});

test("a member belongs to the team and does not file the annual report", () => {
  const teams = mergeHomeTeams({
    owned: [],
    members: [{ team_id: "team-member", role: "member" }],
  });
  assert.deepEqual(teams, [{ id: "team-member", role: "member" }]);
  assert.equal(canFileOfficialReport(teams), false);
});

test("owner_id wins when the same team is also listed as coach", () => {
  const teams = mergeHomeTeams({
    owned: [{ id: "team-1" }],
    members: [
      { team_id: "team-1", role: "coach" },
      { team_id: "team-2", role: "member" },
    ],
  });
  assert.deepEqual(teams, [
    { id: "team-1", role: "owner" },
    { id: "team-2", role: "member" },
  ]);
  assert.equal(canFileOfficialReport(teams), true);
});

test("unknown roles and blank ids are ignored", () => {
  const teams = mergeHomeTeams({
    owned: [{ id: "  " }, { id: "owned" }],
    members: [
      { team_id: "nope", role: "manager" },
      { team_id: "", role: "coach" },
      { team_id: "stored-owner", role: "owner" },
    ],
  });
  assert.deepEqual(teams, [
    { id: "owned", role: "owner" },
    { id: "stored-owner", role: "owner" },
  ]);
});
