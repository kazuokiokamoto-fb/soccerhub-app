import assert from "node:assert/strict";
import test from "node:test";
import { SAKAMATCH_BROWSER_CLIENT_OPTIONS } from "./browserClient.ts";
import {
  assertHostOnlyCookieOptions,
  hasSupabaseAuthSessionCookie,
  supabaseAuthCookiePrefix,
} from "./cookies.ts";
import { hubSelectionPlan } from "./hubPlan.ts";
import { selectionLoginLocation } from "./loginRedirect.ts";
import {
  decideLegacyAuth,
  isProtectedPath,
  isSelectionAssetPath,
  isSelectionPagePath,
} from "./paths.ts";

const SUPABASE_URL = "https://senspqsexmtrwjfsdadv.supabase.co";
const PREFIX = "sb-senspqsexmtrwjfsdadv-auth-token";

test("auth cookie name matches the shared Supabase project and ignores the PKCE verifier", () => {
  assert.equal(supabaseAuthCookiePrefix(SUPABASE_URL), PREFIX);
  assert.equal(hasSupabaseAuthSessionCookie([PREFIX], PREFIX), true);
  assert.equal(hasSupabaseAuthSessionCookie([`${PREFIX}.0`, `${PREFIX}.1`], PREFIX), true);
  assert.equal(hasSupabaseAuthSessionCookie([`${PREFIX}-code-verifier`], PREFIX), false);
  assert.equal(hasSupabaseAuthSessionCookie(["sb-other-auth-token"], PREFIX), false);
});

test("browser and cookie options do not widen Domain or rename storage", () => {
  assert.equal("cookieOptions" in SAKAMATCH_BROWSER_CLIENT_OPTIONS, false);
  assert.equal("cookies" in SAKAMATCH_BROWSER_CLIENT_OPTIONS, false);
  assert.equal("storageKey" in SAKAMATCH_BROWSER_CLIENT_OPTIONS.auth, false);
  assert.doesNotThrow(() => assertHostOnlyCookieOptions({ path: "/", sameSite: "lax" } as never));
  assert.throws(() => assertHostOnlyCookieOptions({ domain: ".sakamatch.com" }), /host-only/);
  assert.throws(() => assertHostOnlyCookieOptions({ name: "other-auth" }), /storage key/);
});

test("logged-out selection and other protected routes still go to the hub login", () => {
  assert.equal(isSelectionPagePath("/selection"), true);
  assert.equal(isSelectionPagePath("/selection/event-1"), true);
  assert.equal(isSelectionPagePath("/selection-static"), false);
  assert.equal(isSelectionAssetPath("/selection-static/_next/static/chunk.js"), true);
  assert.equal(isProtectedPath("/selection-static"), false);
  assert.equal(isProtectedPath("/match"), true);
  assert.equal(isProtectedPath("/teams"), true);
  assert.equal(isProtectedPath("/chat"), true);
  assert.equal(isProtectedPath("/results"), true);
  assert.equal(isProtectedPath("/results/team-1"), true);
  assert.equal(isProtectedPath("/api/official-results"), false);

  const selection = decideLegacyAuth({
    hasUser: false,
    pathname: "/selection",
    search: "",
    loginRedirectParam: null,
  });
  assert.deepEqual(selection, { action: "to-login", redirectParam: "/selection" });

  const detail = decideLegacyAuth({
    hasUser: false,
    pathname: "/selection/event-1",
    search: "?pref=tokyo",
    loginRedirectParam: null,
  });
  assert.deepEqual(detail, {
    action: "to-login",
    redirectParam: "/selection/event-1?pref=tokyo",
  });

  const home = decideLegacyAuth({
    hasUser: false,
    pathname: "/",
    search: "",
    loginRedirectParam: null,
  });
  assert.deepEqual(home, { action: "next" });

  const openRedirect = decideLegacyAuth({
    hasUser: false,
    pathname: "/login",
    search: "",
    loginRedirectParam: null,
  });
  assert.deepEqual(openRedirect, { action: "next" });
});

