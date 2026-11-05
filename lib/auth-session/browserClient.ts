import { createBrowserClient } from "@supabase/ssr";

/**
 * The only browser auth client for both zones.
 * Do not pass cookieOptions, cookies, or auth.storageKey. @supabase/ssr then
 * uses document.cookie, storage key sb-<project-ref>-auth-token, PKCE, and
 * host-only cookies (no Domain attribute).
 */
export const SAKAMATCH_BROWSER_CLIENT_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
} as const;

export function createSakamatchBrowserClient(supabaseUrl: string, supabaseAnonKey: string) {
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    SAKAMATCH_BROWSER_CLIENT_OPTIONS
  );
}
