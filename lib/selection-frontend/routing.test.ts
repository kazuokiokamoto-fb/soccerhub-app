import assert from "node:assert/strict";
import test from "node:test";
import {
  SELECTION_ASSET_PREFIX,
  hubRoutingBuild,
  selectionRewriteRules,
  selectionRoutingDecision,
  type RoutingEnv,
} from "./routing.ts";

const ENABLED: RoutingEnv = {
  SELECTION_FRONTEND_ROUTING: "1",
  SELECTION_APP_ORIGIN: "https://soccerhub-selection.vercel.app",
  VERCEL: "1",
  VERCEL_URL: "soccerhub-app-abc.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "www.sakamatch.com",
};

test("routing stays off unless the flag is exactly 1", () => {
  for (const flag of [undefined, "", "0", "true", "yes"]) {
    const decision = selectionRoutingDecision({
      ...ENABLED,
      SELECTION_FRONTEND_ROUTING: flag,
    });
    assert.equal(decision.enabled, false);
    assert.equal(decision.reason, "flag-off");
    assert.deepEqual(hubRoutingBuild({ ...ENABLED, SELECTION_FRONTEND_ROUTING: flag }).beforeFiles, []);
  }
});

test("routing stays off for missing, placeholder, insecure, and self hosts", () => {
  const cases: Array<{ env: RoutingEnv; reason: string }> = [
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: undefined }, reason: "origin-missing" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://placeholder.vercel.app" }, reason: "origin-placeholder" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://example.com" }, reason: "origin-placeholder" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "http://soccerhub-selection.vercel.app" }, reason: "origin-not-https" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://www.sakamatch.com" }, reason: "origin-blocked-host" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://sakamatch.com" }, reason: "origin-blocked-host" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://selection.sakamatch.com" }, reason: "origin-blocked-host" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://soccerhub-selection.vercel.app/selection" }, reason: "origin-has-path" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://user:pass@soccerhub-selection.vercel.app" }, reason: "origin-invalid" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://soccerhub-app-abc.vercel.app" }, reason: "origin-loop" },
    { env: { ...ENABLED, SELECTION_APP_ORIGIN: "https://www.sakamatch.com.evil.example" }, reason: "origin-placeholder" },
  ];

  for (const item of cases) {
    const decision = selectionRoutingDecision(item.env);
    assert.equal(decision.enabled, false, item.env.SELECTION_APP_ORIGIN);
    assert.equal(decision.reason, item.reason, item.env.SELECTION_APP_ORIGIN);
    assert.equal(hubRoutingBuild(item.env).clientFlag, "0");
  }
});

test("local http origin is opt-in only off Vercel", () => {
  const local = selectionRoutingDecision({
    SELECTION_FRONTEND_ROUTING: "1",
    SELECTION_APP_ORIGIN: "http://127.0.0.1:3001",
  });
  assert.equal(local.enabled, true);
  if (local.enabled) assert.equal(local.origin, "http://127.0.0.1:3001");

  const onVercel = selectionRoutingDecision({
    ...ENABLED,
    SELECTION_APP_ORIGIN: "http://127.0.0.1:3001",
  });
  assert.equal(onVercel.enabled, false);
});

test("enabled routing rewrites only selection pages and assets", () => {
  const decision = selectionRoutingDecision(ENABLED, "www.sakamatch.com");
  assert.equal(decision.enabled, true);
  if (!decision.enabled) return;

  const build = hubRoutingBuild(ENABLED);
  assert.equal(build.clientFlag, "1");
  assert.deepEqual(build.beforeFiles, selectionRewriteRules(decision.origin));
  assert.deepEqual(
    build.beforeFiles.map((rule) => rule.source),
    ["/selection", "/selection/:path*", `${SELECTION_ASSET_PREFIX}/:path*`]
  );
  for (const rule of build.beforeFiles) {
    assert.equal(rule.destination.startsWith("https://soccerhub-selection.vercel.app/"), true);
    assert.equal(rule.destination.includes("www.sakamatch.com"), false);
    assert.equal(rule.source.startsWith("/api"), false);
    assert.equal(rule.source.startsWith("/match"), false);
    assert.equal(rule.source.startsWith("/chat"), false);
    assert.equal(rule.source.startsWith("/teams"), false);
  }
});

test("request host equal to the selection origin disables routing", () => {
  const decision = selectionRoutingDecision(
    ENABLED,
    "soccerhub-selection.vercel.app"
  );
  assert.equal(decision.enabled, false);
  assert.equal(decision.reason, "origin-loop");
});