test("after login, safe internal redirects are preserved and external ones are dropped", () => {
  assert.deepEqual(
    decideLegacyAuth({
      hasUser: true,
      pathname: "/login",
      search: "",
      loginRedirectParam: "/selection/event-1?x=1",
    }),
    { action: "leave-login", destination: "/selection/event-1?x=1" }
  );
  assert.deepEqual(
    decideLegacyAuth({
      hasUser: true,
      pathname: "/login",
      search: "",
      loginRedirectParam: "//evil.example",
    }),
    { action: "leave-login", destination: "/" }
  );
  assert.deepEqual(
    decideLegacyAuth({
      hasUser: true,
      pathname: "/login",
      search: "",
      loginRedirectParam: "https://evil.example",
    }),
    { action: "leave-login", destination: "/" }
  );
});

test("enabled routing proxies an existing session and does not ask for a second login", () => {
  assert.equal(
    hubSelectionPlan({
      routingEnabled: false,
      pathname: "/selection",
      cookieNames: [PREFIX],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "legacy"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/selection/event-1",
      cookieNames: [],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "to-login"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/selection",
      cookieNames: [`${PREFIX}.0`],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "proxy"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/selection",
      cookieNames: [`${PREFIX}-code-verifier`],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "to-login"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/match",
      cookieNames: [PREFIX],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "legacy"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/teams/1",
      cookieNames: [PREFIX],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "legacy"
  );
  assert.equal(
    hubSelectionPlan({
      routingEnabled: true,
      pathname: "/chat",
      cookieNames: [PREFIX],
      supabaseUrl: SUPABASE_URL,
    }).action,
    "legacy"
  );
  for (const pathname of [
    "/results",
    "/results/team-1",
    "/api/official-results",
    "/api/official-results/team-1/submit",
    "/api/cron/selection-crawler",
  ]) {
    assert.equal(
      hubSelectionPlan({
        routingEnabled: true,
        pathname,
        cookieNames: [PREFIX],
        supabaseUrl: SUPABASE_URL,
      }).action,
      "legacy",
      pathname
    );
  }
});

test("selection login returns to the hub host, not the selection deployment host", () => {
  const detail = selectionLoginLocation({
    redirectPath: "/selection/event-1?x=1",
    forwardedHost: "www.sakamatch.com",
    forwardedProto: "https",
    hubOrigin: "https://www.sakamatch.com",
    onVercel: true,
  });
  assert.equal(
    detail,
    "https://www.sakamatch.com/login?redirect=%2Fselection%2Fevent-1%3Fx%3D1"
  );

  const ignored = selectionLoginLocation({
    redirectPath: "/selection",
    forwardedHost: "soccerhub-selection.vercel.app",
    forwardedProto: "https",
    hubOrigin: "https://www.sakamatch.com",
    onVercel: true,
  });
  assert.equal(ignored, "https://www.sakamatch.com/login?redirect=%2Fselection");

  const local = selectionLoginLocation({
    redirectPath: "/selection",
    forwardedHost: "127.0.0.1:3000",
    forwardedProto: "http",
    requestHost: "127.0.0.1:3001",
    hubOrigin: undefined,
    onVercel: false,
  });
  assert.equal(local, "http://127.0.0.1:3000/login?redirect=%2Fselection");

  const ownHost = selectionLoginLocation({
    redirectPath: "/selection",
    forwardedHost: "127.0.0.1:3001",
    forwardedProto: "http",
    requestHost: "127.0.0.1:3001",
    hubOrigin: "https://www.sakamatch.com",
    onVercel: false,
  });
  assert.equal(ownHost, "https://www.sakamatch.com/login?redirect=%2Fselection");

  const localBlockedOnVercel = selectionLoginLocation({
    redirectPath: "/selection",
    forwardedHost: "127.0.0.1:3000",
    forwardedProto: "http",
    hubOrigin: "https://www.sakamatch.com",
    onVercel: true,
  });
  assert.equal(localBlockedOnVercel, "https://www.sakamatch.com/login?redirect=%2Fselection");

  const relative = selectionLoginLocation({
    redirectPath: "/",
    forwardedHost: "evil.example",
    forwardedProto: "https",
    hubOrigin: "https://selection.sakamatch.com",
    onVercel: true,
  });
  assert.equal(relative, "/login");
  assert.equal(relative.includes("selection.sakamatch.com"), false);
});
