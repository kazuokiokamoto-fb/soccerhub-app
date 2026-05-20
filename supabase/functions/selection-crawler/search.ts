import type { SearchResult, SelectionSource } from "./types.ts";
import {
  MAX_SEARCH_QUERIES_PER_SOURCE,
  MAX_SEARCH_RESULTS_PER_QUERY,
  MAX_SEARCH_URLS_PER_SOURCE,
  SEARCH_KEYWORDS,
} from "./constants.ts";
import {
  getHost,
  isBlockedFile,
  isBlockedPath,
  isSnsOrMapUrl,
  normalizeUrl,
  sameHost,
} from "./url.ts";

function buildSearchQueries(source: SelectionSource) {
  const queries: string[] = [];

  const name = source.name.trim();

  for (const keyword of SEARCH_KEYWORDS.slice(0, MAX_SEARCH_QUERIES_PER_SOURCE)) {
    queries.push(`${name} ${keyword}`);
  }

  return queries;
}

function looksUsefulSearchUrl(url: string, source: SelectionSource) {
  try {
    if (!url) return false;
    if (isSnsOrMapUrl(url)) return false;
    if (isBlockedFile(url)) return false;
    if (isBlockedPath(url)) return false;

    const lower = decodeURIComponent(url.toLowerCase());
    const host = getHost(url);
    const baseHost = getHost(source.base_url);

    if (baseHost && host === baseHost) return true;
    if (sameHost(url, source.base_url)) return true;

    return (
      lower.includes("selection") ||
      lower.includes("tryout") ||
      lower.includes("trial") ||
      lower.includes("recruit") ||
      lower.includes("entry") ||
      lower.includes("academy") ||
      lower.includes("school") ||
      lower.includes("junior") ||
      lower.includes("youth") ||
      lower.includes("u-13") ||
      lower.includes("u15") ||
      lower.includes("u-15") ||
      lower.includes("soccer") ||
      lower.includes("football") ||
      lower.includes("fc") ||
      lower.includes("jry") ||
      lower.includes("jy")
    );
  } catch {
    return false;
  }
}

async function searchBing(query: string): Promise<SearchResult[]> {
  const apiKey = Deno.env.get("BING_SEARCH_API_KEY");

  if (!apiKey) return [];

  const endpoint = new URL("https://api.bing.microsoft.com/v7.0/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("mkt", "ja-JP");
  endpoint.searchParams.set("count", String(MAX_SEARCH_RESULTS_PER_QUERY));
  endpoint.searchParams.set("responseFilter", "Webpages");
  endpoint.searchParams.set("safeSearch", "Moderate");

  const res = await fetch(endpoint.toString(), {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  const values = json?.webPages?.value ?? [];

  return values
    .map((item: any) => ({
      title: String(item?.name ?? ""),
      url: normalizeUrl(String(item?.url ?? "")),
      snippet: String(item?.snippet ?? ""),
      source: "bing" as const,
      query,
    }))
    .filter((item: SearchResult) => Boolean(item.url));
}

export async function buildSearchSeedUrls(source: SelectionSource) {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const queries = buildSearchQueries(source);

  for (const query of queries) {
    const items = await searchBing(query);

    for (const item of items) {
      if (!item.url) continue;
      if (seenUrls.has(item.url)) continue;
      if (!looksUsefulSearchUrl(item.url, source)) continue;

      seenUrls.add(item.url);
      results.push(item);

      if (results.length >= MAX_SEARCH_URLS_PER_SOURCE) {
        return results;
      }
    }
  }

  return results;
}