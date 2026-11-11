import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fiscalYearChoiceLabel, fiscalYearLabel, resultText } from "../../app/results/labels.ts";
import {
  GOAL_CHOICES,
  GOAL_MAX,
  GOAL_MIN,
  interpretScores,
  lineGoalsForApi,
  resolveResultLabel,
} from "./lineInput.ts";

test("the year menu label shows the fiscal span in a short form", () => {
  assert.equal(fiscalYearChoiceLabel(2026), "2026年度（2026/4〜2027/3）");
  assert.equal(fiscalYearLabel(2026), "2026年度（2026-04-01〜2027-03-31）");
  assert.equal(resultText("win"), "勝ち");
  assert.equal(resultText("loss"), "負け");
  assert.equal(resultText("draw"), "引き分け");
  assert.equal(resultText("unknown"), "未確定");
});

test("goal choices are the closed range the report line accepts", () => {
  assert.equal(GOAL_CHOICES[0], GOAL_MIN);
  assert.equal(GOAL_CHOICES.at(-1), GOAL_MAX);
  assert.equal(GOAL_MIN, 0);
  assert.equal(GOAL_MAX, 20);
  assert.equal(GOAL_CHOICES.length, 21);
});

test("blank scores can declare a result, and a score decides the result", () => {
  assert.equal(interpretScores("", "").status, "empty");
  assert.equal(interpretScores("2", "").status, "incomplete");
  assert.equal(interpretScores("", "1").status, "incomplete");
  assert.equal(interpretScores("21", "0").status, "incomplete");
  assert.equal(interpretScores("-1", "0").status, "incomplete");
  assert.equal(interpretScores("1.5", "0").status, "incomplete");
  assert.deepEqual(interpretScores("2", "1"), {
    status: "scored",
    team: 2,
    opponent: 1,
    result: "win",
  });
  assert.equal(interpretScores("1", "2").status === "scored" && interpretScores("1", "2").result, "loss");
  assert.equal(interpretScores("0", "0").status === "scored" && interpretScores("0", "0").result, "draw");
  assert.deepEqual(lineGoalsForApi("", ""), { team: null, opponent: null });
  assert.equal(lineGoalsForApi("2", ""), null);
  assert.deepEqual(lineGoalsForApi("20", "20"), { team: 20, opponent: 20 });

  assert.equal(resolveResultLabel(null, null, "win"), "win");
  assert.equal(resolveResultLabel(null, null, "loss"), "loss");
  assert.equal(resolveResultLabel(null, null, "draw"), "draw");
  assert.equal(resolveResultLabel(null, null, undefined), "unknown");
  assert.equal(resolveResultLabel(null, null, ""), "unknown");
  assert.equal(resolveResultLabel(null, null, "nope"), null);
  assert.equal(resolveResultLabel(2, 1, "loss"), "win");
  assert.equal(resolveResultLabel(1, 2, "win"), "loss");
  assert.equal(resolveResultLabel(1, 1, "unknown"), "draw");
  assert.equal(resolveResultLabel(1, null, "win"), null);
});

test("the report screen picks years, dates, scores, and results", () => {
  const editor = readFileSync(new URL("../../app/results/ResultsEditor.tsx", import.meta.url), "utf8");
  const server = readFileSync(
    new URL("../../app/lib/server/officialResults.ts", import.meta.url),
    "utf8",
  );
  const home = readFileSync(new URL("../../app/results/ResultsHome.tsx", import.meta.url), "utf8");
  assert.equal(editor.includes("この年を開く"), false);
  assert.equal(editor.includes('inputMode="numeric"'), false);
  assert.equal(editor.includes("fiscalYearChoiceLabel"), true);
  assert.equal(editor.includes('type="date"'), true);
  assert.equal(editor.includes("自チームの得点"), true);
  assert.equal(editor.includes("相手の得点"), true);
  assert.equal(editor.includes("勝敗"), true);
  assert.equal(editor.includes("resolveResultLabel"), true);
  assert.equal(server.includes("resolveResultLabel"), true);
  assert.equal(server.includes("isGoalCount"), true);
  assert.equal(home.includes("fiscalYearChoiceLabel"), true);
  assert.equal(home.includes("?year="), true);
});
