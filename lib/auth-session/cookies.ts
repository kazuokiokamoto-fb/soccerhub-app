/**
 * Cookie contract shared by the hub and the selection zone.
 *
 * @supabase/ssr names the session cookie sb-<project-ref>-auth-token and does
 * not set Domain unless cookieOptions.domain is passed. Omitting Domain keeps
 * the cookie host-only, which is what www.sakamatch.com already uses. Both
 * apps must keep that default or the browser will treat them as two logins.
 */

export function supabaseProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const hostname = new URL(supabaseUrl).hostname.toLowerCase();
    const ref = hostname.split(".")[0] ?? "";
    if (!ref || !/^[a-z0-9-]+$/.test(ref)) return null;
    return ref;
  } catch {
    return null;
  }
}

export function supabaseAuthCookiePrefix(supabaseUrl: string | undefined): string | null {
  const ref = supabaseProjectRef(supabaseUrl);
  if (!ref) return null;
  return `sb-${ref}-auth-token`;
}

export function hasSupabaseAuthSessionCookie(
  cookieNames: readonly string[],
  prefix: string
): boolean {
  return cookieNames.some((name) => name === prefix || name.startsWith(`${prefix}.`));
}

export function assertHostOnlyCookieOptions(
  options: { domain?: string; name?: string } | undefined
): void {
  if (!options) return;
  if (options.domain) {
    throw new Error(
      "Refusing supabase auth cookie Domain. Sessions must stay host-only on the hub host."
    );
  }
  if (options.name) {
    throw new Error(
      "Refusing supabase auth cookie name override. It would split the shared login storage key."
    );
  }
}
