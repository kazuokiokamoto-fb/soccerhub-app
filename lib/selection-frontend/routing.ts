/**
 * Opt-in same-origin routing for the selection zone.
 *
 * Rewrites are emitted only when SELECTION_FRONTEND_ROUTING is exactly "1"
 * and SELECTION_APP_ORIGIN passes validation. Otherwise the hub keeps serving
 * app/selection itself. Never invent a placeholder destination.
 */

export const SELECTION_ASSET_PREFIX = "/selection-static";

const BLOCKED_SELECTION_HOSTS = new Set([
  "www.sakamatch.com",
  "sakamatch.com",
  "selection.sakamatch.com",
]);

const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "change-me.example",
  "your-selection-host.vercel.app",
]);

export type RoutingEnv = {
  SELECTION_FRONTEND_ROUTING?: string;
  SELECTION_APP_ORIGIN?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_BRANCH_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

export type RoutingDecision =
  | { enabled: false; reason: string; origin: null }
  | { enabled: true; reason: "ok"; origin: string };

export type SelectionRewrite = {
  source: string;
  destination: string;
};

export function routingEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env
): RoutingEnv {
  return {
    SELECTION_FRONTEND_ROUTING: env.SELECTION_FRONTEND_ROUTING,
    SELECTION_APP_ORIGIN: env.SELECTION_APP_ORIGIN,
    VERCEL: env.VERCEL,
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_URL: env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_BRANCH_URL: env.VERCEL_BRANCH_URL,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  };
}

function configuredHost(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProto).host.toLowerCase();
  } catch {
    return null;
  }
}

function isPlaceholder(raw: string, hostname: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower.includes("<") ||
    lower.includes(">") ||
    lower === "undefined" ||
    lower === "null" ||
    lower === "changeme" ||
    lower === "change-me"
  ) {
    return true;
  }
  if (PLACEHOLDER_HOSTS.has(hostname)) return true;
  return (
    hostname.endsWith(".example") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".test")
  );
}

export function selectionRoutingDecision(
  env: RoutingEnv,
  requestHost?: string | null
): RoutingDecision {
  if (env.SELECTION_FRONTEND_ROUTING !== "1") {
    return { enabled: false, reason: "flag-off", origin: null };
  }

  const raw = env.SELECTION_APP_ORIGIN?.trim() ?? "";
  if (!raw) {
    return { enabled: false, reason: "origin-missing", origin: null };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { enabled: false, reason: "origin-invalid", origin: null };
  }

  const hostname = url.hostname.toLowerCase();
  const host = url.host.toLowerCase();
  const onVercel = env.VERCEL === "1";
  const local = hostname === "localhost" || hostname === "127.0.0.1";

  if (isPlaceholder(raw, hostname)) {
    return { enabled: false, reason: "origin-placeholder", origin: null };
  }
  if (url.username || url.password) {
    return { enabled: false, reason: "origin-invalid", origin: null };
  }
  if (url.search || url.hash) {
    return { enabled: false, reason: "origin-invalid", origin: null };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { enabled: false, reason: "origin-has-path", origin: null };
  }
  if (BLOCKED_SELECTION_HOSTS.has(hostname)) {
    return { enabled: false, reason: "origin-blocked-host", origin: null };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && hostname !== "127.0.0.1") {
    return { enabled: false, reason: "origin-invalid", origin: null };
  }
  if (hostname.includes(":") || hostname === "[::1]") {
    return { enabled: false, reason: "origin-invalid", origin: null };
  }

  if (url.protocol !== "https:") {
    const localDev = !onVercel && local && url.protocol === "http:";
    if (!localDev) {
      return { enabled: false, reason: "origin-not-https", origin: null };
    }
  } else if (local && onVercel) {
    return { enabled: false, reason: "origin-localhost-on-vercel", origin: null };
  }

  const loopHosts = new Set<string>();
  for (const candidate of [
    env.VERCEL_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_BRANCH_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_APP_URL,
    requestHost ?? undefined,
  ]) {
    const parsed = configuredHost(candidate);
    if (parsed) loopHosts.add(parsed);
  }
  if (loopHosts.has(host)) {
    return { enabled: false, reason: "origin-loop", origin: null };
  }

  return { enabled: true, reason: "ok", origin: url.origin };
}

export function selectionRewriteRules(origin: string): SelectionRewrite[] {
  return [
    { source: "/selection", destination: `${origin}/selection` },
    {
      source: "/selection/:path*",
      destination: `${origin}/selection/:path*`,
    },
    {
      source: `${SELECTION_ASSET_PREFIX}/:path*`,
      destination: `${origin}${SELECTION_ASSET_PREFIX}/:path*`,
    },
  ];
}

export type HubRoutingBuild = {
  enabled: boolean;
  reason: string;
  origin: string | null;
  beforeFiles: SelectionRewrite[];
  clientFlag: "0" | "1";
};

export function hubRoutingBuild(env: RoutingEnv = routingEnvFromProcess()): HubRoutingBuild {
  const decision = selectionRoutingDecision(env);
  if (!decision.enabled) {
    return {
      enabled: false,
      reason: decision.reason,
      origin: null,
      beforeFiles: [],
      clientFlag: "0",
    };
  }
  return {
    enabled: true,
    reason: "ok",
    origin: decision.origin,
    beforeFiles: selectionRewriteRules(decision.origin),
    clientFlag: "1",
  };
}
