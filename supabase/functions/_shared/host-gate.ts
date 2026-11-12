import {
  BACKOFF_MS,
  FETCH_TIMEOUT_MS,
  hostVisitDecision,
  PAGE_GAP_MS,
  type HostSnapshot,
} from "../../../lib/selection-crawl/politeness.ts";
import { robotsDecision, SELECTION_CRAWL_USER_AGENT } from "../../../lib/selection-crawl/robots.ts";
import { hostKey, isPublicHttpUrl, isUncrawlableUrl } from "../../../lib/selection-crawl/urls.ts";

export const CRAWL_USER_AGENT = SELECTION_CRAWL_USER_AGENT;
const MAX_BODY = 1_000_000;
const MAX_REDIRECTS = 3;

export type FetchFailure =
  | "robots"
  | "timeout"
  | "http"
  | "blocked"
  | "rate"
  | "network"
  | "type"
  | "budget";

export type FetchResult = {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
  error: string | null;
  failure: FetchFailure | null;
  retryAt: string | null;
};

export class CrawlFetchError extends Error {
  result: FetchResult;
  constructor(result: FetchResult) {
    super(result.error || result.failure || "fetch failed");
    this.result = result;
  }
}

type HostRow = {
  host: string;
  robots_txt: string | null;
  robots_status: number | null;
  robots_fetched_at: string | null;
  last_request_at: string | null;
  backoff_until: string | null;
};

