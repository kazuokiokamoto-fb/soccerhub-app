export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const HOST_HOURLY_LIMIT = 8;
export const CRON_BATCH = 3;

export function dueForWeeklyCrawl(lastCrawledAt: Date | null, now: Date): boolean {
  if (!lastCrawledAt || Number.isNaN(lastCrawledAt.getTime())) return true;
  return now.getTime() - lastCrawledAt.getTime() >= WEEK_MS;
}

export function hostFetchBudget(recentCount: number): boolean {
  return recentCount < HOST_HOURLY_LIMIT;
}

export type StandingCandidateRow = {
  team_id: string;
  fiscal_year: number;
  category: string | null;
  rank: number;
  source_url: string;
  evidence: string;
  confidence: "high" | "low";
};

/** A crawl writes a candidate only. It never carries a report submission. */
export function standingCandidateRow(input: StandingCandidateRow): StandingCandidateRow {
  return {
    team_id: input.team_id,
    fiscal_year: input.fiscal_year,
    category: input.category,
    rank: input.rank,
    source_url: input.source_url.slice(0, 500),
    evidence: input.evidence.slice(0, 240),
    confidence: input.confidence,
  };
}

export function searchQuery(input: {
  prefecture: string;
  category: string;
  organizationName: string;
}): string {
  return `${input.prefecture} ${input.organizationName} ${input.category} 順位表`;
}

export function parseSearchHits(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const buckets: unknown[] = [];
  const web = record.web;
  if (web && typeof web === "object" && Array.isArray((web as { results?: unknown }).results)) {
    buckets.push(...((web as { results: unknown[] }).results));
  }
  if (Array.isArray(record.results)) buckets.push(...record.results);
  if (Array.isArray(record.organic)) buckets.push(...record.organic);
  if (Array.isArray(record.items)) buckets.push(...record.items);
  const urls: string[] = [];
  for (const item of buckets) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = row.url ?? row.link;
    if (typeof url === "string" && url.startsWith("http")) urls.push(url);
    if (urls.length >= 3) break;
  }
  return urls;
}
