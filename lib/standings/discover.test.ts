import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseDiscoveredPage,
  embeddedPublicUrl,
  sameHostStandingsLinks,
  scoreStandingsPage,
  seedUrlFor,
} from "./discover.ts";
import { dueForWeeklyCrawl, hostFetchBudget, parseSearchHits, standingCandidateRow } from "./plan.ts";
import { WEEK_MS } from "./plan.ts";

test("a known association name can seed discovery and a pasted URL is kept", () => {
  assert.equal(
    seedUrlFor("東京都", "東京都サッカー協会"),
    "https://www.tokyofa.or.jp/",
  );
  assert.equal(seedUrlFor("東京都", "三宿リーグ"), null);
  assert.equal(
    embeddedPublicUrl("結果は https://example.com/standings です"),
    "https://example.com/standings",
  );
  assert.equal(embeddedPublicUrl("http://127.0.0.1/secret"), null);
});

test("high confidence needs the organization and a standings word", () => {
  const html = "<h1>東京都社会人リーグ 順位表</h1><p>2025年度</p>";
  const high = scoreStandingsPage(html, {
    organization: "東京都社会人リーグ",
    category: "一般",
    prefecture: "東京都",
  });
  assert.equal(high.confidence, "high");
  const low = scoreStandingsPage("<h1>順位表</h1>", {
    organization: "東京都社会人リーグ",
    category: "一般",
    prefecture: "東京都",
  });
  assert.equal(low.confidence, "low");
  assert.deepEqual(
    chooseDiscoveredPage([{ url: "https://example.com/r", score: low }]),
    {
      status: "needs_url",
      url: null,
      suggestedUrl: "https://example.com/r",
      confidence: "low",
    },
  );
});

test("only same-host standings links are followed", () => {
  const html = `
    <a href="/leagues/table">順位表</a>
    <a href="https://evil.example/順位">順位</a>
    <a href="http://127.0.0.1/順位">順位</a>
  `;
  assert.deepEqual(sameHostStandingsLinks(html, new URL("https://example.com/home")), [
    "https://example.com/leagues/table",
  ]);
});

test("optional search JSON is parsed and a candidate is not a submission", () => {
  assert.deepEqual(
    parseSearchHits({ web: { results: [{ url: "https://example.com/a" }, { link: "nope" }] } }),
    ["https://example.com/a"],
  );
  assert.deepEqual(parseSearchHits({}), []);
  const row = standingCandidateRow({
    team_id: "team",
    fiscal_year: 2025,
    category: "U-15",
    rank: 2,
    source_url: "https://example.com/r",
    evidence: "2 青葉FC",
    confidence: "high",
  });
  assert.equal("state" in row, false);
  assert.equal("submitted_at" in row, false);
  assert.equal(dueForWeeklyCrawl(null, new Date()), true);
  assert.equal(dueForWeeklyCrawl(new Date(), new Date()), false);
  assert.equal(dueForWeeklyCrawl(new Date(Date.now() - WEEK_MS - 1000), new Date()), true);
  assert.equal(hostFetchBudget(7), true);
  assert.equal(hostFetchBudget(8), false);
});