type Store = {
  get(host: string): Promise<HostRow | null>;
  save(row: HostRow): Promise<void>;
};

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function result(partial: FetchResult): FetchResult {
  return partial;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function createSupabaseHostStore(supabase: { from: (table: string) => any }): Store {
  return {
    async get(host) {
      const { data, error } = await supabase
        .from("selection_crawl_hosts")
        .select("host, robots_txt, robots_status, robots_fetched_at, last_request_at, backoff_until")
        .eq("host", host)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    async save(row) {
      const { error } = await supabase.from("selection_crawl_hosts").upsert({
        ...row,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("host state save skipped", error.message);
    },
  };
}

export class HostGate {
  private memory = new Map<string, HostRow>();
  private visitHost: string | null = null;
  private pagesThisVisit = 0;
  private lastPageAt = 0;

  constructor(
    private readonly store: Store,
    private readonly deadlineMs: number,
    private readonly fetchImpl: FetchImpl = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  shouldStop(): boolean {
    return this.now() > this.deadlineMs;
  }

  closeVisit(): void {
    this.visitHost = null;
    this.pagesThisVisit = 0;
  }

  async fetch(url: string): Promise<FetchResult> {
    if (this.shouldStop()) {
      return result({
        ok: false, status: 0, html: "", finalUrl: url, error: "time_budget", failure: "budget", retryAt: iso(this.now() + 60_000),
      });
    }
    if (!isPublicHttpUrl(url) || isUncrawlableUrl(url)) {
      return result({
        ok: false, status: 0, html: "", finalUrl: url, error: "blocked", failure: "blocked", retryAt: null,
      });
    }

    const host = hostKey(url);
    const state = await this.load(host);
    const now = this.now();
    const snapshot: HostSnapshot = {
      robotsFetchedAt: state.robots_fetched_at ? Date.parse(state.robots_fetched_at) : null,
      backoffUntil: state.backoff_until ? Date.parse(state.backoff_until) : null,
      lastRequestAt: state.last_request_at ? Date.parse(state.last_request_at) : null,
    };
    const decision = hostVisitDecision({
      now,
      state: snapshot,
      inOpenVisit: this.visitHost === host,
      pagesThisVisit: this.pagesThisVisit,
    });
    if (decision.type === "defer") {
      return result({
        ok: false, status: 0, html: "", finalUrl: url, error: "host_interval", failure: "rate", retryAt: iso(decision.retryAt),
      });
    }
    if (decision.type === "cap") {
      return result({
        ok: false, status: 0, html: "", finalUrl: url, error: "page_cap", failure: "budget", retryAt: null,
      });
    }

    if (this.visitHost !== host) {
      this.visitHost = host;
      this.pagesThisVisit = 0;
    }

    if (decision.refreshRobots) {
      const robotsUrl = new URL("/robots.txt", new URL(url).origin).toString();
      const robots = await this.request(robotsUrl, false);
      state.robots_fetched_at = iso(this.now());
      state.robots_status = robots.status;
      state.robots_txt = robots.ok ? robots.html.slice(0, 100_000) : null;
      state.last_request_at = state.robots_fetched_at;
      const verdict = robotsDecision(robots.status, state.robots_txt || "", new URL(url), CRAWL_USER_AGENT);
      if (verdict === "deny") {
        state.backoff_until = iso(this.now() + BACKOFF_MS.robotsDeny);
        await this.store.save(state);
        return result({
          ok: false, status: robots.status, html: "", finalUrl: url, error: "robots_disallow", failure: "robots", retryAt: state.backoff_until,
        });
      }
      if (verdict === "unavailable") {
        state.backoff_until = iso(this.now() + BACKOFF_MS.robotsUnavailable);
        await this.store.save(state);
        return result({
          ok: false, status: robots.status, html: "", finalUrl: url, error: "robots_unavailable", failure: "robots", retryAt: state.backoff_until,
        });
      }
      state.backoff_until = null;
      await this.store.save(state);
    } else if (state.robots_txt) {
      const verdict = robotsDecision(state.robots_status || 200, state.robots_txt, new URL(url), CRAWL_USER_AGENT);
      if (verdict === "deny") {
        return result({
          ok: false, status: 0, html: "", finalUrl: url, error: "robots_disallow", failure: "robots",
          retryAt: iso(this.now() + BACKOFF_MS.robotsDeny),
        });
      }
    }

    if (this.pagesThisVisit > 0 && this.now() - this.lastPageAt < PAGE_GAP_MS) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_GAP_MS));
    }
    const page = await this.follow(url);
    state.last_request_at = iso(this.now());
    this.lastPageAt = this.now();
    this.pagesThisVisit += 1;
    if (page.status === 429) {
      state.backoff_until = iso(this.now() + BACKOFF_MS.rate);
      page.failure = "rate";
    } else if (page.status === 503 || page.status === 502) {
      state.backoff_until = iso(this.now() + BACKOFF_MS.server);
      page.failure = "rate";
    } else if (page.failure === "timeout") {
      state.backoff_until = iso(this.now() + BACKOFF_MS.timeout);
    } else if (page.ok) {
      state.backoff_until = null;
    }
    await this.store.save(state);
    if (page.failure === "timeout" || page.failure === "rate") page.retryAt = state.backoff_until;
    return page;
  }

  private async load(host: string): Promise<HostRow> {
    const cached = this.memory.get(host);
    if (cached) return cached;
    const stored = await this.store.get(host);
    const row = stored || {
      host,
      robots_txt: null,
      robots_status: null,
      robots_fetched_at: null,
      last_request_at: null,
      backoff_until: null,
    };
    this.memory.set(host, row);
    return row;
  }

  private async follow(start: string): Promise<FetchResult> {
    let current = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!isPublicHttpUrl(current) || isUncrawlableUrl(current)) {
        return result({
          ok: false, status: 0, html: "", finalUrl: current, error: "blocked_redirect", failure: "blocked", retryAt: null,
        });
      }
      if (hop > 0) {
        const allowed = await this.redirectAllowed(current);
        if (allowed) return allowed;
      }
      const response = await this.request(current, true);
      if (response.failure === "timeout" || response.failure === "network") return response;
      if (response.status >= 300 && response.status < 400 && response.redirect) {
        if (hop === MAX_REDIRECTS) {
          return result({
            ok: false, status: response.status, html: "", finalUrl: current, error: `HTTP ${response.status}`, failure: "http", retryAt: null,
          });
        }
        current = response.redirect;
        continue;
      }
      return response;
    }
    return result({
      ok: false, status: 0, html: "", finalUrl: current, error: "redirects", failure: "http", retryAt: null,
    });
  }

  private async redirectAllowed(url: string): Promise<FetchResult | null> {
    const host = hostKey(url);
    const state = await this.load(host);
    const fetchedAt = state.robots_fetched_at ? Date.parse(state.robots_fetched_at) : null;
    const fresh = fetchedAt != null && this.now() - fetchedAt < 24 * 60 * 60 * 1000;
    if (!fresh) {
      const robotsUrl = new URL("/robots.txt", new URL(url).origin).toString();
      const robots = await this.request(robotsUrl, false);
      state.robots_fetched_at = iso(this.now());
      state.robots_status = robots.status;
      state.robots_txt = robots.ok ? robots.html.slice(0, 100_000) : null;
      state.last_request_at = state.robots_fetched_at;
      await this.store.save(state);
    }
    const verdict = robotsDecision(state.robots_status || 0, state.robots_txt || "", new URL(url), CRAWL_USER_AGENT);
    if (verdict === "allow") return null;
    return result({
      ok: false,
      status: state.robots_status || 0,
      html: "",
      finalUrl: url,
      error: verdict === "deny" ? "robots_disallow" : "robots_unavailable",
      failure: "robots",
      retryAt: iso(this.now() + (verdict === "deny" ? BACKOFF_MS.robotsDeny : BACKOFF_MS.robotsUnavailable)),
    });
  }

  private async request(url: string, htmlOnly: boolean): Promise<FetchResult & { redirect?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": CRAWL_USER_AGENT,
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          "accept-language": "ja,en;q=0.8",
        },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        return {
          ok: false,
          status: response.status,
          html: "",
          finalUrl: url,
          error: `HTTP ${response.status}`,
          failure: "http",
          retryAt: null,
          redirect: new URL(location, url).toString(),
        };
      }
      const type = response.headers.get("content-type") || "";
      const text = (await response.text()).slice(0, MAX_BODY);
      if (!response.ok) {
        return result({
          ok: false, status: response.status, html: text, finalUrl: url, error: `HTTP ${response.status}`, failure: "http", retryAt: null,
        });
      }
      if (htmlOnly && type && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(type)) {
        return result({
          ok: false, status: response.status, html: "", finalUrl: url, error: `not html: ${type}`, failure: "type", retryAt: null,
        });
      }
      return result({
        ok: true, status: response.status, html: text, finalUrl: url, error: null, failure: null, retryAt: null,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return result({
        ok: false,
        status: 0,
        html: "",
        finalUrl: url,
        error: aborted ? "timeout" : "network",
        failure: aborted ? "timeout" : "network",
        retryAt: null,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
