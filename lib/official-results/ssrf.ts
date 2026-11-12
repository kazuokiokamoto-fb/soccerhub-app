import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import { BlockList, isIP } from "node:net";

export const MAX_BYTES = 512_000;
export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 8_000;

const block = new BlockList();

function block4(address: string, prefix: number) {
  block.addSubnet(address, prefix, "ipv4");
}

block4("0.0.0.0", 8);
block4("10.0.0.0", 8);
block4("100.64.0.0", 10);
block4("127.0.0.0", 8);
block4("169.254.0.0", 16);
block4("172.16.0.0", 12);
block4("192.0.0.0", 24);
block4("192.0.2.0", 24);
block4("192.168.0.0", 16);
block4("198.18.0.0", 15);
block4("198.51.100.0", 24);
block4("203.0.113.0", 24);
block4("224.0.0.0", 4);
block4("240.0.0.0", 4);
block.addAddress("::", "ipv6");
block.addAddress("::1", "ipv6");
block.addSubnet("fc00::", 7, "ipv6");
block.addSubnet("fe80::", 10, "ipv6");
block.addSubnet("2001:db8::", 32, "ipv6");

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

export type PublicFetchCode =
  | "unsafe_url"
  | "fetch_failed"
  | "too_large"
  | "unsupported_type"
  | "timeout";

export class PublicFetchError extends Error {
  code: PublicFetchCode;

  constructor(code: PublicFetchCode) {
    super(code);
    this.code = code;
  }
}

export function isBlockedIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]);
  const family = isIP(ip);
  if (family !== 4 && family !== 6) return true;
  return block.check(ip, family === 4 ? "ipv4" : "ipv6");
}

function hostBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  return host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal");
}

export function inspectPublicUrl(raw: string): { ok: true; url: URL } | { ok: false } {
  if (raw.length > 500) return { ok: false };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:") return { ok: false };
  if (url.username || url.password || url.hash) return { ok: false };
  if (url.port && url.port !== "443") return { ok: false };
  if (hostBlocked(url.hostname)) return { ok: false };
  if (isIP(url.hostname) && isBlockedIp(url.hostname)) return { ok: false };
  return { ok: true, url };
}

type AddressLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string }>>;

export async function publicAddresses(
  hostname: string,
  lookup: AddressLookup = dnsLookup as AddressLookup,
): Promise<string[]> {
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new PublicFetchError("unsafe_url");
    return [hostname];
  }
  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PublicFetchError("unsafe_url");
  }
  const addresses = records.map((record) => record.address);
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) {
    throw new PublicFetchError("unsafe_url");
  }
  return addresses;
}

type HeaderValue = string | string[] | undefined;

type RawResponse = {
  status: number;
  headers: Record<string, HeaderValue>;
  body: Buffer;
};

export type PublicPage = {
  finalUrl: string;
  status: number;
  contentType: string | null;
  sha256: string | null;
  html: string | null;
  failure: null | "fetch_failed" | "too_large" | "unsupported_type" | "timeout";
};

const ALLOWED_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

function requestOnce(url: URL, address: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          host: url.host,
          accept: "text/html, text/plain, application/xhtml+xml",
          "user-agent": "sakamatch-official-results/1.0",
        },
        servername: url.hostname,
        timeout: FETCH_TIMEOUT_MS,
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

function headerValue(value: HeaderValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function fetchPublicPage(
  rawUrl: string,
  lookup: AddressLookup = dnsLookup as AddressLookup,
): Promise<PublicPage> {
  const inspected = inspectPublicUrl(rawUrl);
  if (!inspected.ok) throw new PublicFetchError("unsafe_url");

  let current = inspected.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const addresses = await publicAddresses(current.hostname, lookup);
    let response: RawResponse;
    try {
      response = await requestOnce(current, addresses[0]);
    } catch (error) {
      if (error instanceof PublicFetchError) {
        return {
          finalUrl: current.toString(),
          status: 0,
          contentType: null,
          sha256: null,
          html: null,
          failure: error.code === "unsafe_url" ? "fetch_failed" : error.code,
        };
      }
      return {
        finalUrl: current.toString(),
        status: 0,
        contentType: null,
        sha256: null,
        html: null,
        failure: "fetch_failed",
      };
    }

    const location = headerValue(response.headers.location);
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_REDIRECTS) {
        return {
          finalUrl: current.toString(),
          status: response.status,
          contentType: null,
          sha256: null,
          html: null,
          failure: "fetch_failed",
        };
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new PublicFetchError("unsafe_url");
      }
      const nextCheck = inspectPublicUrl(next.toString());
      if (!nextCheck.ok) throw new PublicFetchError("unsafe_url");
      current = nextCheck.url;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      return {
        finalUrl: current.toString(),
        status: response.status,
        contentType: headerValue(response.headers["content-type"]),
        sha256: null,
        html: null,
        failure: "fetch_failed",
      };
    }

    const contentType = headerValue(response.headers["content-type"]);
    const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_TYPES.includes(mime)) {
      return {
        finalUrl: current.toString(),
        status: response.status,
        contentType,
        sha256: null,
        html: null,
        failure: "unsupported_type",
      };
    }

    return {
      finalUrl: current.toString(),
      status: response.status,
      contentType,
      sha256: createHash("sha256").update(response.body).digest("hex"),
      html: response.body.toString("utf8"),
      failure: null,
    };
  }

  return {
    finalUrl: current.toString(),
    status: 0,
    contentType: null,
    sha256: null,
    html: null,
    failure: "fetch_failed",
  };
}
