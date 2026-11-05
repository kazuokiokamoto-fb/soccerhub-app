import { createRequire } from "node:module";

/**
 * web-push 3.6.7 still calls Node's deprecated url.parse().
 * Replace it with the WHATWG URL API before web-push is loaded.
 */
const require = createRequire(import.meta.url);
const nodeUrl = require("node:url") as {
  parse: ((
    input: string,
    parseQueryString?: boolean,
    slashesDenoteHost?: boolean,
  ) => UrlParseResult) & { __sakamatchPatched?: boolean };
};

type UrlParseResult = {
  protocol: string | null;
  slashes: boolean;
  auth: string | null;
  host: string | null;
  port: string | null;
  hostname: string | null;
  hash: string | null;
  search: string | null;
  query: string | null;
  pathname: string | null;
  path: string | null;
  href: string | null;
};

if (!nodeUrl.parse.__sakamatchPatched) {
  const patched: typeof nodeUrl.parse = (input: string) => {
    const parsed = new URL(input);
    return {
      protocol: parsed.protocol,
      slashes: true,
      auth: parsed.username
        ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}`
        : null,
      host: parsed.host,
      port: parsed.port || null,
      hostname: parsed.hostname,
      hash: parsed.hash || null,
      search: parsed.search || null,
      query: parsed.search ? parsed.search.slice(1) : null,
      pathname: parsed.pathname,
      path: `${parsed.pathname}${parsed.search}`,
      href: parsed.href,
    };
  };
  patched.__sakamatchPatched = true;
  nodeUrl.parse = patched;
}
