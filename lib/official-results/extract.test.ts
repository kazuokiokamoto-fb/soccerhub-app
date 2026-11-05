import assert from "node:assert/strict";
import test from "node:test";
import { extractOfficialCandidates } from "./extract.ts";

const html = `
  <html><head><title>2026 市長杯 大会</title></head>
  <body>
    <p>青葉FC</p>
    <p>2026年4月12日 青葉FC 対 緑ヶ丘SC 2-1</p>
    <p>選手 学年 太郎 1-0</p>
    <p>3-0</p>
  </body>
  </html>
`;

test("extraction copies an explicit score and skips personal or bare lines", () => {
  const result = extractOfficialCandidates({
    html,
    teamName: "青葉FC",
    reportingYear: 2026,
  });
  assert.equal(result.matchConfidence, "team_and_year_seen");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].teamGoals, 2);
  assert.equal(result.candidates[0].opponentGoals, 1);
  assert.equal(result.candidates[0].opponentName, "緑ヶ丘SC");
  assert.equal(result.candidates[0].playedOn, "2026-04-12");
  assert.equal(result.candidates[0].competitionName, "2026 市長杯 大会");
  assert.match(result.note, /提出ではありません/);
});

test("a page that does not name the team produces no scores", () => {
  const result = extractOfficialCandidates({
    html: "<title>2026 大会</title><p>別のクラブ 1-0</p>",
    teamName: "青葉FC",
    reportingYear: 2026,
  });
  assert.equal(result.matchConfidence, "team_or_year_missing");
  assert.deepEqual(result.candidates, []);
});

test("a matching page without an explicit score stays empty", () => {
  const result = extractOfficialCandidates({
    html: "<p>青葉FC は 2026 年の公式戦に出場した。</p>",
    teamName: "青葉 FC",
    reportingYear: 2026,
  });
  assert.equal(result.matchConfidence, "no_explicit_results");
  assert.deepEqual(result.candidates, []);
});
