import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEAGUE_DIVISIONS,
  LEAGUE_LEVELS,
  STRENGTH_GUIDES,
  affiliationSuggestsRank,
  levelToStrengthRank,
  strengthRankToLegacyLevel,
  suggestRankFromLeague,
} from "../../app/match/constants/strengthGuides.ts";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("each guide division suggests that rank and no other rank", () => {
  const seen = new Set<string>();
  for (const guide of STRENGTH_GUIDES) {
    if (guide.leagueLevel === "other") {
      assert.deepEqual(guide.divisions, []);
      assert.equal(suggestRankFromLeague(guide.leagueLevel, null), guide.rank);
      assert.equal(suggestRankFromLeague(guide.leagueLevel, ""), guide.rank);
      continue;
    }
    assert.ok(guide.divisions.length > 0);
    for (const division of guide.divisions) {
      const key = `${guide.leagueLevel}:${division}`;
      assert.equal(seen.has(key), false);
      seen.add(key);
      assert.equal(suggestRankFromLeague(guide.leagueLevel, division), guide.rank);
      assert.equal(suggestRankFromLeague(guide.leagueLevel, String(division)), guide.rank);
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    [
      "district:1",
      "district:2",
      "district:3",
      "district:4",
      "prefecture:1",
      "prefecture:2",
      "prefecture:3",
      "prefecture:4",
    ],
  );
});

test("the guide table is the rank copy used on cards", () => {
  assert.deepEqual(
    STRENGTH_GUIDES.map((guide) => [guide.rank, guide.short, guide.legacyLevel]),
    [
      ["SS", "都・県リーグ1・2部", 9],
      ["S", "都・県リーグ3・4部", 7],
      ["A", "地域リーグ1・2部", 5],
      ["B", "地域リーグ3・4部", 3],
      ["C", "フレンドリー", 1],
    ],
  );
  assert.deepEqual(
    LEAGUE_LEVELS.map((item) => item.label),
    ["都・県リーグ", "地域リーグ", "リーグなし・その他"],
  );
  assert.deepEqual([...LEAGUE_DIVISIONS], [1, 2, 3, 4]);
});

test("level floors follow the stored rank numbers, and 8 is not SS", () => {
  assert.equal(levelToStrengthRank(9), "SS");
  assert.equal(levelToStrengthRank(8), "S");
  assert.equal(levelToStrengthRank(7), "S");
  assert.equal(levelToStrengthRank(6), "A");
  assert.equal(levelToStrengthRank(5), "A");
  assert.equal(levelToStrengthRank(4), "B");
  assert.equal(levelToStrengthRank(3), "B");
  assert.equal(levelToStrengthRank(2), "C");
  assert.equal(levelToStrengthRank(1), "C");
  assert.equal(levelToStrengthRank(0), "C");
  assert.equal(levelToStrengthRank(null), "C");
  assert.equal(levelToStrengthRank(Number.NaN), "");
  for (const guide of STRENGTH_GUIDES) {
    assert.equal(strengthRankToLegacyLevel(guide.rank), guide.legacyLevel);
    assert.equal(levelToStrengthRank(guide.legacyLevel), guide.rank);
  }
});

test("a suggestion needs both a league and a division, except リーグなし", () => {
  assert.equal(suggestRankFromLeague("", 1), null);
  assert.equal(suggestRankFromLeague("prefecture", null), null);
  assert.equal(suggestRankFromLeague("prefecture", 5), null);
  assert.equal(suggestRankFromLeague("district", "0"), null);
  assert.equal(suggestRankFromLeague("national", 1), null);
  assert.equal(
    affiliationSuggestsRank({ rank: "S", leagueLevel: "prefecture", leagueDivision: 3 }),
    true,
  );
  assert.equal(
    affiliationSuggestsRank({ rank: "SS", leagueLevel: "prefecture", leagueDivision: 3 }),
    false,
  );
  assert.equal(
    affiliationSuggestsRank({ rank: "S", leagueLevel: null, leagueDivision: null }),
    false,
  );
});

test("rank copy is not hardcoded beside the guide", () => {
  const card = read("app/teams/components/TeamProfileCard.tsx");
  const home = read("app/components/home/HomeHelp.tsx");
  const picker = read("app/components/StrengthRankPicker.tsx");
  const search = read("app/teams/search/components/teamSearchUtils.ts");
  const modal = read("app/match/components/MatchHelpModals.tsx");
  assert.match(card, /strengthGuideByRank/);
  assert.doesNotMatch(card, /全国・地域トップ級/);
  assert.doesNotMatch(card, /都・県リーグ上位/);
  assert.match(home, /STRENGTH_GUIDES/);
  assert.doesNotMatch(home, /都・県リーグ1・2部相当/);
  assert.doesNotMatch(picker, /level >= 8/);
  assert.match(picker, /levelToStrengthRank/);
  assert.match(search, /from "@\/app\/match\/constants\/strengthGuides"/);
  assert.doesNotMatch(search, /全国・地域トップ級/);
  assert.doesNotMatch(modal, /都・県リーグ上位、非常に高い強度/);
});

test("the league migration is additive and does not touch team ranks or RLS", () => {
  const sql = read("supabase/migrations/20261112042135_team_affiliation_league_level.sql");
  assert.match(sql, /add column league_level text/);
  assert.match(sql, /add column league_division smallint/);
  assert.match(sql, /league_level is null and league_division is null/);
  assert.match(sql, /league_level = 'other'/);
  assert.match(sql, /league_division between 1 and 4/);
  assert.equal(/drop\s+table/i.test(sql), false);
  assert.equal(/drop\s+column/i.test(sql), false);
  assert.equal(/strength_rank/i.test(sql), false);
  assert.equal(/create\s+policy/i.test(sql), false);
  assert.equal(/enable\s+row\s+level\s+security/i.test(sql), false);
  assert.equal(/update\s+public\.teams/i.test(sql), false);
});
