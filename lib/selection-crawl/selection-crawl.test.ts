import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chooseEventDate,
  dateIsExplicit,
  displayStatusForDates,
  filterExtractedDates,
  keptDatesForGroup,
  plusYears,
} from "./dates.ts";
import { decideOfficialSite, distinctiveParts, scoreOfficialPage } from "./official-site.ts";
import { hostFailureBlocksStaleHide, hostObservationFailure, hostVisitDecision, HOST_INTERVAL_MS } from "./politeness.ts";
import {
  compareSelectionStrength,
  isTopSelectionTier,
  selectionStrengthTier,
  takeDiverseHosts,
  tierFromLeagueName,
} from "./priority.ts";
import { robotsAllows, robotsDecision, robotsPathMatches, SELECTION_CRAWL_USER_AGENT } from "./robots.ts";
import { isPublicHttpUrl, isUncrawlableUrl, officialCrawlTarget, selectionIdentity } from "./urls.ts";

test("robots.txt is honored for this crawler and for other agents", () => {
  const robots = `User-agent: *
Disallow: /private
Allow: /private/public

User-agent: SakamatchSelectionBot
Disallow: /secret
`;
  const secret = new URL("https://example.com/secret");
  const visible = new URL("https://example.com/club");
  const nested = new URL("https://example.com/private/public");
  const hidden = new URL("https://example.com/private/admin");
  assert.equal(robotsAllows(robots, secret), false);
  assert.equal(robotsAllows(robots, visible), true);
  assert.equal(robotsAllows(robots, hidden, "other-bot"), false);
  assert.equal(robotsAllows(robots, nested, "other-bot"), true);
  assert.equal(robotsDecision(404, "", visible), "allow");
  assert.equal(robotsDecision(401, "", visible), "allow");
  assert.equal(robotsDecision(403, "", visible), "allow");
  assert.equal(robotsDecision(500, "User-agent: *\nDisallow: /\n", visible), "allow");
  assert.equal(robotsDecision(0, "", visible), "allow");
  assert.equal(
    robotsDecision(200, "User-agent: *\nDisallow: /club\n", visible),
    "deny",
  );
  assert.match(SELECTION_CRAWL_USER_AGENT, /https:\/\/www\.sakamatch\.com\//);
  assert.equal(SELECTION_CRAWL_USER_AGENT.includes("Chrome"), false);
});

test("the selection crawler user agent is ASCII and a valid header", () => {
  assert.match(SELECTION_CRAWL_USER_AGENT, /^[\u0000-\u007F]+$/);
  assert.equal([...SELECTION_CRAWL_USER_AGENT].every((char) => char.charCodeAt(0) < 128), true);
  assert.doesNotThrow(() => new Headers({ "user-agent": SELECTION_CRAWL_USER_AGENT }));
});

test("robots.txt * and $ follow RFC 9309", () => {
  assert.equal(robotsPathMatches("/*.pdf$", "/files/a.pdf"), true);
  assert.equal(robotsPathMatches("/*.pdf$", "/files/a.pdfx"), false);
  assert.equal(robotsPathMatches("/*.pdf$", "/files/a.PDF"), false);
  assert.equal(robotsPathMatches("/fish", "/fish.html"), true);
  assert.equal(robotsPathMatches("/fish$", "/fish"), true);
  assert.equal(robotsPathMatches("/fish$", "/fish.html"), false);
  const robots = `User-agent: *
Disallow: /files/
Allow: /files/*.pdf$
Disallow: /*.pdf$
Disallow: /
Allow: /ok$
`;
  assert.equal(robotsAllows(robots, new URL("https://example.com/files/a.pdf")), true);
  assert.equal(robotsAllows(robots, new URL("https://example.com/files/a.txt")), false);
  assert.equal(robotsAllows(robots, new URL("https://example.com/other/a.pdf")), false);
  assert.equal(robotsAllows(robots, new URL("https://example.com/ok")), true);
  assert.equal(robotsAllows(robots, new URL("https://example.com/ok/more")), false);
});

test("a network or robots failure newer than last_seen blocks the stale hide", () => {
  const seen = Date.parse("2026-01-01T00:00:00.000Z");
  const failed = Date.parse("2026-11-12T00:00:00.000Z");
  assert.equal(hostObservationFailure("timeout"), "network");
  assert.equal(hostObservationFailure("robots"), "robots");
  assert.equal(hostObservationFailure("http"), null);
  assert.equal(hostFailureBlocksStaleHide(seen, "network", failed), true);
  assert.equal(hostFailureBlocksStaleHide(seen, "robots", failed), true);
  assert.equal(hostFailureBlocksStaleHide(failed, "network", seen), false);
  assert.equal(hostFailureBlocksStaleHide(seen, "rate", failed), false);
  assert.equal(hostFailureBlocksStaleHide(seen, null, failed), false);
});

test("instagram and private hosts are not crawl targets", () => {
  assert.equal(isUncrawlableUrl("https://www.instagram.com/almundo_fc/"), true);
  assert.equal(isUncrawlableUrl("https://almundo-fc.example.jp/"), false);
  assert.equal(isPublicHttpUrl("http://127.0.0.1/admin"), false);
  assert.equal(isPublicHttpUrl("https://fc-tokyo.example.jp/"), true);
  assert.equal(
    selectionIdentity("team-1", "https://Example.jp/club/"),
    selectionIdentity("team-1", "http://example.jp/club"),
  );
  assert.equal(selectionIdentity("team-1", "https://example.jp/club").includes("2026"), false);
});

test("crawl-day dates collapse to one kept set and stay consistent", () => {
  const rows = [
    {
      eventDate: "2026-07-06",
      eventDates: ["2026-07-06"],
      createdAt: "2026-07-06T01:00:00.000Z",
      lastSeenAt: "2026-07-06T01:00:00.000Z",
    },
    {
      eventDate: "2026-08-01",
      eventDates: ["2026-08-01", "2027-08-01"],
      createdAt: "2026-08-01T02:00:00.000Z",
      lastSeenAt: "2026-08-01T02:00:00.000Z",
    },
    {
      eventDate: "2026-09-12",
      eventDates: ["2026-09-12"],
      createdAt: "2026-09-12T03:00:00.000Z",
      lastSeenAt: "2026-09-12T03:00:00.000Z",
    },
  ];
  assert.deepEqual(keptDatesForGroup(rows), []);
  const real = {
    eventDate: "2026-11-20",
    eventDates: ["2026-11-20", "2026-12-04"],
    createdAt: "2026-08-01T02:00:00.000Z",
    lastSeenAt: "2026-08-01T02:00:00.000Z",
  };
  assert.deepEqual(keptDatesForGroup([...rows, real]), ["2026-11-20", "2026-12-04"]);
  assert.equal(chooseEventDate(["2026-01-01", "2026-12-04"], "2026-11-12"), "2026-12-04");
  assert.equal(chooseEventDate(["2026-01-01", "2026-03-01"], "2026-11-12"), "2026-03-01");
  assert.equal(chooseEventDate([], "2026-11-12"), null);
  assert.equal(
    displayStatusForDates({ dates: ["2026-01-01"], today: "2026-11-12", deadline: null, rolling: false }),
    "開催終了",
  );
});

test("a single stored row keeps its date, and a new crawl drops an unstated anniversary", () => {
  const single = keptDatesForGroup([
    {
      eventDate: "2026-07-06",
      eventDates: null,
      createdAt: "2026-07-06T00:00:00.000Z",
    },
  ]);
  assert.deepEqual(single, ["2026-07-06"]);
  const now = new Date("2026-11-12T00:00:00.000Z");
  assert.deepEqual(filterExtractedDates(["2026-11-12", "2027-11-12", "2026-12-01"], now, "12月1日"), [
    "2026-12-01",
  ]);
  assert.equal(dateIsExplicit("2027年11月12日に開催", "2027-11-12"), true);
  assert.deepEqual(
    filterExtractedDates(["2027-11-12"], now, "2027年11月12日に開催"),
    ["2027-11-12"],
  );
  assert.equal(plusYears("2024-02-29", 1), "2025-02-28");
});

test("official-site auto-accept needs a verified high-confidence homepage", () => {
  assert.deepEqual(distinctiveParts("F.C.リリー"), ["リリ"]);
  const good = scoreOfficialPage({
    url: "https://almundo-fc.example.jp/",
    title: "Almundo FC 公式サイト",
    text: "東京都のサッカークラブ Almundo です。体験練習会を行っています。".repeat(5),
    teamName: "Almundo",
    prefecture: "東京都",
  });
  const media = scoreOfficialPage({
    url: "https://www.juniorsoccer-news.com/post-1",
    title: "Almundo セレクション",
    text: "Almundo の募集",
    teamName: "Almundo",
    prefecture: "東京都",
  });
  const article = scoreOfficialPage({
    url: "https://random-blog.example/news/2026/almundo-won",
    title: "Almundo が優勝",
    text: `${"Almundo の試合結果です。".repeat(20)} 東京都`,
    teamName: "Almundo",
    prefecture: "東京都",
  });
  assert.equal(media.blocked, true);
  const accepted = decideOfficialSite("Almundo", [
    { url: "https://almundo-fc.example.jp/", score: good.score, reasons: good.reasons, verified: true, blocked: false },
    { url: "https://random-blog.example/news/2026/almundo-won", score: article.score, reasons: article.reasons, verified: true, blocked: false },
  ]);
  assert.equal(accepted.decision, "auto_accept");
  assert.equal(accepted.crawlTarget, "https://almundo-fc.example.jp");
  assert.ok(good.score >= 120);

  const short = scoreOfficialPage({
    url: "https://example.jp/",
    title: "DIOS FC",
    text: "東京都のクラブ DIOS です。体験会あります。".repeat(8),
    teamName: "DIOS",
    prefecture: "東京都",
  });
  const shortDecision = decideOfficialSite("DIOS", [
    { url: "https://example.jp/", score: short.score, reasons: short.reasons, verified: true, blocked: false },
  ]);
  assert.equal(shortDecision.decision, "pending");

  const namedHost = scoreOfficialPage({
    url: "https://dios-fc.jp/about",
    title: "DIOS FC 公式",
    text: "DIOS は東京都のサッカークラブです。体験練習を実施します。".repeat(6),
    teamName: "DIOS",
    prefecture: "東京都",
  });
  const named = decideOfficialSite("DIOS", [
    { url: "https://dios-fc.jp/about", score: namedHost.score, reasons: namedHost.reasons, verified: true, blocked: true },
  ]);
  assert.equal(named.decision, "none");
  const verifiedNamed = decideOfficialSite("DIOS", [
    { url: "https://dios-fc.jp/about", score: namedHost.score, reasons: namedHost.reasons, verified: true, blocked: false },
  ]);
  assert.equal(verifiedNamed.decision, "auto_accept");
  assert.equal(officialCrawlTarget("https://dios.jimdofree.com/team"), "https://dios.jimdofree.com/team");
});

test("strong leagues are crawled before lower ones", () => {
  assert.equal(tierFromLeagueName("高円宮杯プレミアリーグ"), 10);
  assert.equal(tierFromLeagueName("プリンスリーグ関東"), 10);
  assert.equal(tierFromLeagueName("関東ユース(U-15)サッカーリーグ 1部"), 10);
  assert.equal(tierFromLeagueName("関東ユース(U-15)サッカーリーグ 2部"), 20);
  assert.equal(tierFromLeagueName("埼玉県クラブユース U-15 1部"), 20);
  assert.equal(tierFromLeagueName("東京都クラブユース U-15 T1"), 20);
  assert.equal(tierFromLeagueName("千葉県U-15 TOPリーグ"), 20);
  assert.equal(tierFromLeagueName("群馬県U-15 ウルトラリーグ"), 20);
  assert.equal(tierFromLeagueName("東京都クラブユース U-15 T2"), 30);
  assert.equal(tierFromLeagueName("千葉県U-12 2N01"), 30);
  assert.equal(tierFromLeagueName("埼玉県U-12 地区トップ"), 60);
  assert.equal(isTopSelectionTier(selectionStrengthTier({ leagueName: "プリンスリーグ関東" })), true);
  assert.equal(isTopSelectionTier(selectionStrengthTier({ leagueName: "東京都クラブユース U-15 T2" })), false);

  const premier = selectionStrengthTier({ leagueName: "プリンスリーグ関東" });
  const first = selectionStrengthTier({ leagueLevel: "prefecture", leagueDivision: 1 });
  const fourth = selectionStrengthTier({ leagueLevel: "prefecture", leagueDivision: 4 });
  const district = selectionStrengthTier({ leagueLevel: "district", leagueDivision: 1 });
  const ranked = selectionStrengthTier({ leagueRank: 14, leagueName: "東京都クラブユース U-15 T4" });
  const strength = selectionStrengthTier({ strengthRank: "SS" });
  const unknown = selectionStrengthTier({});
  assert.ok(premier < first);
  assert.ok(first < fourth);
  assert.ok(fourth < district);
  assert.equal(first, 20);
  assert.equal(ranked, 50);
  assert.equal(strength, 20);
  assert.equal(unknown, 90);
  assert.ok(
    compareSelectionStrength(
      { leagueName: "埼玉県クラブユース U-15 1部", leagueRank: 21 },
      { leagueName: "東京都クラブユース U-15 T2", leagueRank: 12 },
    ) < 0,
  );
  assert.equal(
    selectionStrengthTier({ leagueLevel: "prefecture", leagueDivision: 1, leagueRank: 201 }),
    20,
  );
});

test("a day's crawl finishes every top-tier team before a lower tier", () => {
  const teams = [
    { id: "low-a", host: "low-a.example", leagueName: "東京都クラブユース U-15 T4", leagueRank: 14, checkedAt: null },
    { id: "top-b", host: "top-b.example", leagueName: "埼玉県クラブユース U-15 1部", leagueRank: 21, checkedAt: null },
    { id: "top-a", host: "shared.example", leagueName: "関東ユース(U-15)サッカーリーグ 1部", leagueRank: 1, checkedAt: null },
    { id: "top-c", host: "shared.example", leagueName: "プリンスリーグ関東", leagueRank: null, checkedAt: null },
    { id: "low-b", host: "low-b.example", leagueName: "埼玉県U-12 地区トップ", leagueRank: 243, checkedAt: null },
    { id: "mid", host: "mid.example", leagueName: "東京都クラブユース U-15 T2", leagueRank: 12, checkedAt: null },
  ];
  const pending = [...teams];
  const crawled: typeof teams = [];
  while (pending.length > 0) {
    pending.sort(compareSelectionStrength);
    const batch = takeDiverseHosts(pending, 2, (team) => team.host);
    assert.ok(batch.length > 0);
    crawled.push(...batch);
    const chosen = new Set(batch.map((team) => team.id));
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      if (chosen.has(pending[i].id)) pending.splice(i, 1);
    }
  }
  const lastTop = crawled.findLastIndex((team) => isTopSelectionTier(selectionStrengthTier(team)));
  const firstLower = crawled.findIndex((team) => !isTopSelectionTier(selectionStrengthTier(team)));
  assert.ok(lastTop >= 0 && firstLower >= 0 && lastTop < firstLower);
  assert.deepEqual(
    crawled.map((team) => team.id),
    ["top-a", "top-b", "top-c", "mid", "low-a", "low-b"],
  );
});

