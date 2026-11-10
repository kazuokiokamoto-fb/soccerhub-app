import assert from "node:assert/strict";
import test from "node:test";
import { needsHardNavigation, type ZoneFlags } from "./navigation.ts";

const hubOff: ZoneFlags = { appZone: "hub", hubRoutingActive: false };
const hubOn: ZoneFlags = { appZone: "hub", hubRoutingActive: true };
const selection: ZoneFlags = { appZone: "selection", hubRoutingActive: false };

test("hub keeps client navigation while selection routing is off", () => {
  assert.equal(needsHardNavigation("/selection", hubOff), false);
  assert.equal(needsHardNavigation("/selection/abc?x=1", hubOff), false);
  assert.equal(needsHardNavigation("/match", hubOff), false);
  assert.equal(needsHardNavigation("/chat", hubOff), false);
  assert.equal(needsHardNavigation("/teams", hubOff), false);
  assert.equal(needsHardNavigation("/", hubOff), false);
});

test("hub hard-loads only selection URLs when routing is on", () => {
  assert.equal(needsHardNavigation("/selection", hubOn), true);
  assert.equal(needsHardNavigation("/selection/abc?pref=tokyo", hubOn), true);
  assert.equal(needsHardNavigation("/match", hubOn), false);
  assert.equal(needsHardNavigation("/chat", hubOn), false);
  assert.equal(needsHardNavigation("/teams/1", hubOn), false);
  assert.equal(needsHardNavigation("/mypage", hubOn), false);
  assert.equal(needsHardNavigation("/login", hubOn), false);
  assert.equal(needsHardNavigation("//selection", hubOn), false);
  assert.equal(needsHardNavigation("https://evil.example/selection", hubOn), false);
});

test("selection zone hard-loads hub URLs and keeps selection client navigation", () => {
  assert.equal(needsHardNavigation("/selection", selection), false);
  assert.equal(needsHardNavigation("/selection/abc", selection), false);
  assert.equal(needsHardNavigation("/", selection), true);
  assert.equal(needsHardNavigation("/login", selection), true);
  assert.equal(needsHardNavigation("/chat", selection), true);
  assert.equal(needsHardNavigation("/mypage", selection), true);
  assert.equal(needsHardNavigation("/match", selection), true);
  assert.equal(needsHardNavigation("/teams", selection), true);
  assert.equal(needsHardNavigation("https://www.sakamatch.com/", selection), false);
});
