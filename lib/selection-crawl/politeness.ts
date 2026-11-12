export const HOST_INTERVAL_MS = 60_000;
export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PAGES_PER_VISIT = 4;
export const FETCH_TIMEOUT_MS = 8_000;
export const PAGE_GAP_MS = 1_000;

export const BACKOFF_MS = {
  rate: 6 * 60 * 60 * 1000,
  server: 60 * 60 * 1000,
  timeout: 2 * 60 * 60 * 1000,
  robotsDeny: 24 * 60 * 60 * 1000,
  robotsUnavailable: 60 * 60 * 1000,
} as const;

export type HostSnapshot = {
  robotsFetchedAt: number | null;
  backoffUntil: number | null;
  lastRequestAt: number | null;
};

export type VisitDecision =
  | { type: "defer"; retryAt: number }
  | { type: "cap" }
  | { type: "fetch"; refreshRobots: boolean };

export function hostVisitDecision(input: {
  now: number;
  state: HostSnapshot;
  inOpenVisit: boolean;
  pagesThisVisit: number;
}): VisitDecision {
  const { now, state, inOpenVisit, pagesThisVisit } = input;
  if (state.backoffUntil != null && state.backoffUntil > now) {
    return { type: "defer", retryAt: state.backoffUntil };
  }
  if (inOpenVisit && pagesThisVisit >= MAX_PAGES_PER_VISIT) return { type: "cap" };
  if (!inOpenVisit && state.lastRequestAt != null && now - state.lastRequestAt < HOST_INTERVAL_MS) {
    return { type: "defer", retryAt: state.lastRequestAt + HOST_INTERVAL_MS };
  }
  const robotsFresh = state.robotsFetchedAt != null && now - state.robotsFetchedAt < ROBOTS_TTL_MS;
  return { type: "fetch", refreshRobots: !robotsFresh };
}
