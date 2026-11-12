import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { MAX_BYTES, publicAddresses, PublicFetchError } from "../official-results/ssrf.ts";
import { CRAWL_USER_AGENT, inspectCrawlUrl } from "./crawlUrl.ts";
import { robotsAllows } from "./robots.ts";

const TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 2;

type AddressLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string }>>;

type HeaderValue = string | string[] | undefined;

export type CrawlFailure =
  | "unsafe_url"
  | "robots"
  | "fetch_failed"
  | "too_large"
  | "unsupported_type"
  | "timeout";

export type CrawlDocument = {
  finalUrl: string;
  status: number;
  html: string | null;
  failure: CrawlFailure | null;
};

const ALLOWED_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

function headerValue(value: HeaderValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function requestOnce(url: URL, address: string): Promise<{ status: number; headers: Record<string, HeaderValue>; body: Buffer }> {
  const lib = url.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          host: url.host,
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "user-agent": CRAWL_USER_AGENT,
        },
        servername: url.hostname,
        timeout: TIMEOUT_MS,
        lookup: (_hostname, _options, callback) => {
          callback(null, address, isIP(address) === 6 ? 6 : 4);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new PublicFetchError("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new PublicFetchError("timeout"));
    });
    req.on("error", () => reject(new PublicFetchError("fetch_failed")));
    req.end();
  });
}

async function fetchOnce(
  url: URL,
  lookup: AddressLookup,
): Promise<{ status: number; headers: Record<string, HeaderValue>; body: Buffer; failure: CrawlFailure | null }> {
  let addresses: string[];
  try {
    addresses = await publicAddresses(url.hostname, lookup);
  } catch {
    return { status: 0, headers: {}, body: Buffer.alloc(0), failure: "unsafe_url" };
  }
  try {
    const response = await requestOnce(url, addresses[0]);
    return { ...response, failure: null };
  } catch (error) {
    const code = error instanceof PublicFetchError ? error.code : "fetch_failed";
    const failure: CrawlFailure =
      code === "too_large" || code === "timeout" || code === "unsupported_type" ? code : "fetch_failed";
    return { status: 0, headers: {}, body: Buffer.alloc(0), failure };
  }
}

const robotsCache = new Map<string, { at: number; body: string | null; deny: boolean }>();

async function robotsDecision(target: URL, lookup: AddressLookup): Promise<"allow" | "deny"> {
  const key = target.origin;
  const cached = robotsCache.get(key);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    if (cached.deny) return "deny";
    if (cached.body == null) return "allow";
    return robotsAllows(cached.body, target) ? "allow" : "deny";
  }
  const robotsUrl = inspectCrawlUrl(new URL("/robots.txt", target.origin).toString());
  if (!robotsUrl.ok) return "deny";
  const response = await fetchOnce(robotsUrl.url, lookup);
  if (response.failure || response.status < 200 || response.status >= 300) {
    const missing = response.status === 404 || response.status === 410;
    robotsCache.set(key, { at: Date.now(), body: null, deny: !missing });
    return missing ? "allow" : "deny";
  }
  const body = response.body.toString("utf8");
  robotsCache.set(key, { at: Date.now(), body, deny: false });
  return robotsAllows(body, target) ? "allow" : "deny";
}

export async function fetchCrawlPage(
  rawUrl: string,
  deps?: { lookup?: AddressLookup },
): Promise<CrawlDocument> {
  const lookup = deps?.lookup ?? (dnsLookup as AddressLookup);
  const inspected = inspectCrawlUrl(rawUrl);
  if (!inspected.ok) {
    return { finalUrl: rawUrl.slice(0, 500), status: 0, html: null, failure: "unsafe_url" };
  }

  let current = inspected.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if ((await robotsDecision(current, lookup)) === "deny") {
      return { finalUrl: current.toString(), status: 0, html: null, failure: "robots" };
    }
    const response = await fetchOnce(current, lookup);
    if (response.failure) {
      return { finalUrl: current.toString(), status: response.status, html: null, failure: response.failure };
    }
    const location = headerValue(response.headers.location);
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_REDIRECTS) {
        return { finalUrl: current.toString(), status: response.status, html: null, failure: "fetch_failed" };
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { finalUrl: current.toString(), status: response.status, html: null, failure: "unsafe_url" };
      }
      const nextCheck = inspectCrawlUrl(next.toString());
      if (!nextCheck.ok) {
        return { finalUrl: next.toString().slice(0, 500), status: response.status, html: null, failure: "unsafe_url" };
      }
      current = nextCheck.url;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      return { finalUrl: current.toString(), status: response.status, html: null, failure: "fetch_failed" };
    }
    const contentType = headerValue(response.headers["content-type"]);
    const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (mime && !ALLOWED_TYPES.includes(mime)) {
      return { finalUrl: current.toString(), status: response.status, html: null, failure: "unsupported_type" };
    }
    const html = response.body.toString("utf8");
    return {
      finalUrl: current.toString(),
      status: response.status,
      html,
      failure: null,
    };
  }
  return { finalUrl: current.toString(), status: 0, html: null, failure: "fetch_failed" };
}

