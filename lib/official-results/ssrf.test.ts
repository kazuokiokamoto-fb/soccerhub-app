import assert from "node:assert/strict";
import test from "node:test";
import { inspectPublicUrl, isBlockedIp, publicAddresses } from "./ssrf.ts";

test("only public https URLs are eligible", () => {
  assert.equal(inspectPublicUrl("http://example.com/a").ok, false);
  assert.equal(inspectPublicUrl("https://user:pass@example.com/a").ok, false);
  assert.equal(inspectPublicUrl("https://127.0.0.1/a").ok, false);
  assert.equal(inspectPublicUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(inspectPublicUrl("https://metadata.google.internal/").ok, false);
  assert.equal(inspectPublicUrl("https://example.com:8443/a").ok, false);
  assert.equal(inspectPublicUrl("https://example.com/results").ok, true);
});

test("private and local addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.4", "169.254.1.1", "::1", "fd00::1"]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  assert.equal(isBlockedIp("93.184.216.34"), false);
});

test("dns answers that include a private address are rejected", async () => {
  await assert.rejects(
    publicAddresses("team.example", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    /unsafe_url/,
  );
  const addresses = await publicAddresses("team.example", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  assert.deepEqual(addresses, ["93.184.216.34"]);
});
