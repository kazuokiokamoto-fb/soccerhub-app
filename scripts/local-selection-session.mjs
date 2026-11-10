/**
 * Local two-zone session check. Talks only to 127.0.0.1.
 * The auth server is an isolated fixture. It does not call production Supabase.
 *
 * Expects the hub on :3000 and the selection app on :3001, both built with
 * NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { rmSync, writeFileSync } from "node:fs";

const AUTH_ORIGIN = "http://127.0.0.1:54321";
const HUB = "http://127.0.0.1:3000";
const CHILD = "http://127.0.0.1:3001";
const EMAIL = "player@example.com";
const PASSWORD = "local-pass-8294";
const EVENT_ID = "22222222-2222-2222-2222-222222222222";
const COOKIE_PREFIX = "sb-127-auth-token";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const now = new Date();
const upcoming = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
const eventDate = upcoming.toISOString().slice(0, 10);
const admissionYear = now.getMonth() + 1 >= 4 ? now.getFullYear() + 1 : now.getFullYear();

const event = {
  id: EVENT_ID,
  team_master_id: null,
  organization_name: "ローカルFC",
  organization_type: "club_team",
  target_categories: ["U12"],
  gender: "any",
  prefecture: "東京都",
  area: "東京都",
  city: "渋谷区",
  venue_name: "ローカルグラウンド",
  venue_address: "東京都渋谷区",
  event_date: eventDate,
  event_dates: [eventDate],
  source_url: "https://example.com/selection",
  official_url: "https://example.com/selection",
  title: "ローカル確認セレクション",
  display_status: "募集中",
  source_rank: "district",
  admission_fiscal_year: admissionYear,
  is_rolling_recruitment: false,
  fetched_at: "2026-11-01T00:00:00.000Z",
  created_at: "2026-11-01T00:00:00.000Z",
  content_updated_at: "2026-11-01T00:00:00.000Z",
  summary: "ローカルの確認用です",
  description: "ローカルの確認用です",
};

const counts = { password: 0, refresh: 0, user: 0, logout: 0, badPassword: 0, badRefresh: 0 };
const sessions = new Map();
let tokenSerial = 0;

function issueSession() {
  tokenSerial += 1;
  const access = `access-${tokenSerial}`;
  const refresh = `refresh-${tokenSerial}`;
  const session = {
    access_token: access,
    refresh_token: refresh,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
  sessions.set(refresh, session);
  return session;
}

function knownAccess(token) {
  for (const session of sessions.values()) {
    if (session.access_token === token) return true;
  }
  return false;
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function startMock() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", AUTH_ORIGIN);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      });
      res.end();
      return;
    }
    if (url.pathname === "/__test/stats") {
      json(res, 200, counts);
      return;
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const body = await readBody(req);
      if (body.email !== EMAIL || body.password !== PASSWORD) {
        counts.badPassword += 1;
        json(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return;
      }
      counts.password += 1;
      json(res, 200, issueSession());
      return;
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const body = await readBody(req);
      const current = sessions.get(body.refresh_token);
      if (!current) {
        counts.badRefresh += 1;
        json(res, 400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return;
      }
      counts.refresh += 1;
      sessions.delete(body.refresh_token);
      json(res, 200, issueSession());
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      counts.logout += 1;
      sessions.clear();
      json(res, 200, {});
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!knownAccess(token)) {
        json(res, 401, { error_code: "bad_jwt", msg: "invalid claim" });
        return;
      }
      counts.user += 1;
      json(res, 200, user);
      return;
    }
    if (url.pathname === "/rest/v1/selection_events_public") {
      const accept = String(req.headers.accept || "");
      const wantsObject = accept.includes("vnd.pgrst.object");
      const id = url.searchParams.get("id");
      if (id && id !== `eq.${EVENT_ID}`) {
        json(res, wantsObject ? 406 : 200, wantsObject ? { code: "PGRST116", message: "0 rows" } : []);
        return;
      }
      if (wantsObject) {
        json(res, 200, event);
        return;
      }
      json(res, 200, [event], { "content-range": "0-0/1" });
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      json(res, 200, []);
      return;
    }
    json(res, 404, { msg: "not found", path: url.pathname });
  });
  return new Promise((resolve) => {
    server.listen(54321, "127.0.0.1", () => resolve(server));
  });
}

async function stats() {
  const response = await fetch(`${AUTH_ORIGIN}/__test/stats`);
  return response.json();
}

class Browser {
  constructor(ws) {
    this.ws = ws;
    this.next = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.next;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async open(url) {
    const created = await this.send("Target.createTarget", { url });
    const attached = await this.send("Target.attachToTarget", {
      targetId: created.targetId,
      flatten: true,
    });
    const sessionId = attached.sessionId;
    await this.send("Page.enable", {}, sessionId);
    await this.send("Network.enable", {}, sessionId);
    await this.send("Runtime.enable", {}, sessionId);
    return sessionId;
  }

  async evaluate(sessionId, expression) {
    const result = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    );
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
  }

  async navigate(sessionId, url) {
    await this.send("Page.navigate", { url }, sessionId);
    await this.waitFor(sessionId, `document.readyState === "complete"`);
  }

  async waitFor(sessionId, expression, timeoutMs = 15000) {
    const started = Date.now();
    let lastError = "";
    while (Date.now() - started < timeoutMs) {
      try {
        const ready = await this.evaluate(sessionId, `Boolean(${expression})`);
        if (ready) return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (lastError) console.error("last wait error", lastError.slice(0, 300));
    const href = await this.evaluate(sessionId, "location.href");
    const text = await this.evaluate(sessionId, "document.body ? document.body.innerText.slice(0, 700) : ''");
    throw new Error(`timeout waiting for ${expression} at ${href}: ${text}`);
  }

  setCookieLines() {
    const lines = [];
    for (const event of this.events) {
      if (event.method !== "Network.responseReceivedExtraInfo" && event.method !== "Network.responseReceived") {
        continue;
      }
      const headers = event.params.headers || {};
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() !== "set-cookie") continue;
        String(value)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => lines.push(line));
      }
    }
    return lines;
  }
}

async function launchChrome() {
  rmSync("/tmp/selection-chrome-profile", { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9223",
    "--user-data-dir=/tmp/selection-chrome-profile",
    "about:blank",
  ], { stdio: "ignore" });
  const started = Date.now();
  let version;
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch("http://127.0.0.1:9223/json/version");
      version = await response.json();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (!version) throw new Error("chrome did not open a debugging port");
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  return { chrome, browser: new Browser(ws) };
}

async function fillLogin(browser, sessionId, email, password) {
  await browser.evaluate(
    sessionId,
    `(() => {
      const set = (selector, value) => {
        const element = document.querySelector(selector);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set('input[type="email"]', ${JSON.stringify(email)});
      set('input[type="password"]', ${JSON.stringify(password)});
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "ログイン");
      if (!button) throw new Error("login button missing");
      button.click();
      return true;
    })()`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const report = { checks: [] };
  const mock = await startMock();
  let chrome;
  const record = (name, detail) => {
    report.checks.push({ name, ...detail });
    console.log(name, JSON.stringify(detail));
  };
  try {
    const launched = await launchChrome();
    chrome = launched.chrome;
    const browser = launched.browser;

    const loggedOut = await fetch(`${CHILD}/selection`, { redirect: "manual" });
    record("direct child without cookie", {
      status: loggedOut.status,
      location: loggedOut.headers.get("location"),
    });
    assert(loggedOut.status === 307, "direct child should redirect");
    assert(
      loggedOut.headers.get("location") === `${HUB}/login?redirect=%2Fselection`,
      `direct child login must be the hub, got ${loggedOut.headers.get("location")}`
    );

    const page = await browser.open(`${HUB}/login?redirect=%2Fselection`);
    await browser.waitFor(page, `document.querySelector('input[type="email"]')`);
    await fillLogin(browser, page, EMAIL, "wrong-password");
    await browser.waitFor(page, `document.body.innerText.includes("ログインに失敗しました")`);
    const afterBad = await browser.evaluate(page, `({ href: location.href, cookie: document.cookie })`);
    record("wrong password", afterBad);
    assert(afterBad.href.startsWith(`${HUB}/login`), "wrong password stays on the hub login");
    assert(!afterBad.cookie.includes(COOKIE_PREFIX), "wrong password must not set a session cookie");

    await fillLogin(browser, page, EMAIL, PASSWORD);
    await browser.waitFor(page, `document.body.innerText.includes("ローカル確認セレクション")`);
    const loggedIn = await browser.evaluate(
      page,
      `({ href: location.href, text: document.body.innerText.includes("セレクション情報") })`
    );
    const cookies = await browser.send("Network.getCookies", { urls: [HUB] }, page);
    const sessionCookie = (cookies.cookies || []).find((cookie) => cookie.name.startsWith(COOKIE_PREFIX));
    record("logged in on selection", {
      href: loggedIn.href,
      text: loggedIn.text,
      cookieName: sessionCookie?.name || null,
      domain: sessionCookie?.domain || null,
      path: sessionCookie?.path || null,
      sameSite: sessionCookie?.sameSite || null,
      httpOnly: sessionCookie?.httpOnly ?? null,
    });
    assert(loggedIn.href === `${HUB}/selection`, loggedIn.href);
    assert(loggedIn.text, "selection page text missing");
    assert(sessionCookie, "session cookie missing");
    assert(sessionCookie.domain === "127.0.0.1", `cookie domain ${sessionCookie.domain}`);
    assert(!String(sessionCookie.domain).includes("sakamatch"), "cookie domain widened");
    assert(sessionCookie.path === "/", sessionCookie.path);

    await browser.evaluate(page, `document.querySelector('a[href*="${EVENT_ID}"]').click()`);
    await browser.waitFor(page, `location.pathname === "/selection/${EVENT_ID}" && document.body.innerText.includes("ローカル確認セレクション")`);
    const detail = await browser.evaluate(page, "location.href");
    record("detail", { href: detail });
    assert(detail.startsWith(`${HUB}/selection/${EVENT_ID}`), detail);

    await browser.evaluate(page, `[...document.querySelectorAll('a')].find((item) => item.getAttribute('href') === '/').click()`);
    await browser.waitFor(
      page,
      `location.pathname === "/" && [...document.querySelectorAll("button")].some((item) => item.textContent.trim() === "ログアウト")`
    );
    const home = await browser.evaluate(page, "location.href");
    record("back to hub home", { href: home, logout: true });
    assert(home === `${HUB}/`, home);

    await browser.waitFor(page, `[...document.querySelectorAll("a")].some((item) => item.textContent.trim() === "セレ")`);
    await browser.evaluate(page, `[...document.querySelectorAll("a")].find((item) => item.textContent.trim() === "セレ").click()`);
    await browser.waitFor(page, `location.pathname === "/selection" && document.body.innerText.includes("ローカル確認セレクション")`);
    record("hub tab back to selection", { href: await browser.evaluate(page, "location.href") });

    const beforeRefresh = await stats();
    browser.events = [];
    await browser.evaluate(
      page,
      `(() => {
        const prefix = ${JSON.stringify(COOKIE_PREFIX)};
        const raw = document.cookie.split("; ").find((item) => item.startsWith(prefix + "=") || item.startsWith(prefix + "."));
        if (!raw) throw new Error("missing cookie");
        const name = raw.slice(0, raw.indexOf("="));
        const value = decodeURIComponent(raw.slice(raw.indexOf("=") + 1));
        const encoded = value.startsWith("base64-") ? value.slice("base64-".length) : value;
        const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
        const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
        const session = JSON.parse(new TextDecoder().decode(bytes));
        session.expires_at = Math.floor(Date.now() / 1000) - 30;
        session.expires_in = 0;
        const jsonText = JSON.stringify(session);
        const utf8 = new TextEncoder().encode(jsonText);
        let binary = "";
        utf8.forEach((byte) => { binary += String.fromCharCode(byte); });
        const next = "base64-" + btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
        document.cookie = name + "=" + next + "; Path=/; Max-Age=4000000; SameSite=Lax";
        location.assign("/selection");
      })()`
    );
    await browser.waitFor(page, `location.pathname === "/selection" && document.body.innerText.includes("ローカル確認セレクション")`);
    const afterRefresh = await stats();
    const refreshHeaders = browser.setCookieLines().filter((line) => line.includes(COOKIE_PREFIX));
    const refreshed = await browser.evaluate(
      page,
      `({ href: location.href, logout: [...document.querySelectorAll("button")].some((item) => item.textContent.trim() === "ログアウト") })`
    );
    const refreshDelta = afterRefresh.refresh - beforeRefresh.refresh;
    record("expired access token refreshed by selection zone", {
      href: refreshed.href,
      logout: refreshed.logout,
      refreshDelta,
      userDelta: afterRefresh.user - beforeRefresh.user,
      badRefreshDelta: afterRefresh.badRefresh - beforeRefresh.badRefresh,
      setCookieHasDomain: refreshHeaders.some((line) => /domain=/i.test(line)),
      setCookieCount: refreshHeaders.length,
    });
    assert(refreshed.href === `${HUB}/selection`, refreshed.href);
    assert(refreshed.logout, "refresh dropped the session");
    assert(refreshDelta >= 1 && refreshDelta <= 2, `refresh count ${refreshDelta}`);
    assert(afterRefresh.badRefresh === beforeRefresh.badRefresh, "a refresh token was rejected");
    assert(refreshHeaders.length > 0, "selection refresh did not set a cookie");
    assert(refreshHeaders.every((line) => !/domain=/i.test(line)), refreshHeaders.join(" | "));

    const hubTab = page;
    const selectionTab = await browser.open(`${HUB}/selection`);
    await browser.waitFor(selectionTab, `document.body.innerText.includes("ローカル確認セレクション")`);
    await browser.navigate(hubTab, `${HUB}/match`);
    const matchUrl = await browser.evaluate(hubTab, "location.href");
    assert(matchUrl.startsWith(`${HUB}/match`), matchUrl);
    await browser.evaluate(
      selectionTab,
      `[...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "ログアウト").click()`
    );
    await browser.waitFor(hubTab, `location.pathname === "/login"`, 20000);
    await browser.waitFor(selectionTab, `location.pathname === "/login"`, 20000);
    const fromSelection = {
      hub: await browser.evaluate(hubTab, "location.href"),
      selection: await browser.evaluate(selectionTab, "location.href"),
    };
    record("logout on selection tab", fromSelection);
    assert(fromSelection.hub.startsWith(`${HUB}/login?redirect=%2Fmatch`), fromSelection.hub);
    assert(fromSelection.selection.startsWith(`${HUB}/login`), fromSelection.selection);

    await browser.navigate(hubTab, `${HUB}/login?redirect=%2Fmatch`);
    await browser.waitFor(hubTab, `document.querySelector('input[type="email"]')`);
    await fillLogin(browser, hubTab, EMAIL, PASSWORD);
    await browser.waitFor(hubTab, `location.pathname === "/match"`, 20000);
    await browser.navigate(selectionTab, `${HUB}/selection`);
    await browser.waitFor(selectionTab, `document.body.innerText.includes("ローカル確認セレクション")`, 20000);
    await browser.evaluate(
      hubTab,
      `[...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "ログアウト").click()`
    );
    await browser.waitFor(selectionTab, `location.pathname === "/login"`, 20000);
    await browser.waitFor(hubTab, `location.pathname === "/login"`, 20000);
    const fromHub = {
      hub: await browser.evaluate(hubTab, "location.href"),
      selection: await browser.evaluate(selectionTab, "location.href"),
    };
    record("logout on hub tab", fromHub);
    assert(fromHub.selection.startsWith(`${HUB}/login?redirect=%2Fselection`), fromHub.selection);
    assert(fromHub.hub.startsWith(`${HUB}/login`), fromHub.hub);

    await browser.navigate(hubTab, `${HUB}/selection`);
    const protectedAfter = await browser.evaluate(hubTab, "location.href");
    await browser.navigate(selectionTab, `${HUB}/`);
    const publicAfter = await browser.evaluate(selectionTab, "location.href");
    const cookieAfter = await browser.evaluate(hubTab, "document.cookie");
    record("after logout", { protectedAfter, publicAfter, hasSessionCookie: cookieAfter.includes(COOKIE_PREFIX) });
    assert(protectedAfter.startsWith(`${HUB}/login?redirect=%2Fselection`), protectedAfter);
    assert(publicAfter === `${HUB}/`, publicAfter);
    assert(!cookieAfter.includes(COOKIE_PREFIX), "session cookie remained after logout");

    report.ok = true;
  } finally {
    if (chrome) chrome.kill();
    mock.close();
    writeFileSync("/tmp/selection-session-report.json", JSON.stringify(report, null, 2));
  }
  if (!report.ok) process.exit(1);
  console.log("SESSION_OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
