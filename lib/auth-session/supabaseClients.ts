import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { assertHostOnlyCookieOptions } from "./cookies.ts";

export type SharedCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Server client used by both middlewares. cookieOptions is intentionally
 * omitted so both zones persist the session with the library default:
 * Path=/, SameSite=Lax, no Domain, no custom name.
 */
export function createSharedServerClient(args: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: SharedCookie[]) => void;
}) {
  return createServerClient(args.supabaseUrl, args.supabaseAnonKey, {
    cookies: {
      getAll() {
        return args.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          assertHostOnlyCookieOptions(cookie.options);
        });
        args.setAll(cookiesToSet);
      },
    },
  });
}
