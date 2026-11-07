import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createSharedServerClient } from "@/lib/auth-session/supabaseClients";

export async function createUserClient(): Promise<{
  supabase: SupabaseClient;
  userId: string;
} | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  // Same host-only cookie contract as both zone middlewares. Official-results
  // requests stay on the hub and must not mint a second cookie scope.
  const supabase = createSharedServerClient({
    supabaseUrl,
    supabaseAnonKey: anonKey,
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Route handlers can expose a read-only cookie store.
      }
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}
