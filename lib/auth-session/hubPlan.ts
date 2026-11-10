import { hasSupabaseAuthSessionCookie, supabaseAuthCookiePrefix } from "./cookies.ts";
import { isSelectionPagePath } from "./paths.ts";

/**
 * When selection routing is on, the hub must not refresh the Supabase session.
 * A second getUser() on the same request rotates the refresh token and logs
 * the user out. The selection zone performs the single refresh.
 *
 * Missing session cookie → existing hub /login. Present cookie → proxy, so a
 * signed-in user is not asked to log in again.
 */
export type HubSelectionPlan =
  | { action: "legacy" }
  | { action: "to-login" }
  | { action: "proxy" };

export function hubSelectionPlan(input: {
  routingEnabled: boolean;
  pathname: string;
  cookieNames: readonly string[];
  supabaseUrl: string | undefined;
}): HubSelectionPlan {
  if (!input.routingEnabled) return { action: "legacy" };
  if (!isSelectionPagePath(input.pathname)) return { action: "legacy" };

  const prefix = supabaseAuthCookiePrefix(input.supabaseUrl);
  if (!prefix) return { action: "legacy" };
  if (!hasSupabaseAuthSessionCookie(input.cookieNames, prefix)) {
    return { action: "to-login" };
  }
  return { action: "proxy" };
}
