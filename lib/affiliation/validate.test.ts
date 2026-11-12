import assert from "node:assert/strict";
import test from "node:test";
import { validateAffiliation } from "./validate.ts";

test("affiliation is required unless the team explicitly has none", () => {
  assert.equal(
    validateAffiliation({
      none: false,
      prefecture: "",
      category: "",
      organizationName: "",
    }).ok,
    false,
  );
  assert.equal(
    validateAffiliation({
      none: false,
      prefecture: "東京都",
      category: "U-15",
      organizationName: "   ",
    }).ok,
    false,
  );
  const missing = validateAffiliation({
    none: false,
    prefecture: "東京都",
    category: "",
    organizationName: "東京都社会人リーグ",
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.message, /所属なし/);
});

test("所属なし lets a team register without a league", () => {
  const value = validateAffiliation({
    none: true,
    prefecture: "",
    category: "",
    organizationName: "",
  });
  assert.deepEqual(value, { ok: true, value: { status: "none" } });
});

test("a complete affiliation is accepted and trimmed", () => {
  const value = validateAffiliation({
    none: false,
    prefecture: "東京都",
    category: "U-12",
    organizationName: "  東京都社会人サッカーリーグ  ",
  });
  assert.deepEqual(value, {
    ok: true,
    value: {
      status: "affiliated",
      prefecture: "東京都",
      category: "U-12",
      organizationName: "東京都社会人サッカーリーグ",
      leagueLevel: null,
      leagueDivision: null,
    },
  });
});

test("league level is optional until a division is required", () => {
  const open = validateAffiliation({
    none: false,
    prefecture: "東京都",
    category: "U-12",
    organizationName: "リーグ",
    leagueLevel: "prefecture",
    leagueDivision: "",
  });
  assert.equal(open.ok, false);
  if (!open.ok) assert.match(open.message, /部を選んでください/);

  const friendly = validateAffiliation({
    none: false,
    prefecture: "東京都",
    category: "U-12",
    organizationName: "リーグ",
    leagueLevel: "other",
    leagueDivision: "1",
  });
  assert.equal(friendly.ok, true);
  if (friendly.ok && friendly.value.status === "affiliated") {
    assert.equal(friendly.value.leagueLevel, "other");
    assert.equal(friendly.value.leagueDivision, null);
  }

  const ranked = validateAffiliation({
    none: false,
    prefecture: "東京都",
    category: "U-12",
    organizationName: "リーグ",
    leagueLevel: "district",
    leagueDivision: "2",
  });
  assert.equal(ranked.ok, true);
  if (ranked.ok && ranked.value.status === "affiliated") {
    assert.equal(ranked.value.leagueLevel, "district");
    assert.equal(ranked.value.leagueDivision, 2);
  }
});

test("所属なし ignores a leftover league choice", () => {
  const value = validateAffiliation({
    none: true,
    prefecture: "東京都",
    category: "U-12",
    organizationName: "リーグ",
    leagueLevel: "prefecture",
    leagueDivision: "1",
  });
  assert.deepEqual(value, { ok: true, value: { status: "none" } });
});

test("unknown prefecture or category is rejected", () => {
  assert.equal(
    validateAffiliation({
      none: false,
      prefecture: "関東",
      category: "U-15",
      organizationName: "リーグ",
    }).ok,
    false,
  );
  assert.equal(
    validateAffiliation({
      none: false,
      prefecture: "東京都",
      category: "社会人",
      organizationName: "リーグ",
    }).ok,
    false,
  );
});
