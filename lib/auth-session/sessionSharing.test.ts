import assert from "node:assert/strict";
import test from "node:test";
import type { CookieOptions } from "@supabase/ssr";
import { createSharedServerClient } from "./supabaseClients.ts";

const SUPABASE_URL = "https://senspqsexmtrwjfsdadv.supabase.co";
const ANON_KEY = "test-anon-key";
const COOKIE = "sb-senspqsexmtrwjfsdadv-auth-token";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "player@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function session(accessToken: string, refreshToken: string) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("hub and selection server clients share one host-only session", async () => {
  const jar = new Map<string, { value: string; options: CookieOptions }>();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/token?grant_type=password")) {
      return json(session("access-hub", "refresh-1"));
    }
    if (url.includes("/token?grant_type=refresh_token")) {
      return json(session("access-refreshed", "refresh-2"));
    }
    if (url.includes("/logout")) return json({});
    if (url.includes("/user")) return json(user);
    throw new Error(`unexpected auth request ${url}`);
  };

  const client = (label: string) =>
    createSharedServerClient({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: ANON_KEY,
      getAll: () => [...jar.entries()].map(([name, item]) => ({ name, value: item.value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          assert.equal(cookie.options.domain, undefined, `${label} set Domain`);
          assert.equal(cookie.options.path, "/");
          assert.equal(cookie.options.sameSite, "lax");
          if (cookie.options.maxAge === 0) jar.delete(cookie.name);
          else jar.set(cookie.name, { value: cookie.value, options: cookie.options });
        }
      },
    });

  try {
    const hub = client("hub-sign-in");
    const signedIn = await hub.auth.signInWithPassword({
      email: "player@example.com",
      password: "password",
    });
    assert.equal(signedIn.error, null);
    assert.equal(jar.has(COOKIE), true);

    const selection = client("selection-read");
    const read = await selection.auth.getSession();
    assert.equal(read.data.session?.access_token, "access-hub");
    assert.equal(read.data.session?.user.id, user.id);

    const refreshed = await selection.auth.refreshSession();
    assert.equal(refreshed.error, null);
    assert.equal(refreshed.data.session?.access_token, "access-refreshed");

    const hubAfterRefresh = client("hub-after-refresh");
    const afterRefresh = await hubAfterRefresh.auth.getSession();
    assert.equal(afterRefresh.data.session?.access_token, "access-refreshed");

    const signedOut = await hubAfterRefresh.auth.signOut();
    assert.equal(signedOut.error, null);
    assert.equal(jar.has(COOKIE), false);

    const selectionAfterLogout = client("selection-after-logout");
    const afterLogout = await selectionAfterLogout.auth.getSession();
    assert.equal(afterLogout.data.session, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
