import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function bearerMatches(header: string, secret: string) {
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(header);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

/** True only when Authorization is exactly `Bearer ${CRON_SECRET}`. Unset secret never matches. */
export function hasCronAuthorization(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return bearerMatches(header, secret);
}

export function cronUnauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function getSessionUserId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Some route handlers expose a read-only cookie store.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
