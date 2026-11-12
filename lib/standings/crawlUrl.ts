import { isBlockedIp } from "../official-results/ssrf.ts";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

function hostBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  if (/^\d+$/.test(host)) return true;
  return false;
}

/** Public http(s) only. Private and link-local addresses are rejected. */
export function inspectCrawlUrl(raw: string): { ok: true; url: URL } | { ok: false } {
  if (typeof raw !== "string" || raw.length > 500) return { ok: false };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  if (url.username || url.password) return { ok: false };
  url.hash = "";
  const defaultPort = url.protocol === "http:" ? "80" : "443";
  if (url.port && url.port !== defaultPort) return { ok: false };
  const host = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  if (hostBlocked(host)) return { ok: false };
  if (isIP(host) && isBlockedIp(host)) return { ok: false };
  return { ok: true, url };
}

export const CRAWL_USER_AGENT =
  "SakamatchResultsBot/1.0 (+https://www.sakamatch.com/results)";
