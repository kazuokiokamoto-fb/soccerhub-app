/**
 * Cross-zone navigations must be full page loads.
 * Client-side RSC transitions between two Next.js builds break the session UI
 * even when the cookies themselves are valid.
 */

export type AppZone = "hub" | "selection";

export type ZoneFlags = {
  appZone: AppZone;
  hubRoutingActive: boolean;
};

export function zoneFlagsFromEnv(env: {
  NEXT_PUBLIC_APP_ZONE?: string;
  NEXT_PUBLIC_SELECTION_ZONE_ACTIVE?: string;
}): ZoneFlags {
  return {
    appZone: env.NEXT_PUBLIC_APP_ZONE === "selection" ? "selection" : "hub",
    hubRoutingActive: env.NEXT_PUBLIC_SELECTION_ZONE_ACTIVE === "1",
  };
}

export function selectionPathname(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const path = href.split(/[?#]/)[0] || "/";
  return path;
}

export function isSelectionPageHref(href: string): boolean {
  const path = selectionPathname(href);
  if (!path) return false;
  return path === "/selection" || path.startsWith("/selection/");
}

export function needsHardNavigation(href: string, zone: ZoneFlags): boolean {
  const path = selectionPathname(href);
  if (!path) return false;
  const selection = path === "/selection" || path.startsWith("/selection/");
  if (zone.appZone === "selection") return !selection;
  if (zone.hubRoutingActive) return selection;
  return false;
}
