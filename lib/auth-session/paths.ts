/** Path rules shared by the hub middleware and the selection zone. */

export function isSelectionPagePath(pathname: string): boolean {
  return pathname === "/selection" || pathname.startsWith("/selection/");
}

export function isSelectionAssetPath(pathname: string): boolean {
  return pathname === "/selection-static" || pathname.startsWith("/selection-static/");
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" || pathname === "/auth/callback";
}

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/teams") ||
    pathname.startsWith("/match") ||
    pathname.startsWith("/venues") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/results") ||
    pathname.startsWith("/search") ||
    isSelectionPagePath(pathname) ||
    pathname.startsWith("/video") ||
    pathname.startsWith("/mypage")
  );
}

/**
 * Where another tab should go after SIGNED_OUT. Protected pages return to the
 * hub login. Public pages stay put so a logout on one tab does not pull the
 * home tab off the public page.
 */
export function crossTabSignOutDestination(pathname: string, search: string): string | null {
  if (!isProtectedPath(pathname) || isPublicPath(pathname)) return null;
  const next = buildSafeRedirectPath(pathname, search);
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return null;
  return `/login?redirect=${encodeURIComponent(next)}`;
}

export function buildSafeRedirectPath(pathname: string, search: string): string {
  const fullPath = `${pathname}${search ?? ""}`;
  if (!fullPath.startsWith("/")) return "/";
  if (fullPath.startsWith("//")) return "/";
  if (fullPath.startsWith("/login")) return "/";
  if (fullPath.startsWith("/auth/callback")) return "/";
  return fullPath;
}

export type LegacyAuthDecision =
  | { action: "next" }
  | { action: "to-login"; redirectParam: string | null }
  | { action: "leave-login"; destination: string };

export function decideLegacyAuth(input: {
  hasUser: boolean;
  pathname: string;
  search: string;
  loginRedirectParam: string | null;
}): LegacyAuthDecision {
  const isPublic = isPublicPath(input.pathname);
  const isProtected = isProtectedPath(input.pathname);

  if (!input.hasUser && isProtected && !isPublic) {
    const redirectPath = buildSafeRedirectPath(input.pathname, input.search);
    return {
      action: "to-login",
      redirectParam: redirectPath !== "/" ? redirectPath : null,
    };
  }

  if (input.hasUser && input.pathname === "/login") {
    const requested = input.loginRedirectParam;
    const destination =
      requested &&
      requested.startsWith("/") &&
      !requested.startsWith("//") &&
      !requested.startsWith("/login")
        ? requested
        : "/";
    return { action: "leave-login", destination };
  }

  return { action: "next" };
}
