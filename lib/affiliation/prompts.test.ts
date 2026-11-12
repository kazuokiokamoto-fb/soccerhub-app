import assert from "node:assert/strict";
import test from "node:test";
import { affiliationPrompts } from "./prompts.ts";

const teams = [
  { id: "team-a", name: "青葉FC", role: "owner" },
  { id: "team-b", name: "別クラブ", role: "coach" },
  { id: "team-c", name: "会員のみ", role: "member" },
];

test("missing affiliation prompts owners and coaches and never blocks", () => {
  const prompts = affiliationPrompts({
    teams,
    affiliations: [],
    dismissals: [],
    pages: [],
  });
  assert.deepEqual(
    prompts.map((prompt) => prompt.teamId),
    ["team-a", "team-b"],
  );
  assert.equal(prompts.every((prompt) => prompt.blocksProduct === false), true);
  assert.equal(prompts.every((prompt) => prompt.kind === "affiliation"), true);
});

test("所属なし does not ask for a results URL", () => {
  const prompts = affiliationPrompts({
    teams,
    affiliations: [
      { teamId: "team-a", status: "none" },
      { teamId: "team-b", status: "affiliated" },
    ],
    dismissals: [],
    pages: [{ teamId: "team-b", status: "needs_url", suggestedUrl: "https://example.com/r" }],
  });
  assert.deepEqual(prompts, [
    {
      teamId: "team-b",
      teamName: "別クラブ",
      kind: "results_url",
      suggestedUrl: "https://example.com/r",
      blocksProduct: false,
    },
  ]);
});

test("a dismissed prompt stays quiet and a saved URL is not asked again", () => {
  const prompts = affiliationPrompts({
    teams,
    affiliations: [{ teamId: "team-b", status: "affiliated" }],
    dismissals: [{ teamId: "team-a" }],
    pages: [{ teamId: "team-b", status: "manual", suggestedUrl: null }],
  });
  assert.deepEqual(prompts, []);
});
