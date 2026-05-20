import type { SearchResult, SelectionSource } from "./types.ts";

import {
  MAX_SEARCH_QUERIES_PER_SOURCE,
  MAX_SEARCH_URLS_PER_SOURCE,
  SEARCH_KEYWORDS,
} from "./constants.ts";

import {
  normalizeUrl,
} from "./url.ts";

function buildCandidatePaths(keyword: string) {
  const k = encodeURIComponent(keyword);

  return [
    `/search?q=${k}`,
    `/?s=${k}`,

    `/news/`,
    `/topics/`,
    `/information/`,
    `/info/`,

    `/academy/`,
    `/academy/news/`,
    `/academy/topics/`,
    `/academy/selection/`,
    `/academy/recruit/`,

    `/selection/`,
    `/recruit/`,
    `/tryout/`,
    `/trial/`,
    `/entry/`,
    `/join/`,
    `/member/`,

    `/junior-youth/`,
    `/junior_youth/`,
    `/jy/`,
    `/youth/`,

    `/school/`,
  ];
}

function buildSearchQueries(source: SelectionSource) {
  const queries = new Set<string>();

  const name = source.name.trim();

  queries.add(name);

  for (
    const keyword of SEARCH_KEYWORDS.slice(
      0,
      MAX_SEARCH_QUERIES_PER_SOURCE,
    )
  ) {
    queries.add(`${name} ${keyword}`);
  }

  queries.add(`${name} セレクション`);
  queries.add(`${name} ジュニアユース`);
  queries.add(`${name} U-13`);
  queries.add(`${name} U13`);
  queries.add(`${name} 新中1`);
  queries.add(`${name} 現小6`);
  queries.add(`${name} 選手募集`);
  queries.add(`${name} 練習会`);
  queries.add(`${name} 体験会`);
  queries.add(`${name} アカデミー`);

  return Array.from(queries);
}

export async function buildSearchSeedUrls(
  source: SelectionSource,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const seen = new Set<string>();

  try {
    const base = new URL(source.base_url);

    const queries = buildSearchQueries(source);

    for (const query of queries) {
      for (const path of buildCandidatePaths(query)) {
        try {
          const url = normalizeUrl(
            new URL(path, base.origin).toString(),
          );

          if (!url) continue;
          if (seen.has(url)) continue;

          seen.add(url);

          results.push({
            title: query,
            url,
            snippet: query,
            source: "generated",
            query,
          });

          if (results.length >= MAX_SEARCH_URLS_PER_SOURCE) {
            return results;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  return results;
}