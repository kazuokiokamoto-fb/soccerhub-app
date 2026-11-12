import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedIp } from "../official-results/ssrf.ts";
import { inspectCrawlUrl } from "./crawlUrl.ts";
import { fetchCrawlPage } from "./fetchPage.ts";

test("crawl URLs are public http or https", () => {
  assert.equal(inspectCrawlUrl("https://example.com/results").ok, true);
  assert.equal(inspectCrawlUrl("http://example.com/results").ok, true);
  assert.equal(inspectCrawlUrl("http://example.com:8080/results").ok, false);
  assert.equal(inspectCrawlUrl("https://user:pass@example.com/a").ok, false);
  assert.equal(inspectCrawlUrl("file:///etc/passwd").ok, false);
  assert.equal(inspectCrawlUrl("gopher://example.com/").ok, false);
  assert.equal(inspectCrawlUrl("javascript:alert(1)").ok, false);
});

test("private addresses are blocked for http and https", () => {
  for (const raw of [
    "http://127.0.0.1/latest",
    "https://127.0.0.1/latest",
    "http://10.1.2.3/a",
    "https://192.168.0.5/a",
    "http://172.16.0.4/a",
    "https://169.254.169.254/latest/meta-data",
    "http://[::1]/a",
    "http://[::ffff:127.0.0.1]/a",
    "https://metadata.google.internal/",
    "http://localhost/a",
  ]) {
    assert.equal(inspectCrawlUrl(raw).ok, false, raw);
  }
  assert.equal(isBlockedIp("10.1.2.3"), true);
  assert.equal(isBlockedIp("93.184.216.34"), false);
});

test("a private URL is refused before DNS or a request", async () => {
  const page = await fetchCrawlPage("http://10.0.0.8/latest", {
    lookup: async () => {
      throw new Error("lookup should not run");
    },
  });
  assert.equal(page.failure, "unsafe_url");
  assert.equal(page.html, null);
});
