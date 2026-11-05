import "../app/lib/server/patchNodeUrlParse.ts";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { safePushPath } from "../app/lib/server/pushPath.ts";

const require = createRequire(import.meta.url);
const nodeUrl = require("node:url") as {
  parse: (input: string) => {
    protocol: string | null;
    host: string | null;
    hostname: string | null;
    port: string | null;
    path: string | null;
  };
};

const warnings: string[] = [];
process.on("warning", (warning) => {
  warnings.push(`${warning.name}: ${warning.message}`);
});

const parsed = nodeUrl.parse(
  "https://fcm.googleapis.com/fcm/send/abc?x=1",
);
assert.equal(parsed.protocol, "https:");
assert.equal(parsed.hostname, "fcm.googleapis.com");
assert.equal(parsed.host, "fcm.googleapis.com");
assert.equal(parsed.port, null);
assert.equal(parsed.path, "/fcm/send/abc?x=1");

const webpush = require("web-push") as {
  generateVAPIDKeys: () => { publicKey: string; privateKey: string };
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  generateRequestDetails: (subscription: { endpoint: string }) => { endpoint: string };
};

const keys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
  "https://www.sakamatch.com",
  keys.publicKey,
  keys.privateKey,
);
const details = webpush.generateRequestDetails({
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
});
assert.equal(details.endpoint, "https://fcm.googleapis.com/fcm/send/abc");

assert.equal(safePushPath("/chat/abc"), "/chat/abc");
assert.equal(safePushPath("https://evil.example/phish"), "/");
assert.equal(safePushPath("//evil.example"), "/");
assert.equal(safePushPath("javascript:alert(1)"), "/");

const deprecated = warnings.filter((warning) => warning.includes("url.parse"));
assert.deepEqual(deprecated, []);

console.log("push url parse and path checks passed");
