/**
 * Login always stays on the hub host. A redirect to the selection deployment
 * host would show a second login that cannot see www.sakamatch.com cookies.
 */

const PRODUCTION_HUB_HOSTS = new Set(["www.sakamatch.com", "sakamatch.com"]);

export function firstHeaderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  return first || null;
}

export function parseHubOrigin(
  raw: string | undefined,
  onVercel: boolean
): URL | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "selection.sakamatch.com") return null;
  if (
    hostname.endsWith(".example") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".test")
  ) {
    return null;
  }

  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (onVercel) {
    if (url.protocol !== "https:" || local) return null;
  } else if (local) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } else if (url.protocol !== "https:") {
    return null;
  }

  return url;
}

function isLocalHost(host: string): boolean {
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isAllowedLoginHost(host: string, hub: URL | null, onVercel: boolean): boolean {
  if (PRODUCTION_HUB_HOSTS.has(host)) return true;
  if (hub && host === hub.host.toLowerCase()) return true;
  if (!onVercel && isLocalHost(host)) return true;
  return false;
}

export function selectionLoginLocation(input: {
  redirectPath: string;
  forwardedHost: string | null;
  forwardedProto: string | null;
  requestHost?: string | null;
  hubOrigin: string | undefined;
  onVercel: boolean;
}): string {
  const path =
    !input.redirectPath || input.redirectPath === "/"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(input.redirectPath)}`;

  const hub = parseHubOrigin(input.hubOrigin, input.onVercel);
  const forwardedHost = firstHeaderValue(input.forwardedHost);
  const forwardedProto = firstHeaderValue(input.forwardedProto);
  const requestHost = firstHeaderValue(input.requestHost);
  // The selection server's own Host is often copied into x-forwarded-host.
  // Treating that as the login host would open /login on the selection
  // deployment. Only an upstream hub host may win.
  if (
    forwardedHost &&
    forwardedHost !== requestHost &&
    isAllowedLoginHost(forwardedHost, hub, input.onVercel)
  ) {
    const configuredHub = Boolean(hub && forwardedHost === hub.host.toLowerCase());
    const proto =
      PRODUCTION_HUB_HOSTS.has(forwardedHost) || configuredHub
        ? "https"
        : forwardedProto === "https" || forwardedProto === "http"
          ? forwardedProto
          : "http";
    return `${proto}://${forwardedHost}${path}`;
  }

  if (hub) return `${hub.origin}${path}`;
  return path;
}