test("coverage is reported per league tier", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261112140000_selection_crawl_pipeline.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace view public\.selection_strength_coverage/);
  for (const column of [
    "teams_total",
    "teams_with_official_site",
    "teams_fetched_ok",
    "teams_with_selection_page",
    "teams_with_dated_events",
  ]) {
    assert.match(sql, new RegExp(column));
  }
  assert.match(sql, /プレミア・プリンス・関東1部/);
  assert.match(sql, /Only a 2xx body can Disallow/);
});

test("the status check allows collapsed before any row update", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261112140000_selection_crawl_pipeline.sql", import.meta.url), "utf8");
  const executable = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const widened = executable.indexOf("check (status in ('draft', 'published', 'hidden', 'expired', 'collapsed'))");
  const collapsedWrite = executable.indexOf("status = 'collapsed'");
  assert.ok(widened > 0);
  assert.ok(collapsedWrite > widened);
  assert.match(executable, /drop constraint if exists selection_events_status_check/);
  assert.match(executable, /create table if not exists public\.selection_events_backup_20261112|to_regclass\('public\.selection_events_backup_20261112'\)/);

  const rollback = sql.slice(0, sql.indexOf("do $backup$"));
  const restoreAt = rollback.indexOf("from public.selection_events_backup_20261112 b");
  const oldCheckAt = rollback.indexOf("check (status in ('draft', 'published', 'hidden', 'expired'))");
  assert.ok(restoreAt > 0);
  assert.ok(oldCheckAt > restoreAt);
});

test("a host is fetched once per minute, with a short same-visit page cap", () => {
  const now = 1_000_000;
  const defer = hostVisitDecision({
    now,
    state: { robotsFetchedAt: now - 1000, backoffUntil: null, lastRequestAt: now - 1000 },
    inOpenVisit: false,
    pagesThisVisit: 0,
  });
  assert.equal(defer.type, "defer");
  if (defer.type === "defer") assert.equal(defer.retryAt, now - 1000 + HOST_INTERVAL_MS);

  const again = hostVisitDecision({
    now,
    state: { robotsFetchedAt: now - 1000, backoffUntil: null, lastRequestAt: now - 1000 },
    inOpenVisit: true,
    pagesThisVisit: 1,
  });
  assert.deepEqual(again, { type: "fetch", refreshRobots: false });

  const capped = hostVisitDecision({
    now,
    state: { robotsFetchedAt: now - 1000, backoffUntil: null, lastRequestAt: now - 1000 },
    inOpenVisit: true,
    pagesThisVisit: 4,
  });
  assert.equal(capped.type, "cap");
});
