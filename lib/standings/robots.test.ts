import assert from "node:assert/strict";
import test from "node:test";
import { CRAWL_USER_AGENT } from "./crawlUrl.ts";
import { robotsAllows } from "./robots.ts";

const robots = `User-agent: *
Disallow: /private
Allow: /private/public

User-agent: SakamatchResultsBot
Disallow: /secret
`;

test("robots.txt is honored for this crawler and for everyone else", () => {
  const secret = new URL("https://example.com/secret");
  const visible = new URL("https://example.com/results");
  const nested = new URL("https://example.com/private/public");
  const hidden = new URL("https://example.com/private/admin");
  assert.equal(robotsAllows(robots, secret, CRAWL_USER_AGENT), false);
  assert.equal(robotsAllows(robots, visible, CRAWL_USER_AGENT), true);
  assert.equal(robotsAllows(robots, hidden, "other-bot"), false);
  assert.equal(robotsAllows(robots, nested, "other-bot"), true);
  assert.equal(robotsAllows("", visible, CRAWL_USER_AGENT), true);
});
