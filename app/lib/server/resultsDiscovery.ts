import type { SupabaseClient } from "@supabase/supabase-js";
import { fiscalYearContaining, defaultStandingYear } from "@/lib/official-results/fiscal";
import { extractStanding } from "@/lib/standings/extract";
import { fetchCrawlPage } from "@/lib/standings/fetchPage";
import {
  chooseDiscoveredPage,
  initialDiscoveryUrls,
  sameHostStandingsLinks,
  scoreStandingsPage,
} from "@/lib/standings/discover";
import { hostFetchBudget, parseSearchHits, searchQuery, standingCandidateRow } from "@/lib/standings/plan";
import { inspectCrawlUrl } from "@/lib/standings/crawlUrl";

const SEARCH_TIMEOUT_MS = 5_000;

export async function optionalResultsSearch(query: string): Promise<string[]> {
  const endpoint = process.env.RESULTS_SEARCH_ENDPOINT?.trim() ?? "";
  const key = process.env.RESULTS_SEARCH_API_KEY?.trim() ?? "";
  if (!endpoint || !key) return [];
  const inspected = inspectCrawlUrl(endpoint);
  if (!inspected.ok || inspected.url.protocol !== "https:") return [];
  inspected.url.searchParams.set("q", query);
  inspected.url.searchParams.set("count", "5");
  const header = process.env.RESULTS_SEARCH_KEY_HEADER?.trim() || "X-Subscription-Token";
  try {
    const response = await fetch(inspected.url, {
      headers: { accept: "application/json", [header]: key },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    return parseSearchHits(await response.json()).filter((url) => inspectCrawlUrl(url).ok);
  } catch (error) {
    console.error(
      "results search skipped:",
      error instanceof Error ? error.message : "unknown",
    );
    return [];
  }
}

async function hostAllowed(service: SupabaseClient | null, host: string): Promise<boolean> {
  if (!service) return true;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await service
    .from("official_standing_fetches")
    .select("id", { count: "exact", head: true })
    .eq("host", host)
    .gte("fetched_at", since);
  if (recent.error) return true;
  return hostFetchBudget(recent.count ?? 0);
}

export async function recordStandingFetch(
  service: SupabaseClient | null,
  row: {
    team_id: string;
    source_url: string;
    host: string;
    fiscal_year: number | null;
    ok: boolean;
    error: string | null;
    http_status: number | null;
  },
) {
  if (!service) return;
  const inserted = await service.from("official_standing_fetches").insert(row);
  if (inserted.error) {
    console.error("standing fetch log skipped:", inserted.error.code ?? "write_failed");
  }
}

export async function storeStandingCandidate(
  service: SupabaseClient | null,
  input: {
    teamId: string;
    teamName: string;
    fiscalYear: number;
    categoryHint: string | null;
    sourceUrl: string;
    html: string;
  },
) {
  const hit = extractStanding({
    html: input.html,
    teamName: input.teamName,
    fiscalYear: input.fiscalYear,
    categoryHint: input.categoryHint,
  });
  if (!hit || !service) return hit;
  const row = standingCandidateRow({
    team_id: input.teamId,
    fiscal_year: input.fiscalYear,
    category: hit.category,
    rank: hit.rank,
    source_url: input.sourceUrl,
    evidence: hit.evidence,
    confidence: hit.confidence,
  });
  const inserted = await service.from("official_standing_candidates").insert(row);
  if (inserted.error) {
    console.error("standing candidate skipped:", inserted.error.code ?? "write_failed");
  }
  return hit;
}

async function fetchIfAllowed(
  service: SupabaseClient | null,
  teamId: string,
  fiscalYear: number,
  rawUrl: string,
) {
  const inspected = inspectCrawlUrl(rawUrl);
  if (!inspected.ok) {
    await recordStandingFetch(service, {
      team_id: teamId,
      source_url: rawUrl.slice(0, 500),
      host: "invalid",
      fiscal_year: fiscalYear,
      ok: false,
      error: "unsafe_url",
      http_status: null,
    });
    return null;
  }
  const host = inspected.url.hostname.toLowerCase();
  if (!(await hostAllowed(service, host))) {
    await recordStandingFetch(service, {
      team_id: teamId,
      source_url: inspected.url.toString().slice(0, 500),
      host,
      fiscal_year: fiscalYear,
      ok: false,
      error: "rate_limited",
      http_status: null,
    });
    return null;
  }
  const page = await fetchCrawlPage(inspected.url.toString());
  await recordStandingFetch(service, {
    team_id: teamId,
    source_url: page.finalUrl.slice(0, 500),
    host,
    fiscal_year: fiscalYear,
    ok: page.failure == null && Boolean(page.html),
    error: page.failure,
    http_status: page.status || null,
  });
  return page;
}

export async function discoverResultsPage(input: {
  service: SupabaseClient | null;
  teamId: string;
  teamName: string;
  prefecture: string;
  category: string;
  organizationName: string;
}) {
  const fiscalYear = defaultStandingYear(new Date());
  const urls = initialDiscoveryUrls({
    prefecture: input.prefecture,
    organization: input.organizationName,
  });
  try {
    const found = await optionalResultsSearch(
      searchQuery({
        prefecture: input.prefecture,
        category: input.category,
        organizationName: input.organizationName,
      }),
    );
    for (const url of found) {
      if (!urls.includes(url)) urls.push(url);
      if (urls.length >= 3) break;
    }
  } catch (error) {
    console.error(
      "results discovery search skipped:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  const scored: { url: string; html: string; score: ReturnType<typeof scoreStandingsPage> }[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const page = await fetchIfAllowed(input.service, input.teamId, fiscalYear, url);
      if (!page?.html) continue;
      scored.push({
        url: page.finalUrl,
        html: page.html,
        score: scoreStandingsPage(page.html, {
          organization: input.organizationName,
          category: input.category,
          prefecture: input.prefecture,
        }),
      });
    } catch (error) {
      console.error(
        "results page skipped:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const best = [...scored].sort((a, b) => b.score.score - a.score.score)[0];
  if (best && best.score.confidence !== "high") {
    try {
      const base = new URL(best.url);
      const extra = sameHostStandingsLinks(best.html, base)[0];
      if (extra && !scored.some((page) => page.url === extra)) {
        const page = await fetchIfAllowed(input.service, input.teamId, fiscalYear, extra);
        if (page?.html) {
          scored.push({
            url: page.finalUrl,
            html: page.html,
            score: scoreStandingsPage(page.html, {
              organization: input.organizationName,
              category: input.category,
              prefecture: input.prefecture,
            }),
          });
        }
      }
    } catch (error) {
      console.error(
        "results link skipped:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const choice = chooseDiscoveredPage(scored.map((page) => ({ url: page.url, score: page.score })));
  const chosen = scored.find((page) => page.url === choice.url);
  if (choice.status === "found" && chosen?.html) {
    const years = [fiscalYear];
    const current = fiscalYearContaining(new Date());
    if (current !== fiscalYear) years.push(current);
    for (const year of years) {
      try {
        await storeStandingCandidate(input.service, {
          teamId: input.teamId,
          teamName: input.teamName,
          fiscalYear: year,
          categoryHint: input.category,
          sourceUrl: chosen.url,
          html: chosen.html,
        });
      } catch (error) {
        console.error(
          "standing extract skipped:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }
  return choice;
}

export async function crawlSavedPage(input: {
  service: SupabaseClient | null;
  teamId: string;
  teamName: string;
  categoryHint: string | null;
  url: string;
}) {
  const fiscalYear = defaultStandingYear(new Date());
  try {
    const page = await fetchIfAllowed(input.service, input.teamId, fiscalYear, input.url);
    if (!page?.html) return { ok: false as const, failure: page?.failure ?? "fetch_failed" };
    const current = fiscalYearContaining(new Date());
    for (const year of current === fiscalYear ? [fiscalYear] : [fiscalYear, current]) {
      await storeStandingCandidate(input.service, {
        teamId: input.teamId,
        teamName: input.teamName,
        fiscalYear: year,
        categoryHint: input.categoryHint,
        sourceUrl: page.finalUrl,
        html: page.html,
      });
    }
    return { ok: true as const, finalUrl: page.finalUrl };
  } catch (error) {
    console.error(
      "saved results page skipped:",
      error instanceof Error ? error.message : "unknown",
    );
    return { ok: false as const, failure: "fetch_failed" };
  }
}
