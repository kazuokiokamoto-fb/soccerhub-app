"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;

  isAdmin: boolean;
  adminLoading: boolean;
  refreshAdmin: () => Promise<void>;

  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const user = session?.user ?? null;

  const refreshAdmin = useCallback(async (targetUser?: User | null) => {
    const currentUser = targetUser ?? null;

    if (!currentUser?.id) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);

    try {
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("[admins] check error:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    } catch (e) {
      console.error("[admins] unexpected error:", e);
      setIsAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[auth] getSession error:", error);
        }

        if (!mounted) return;

        setSession(initialSession ?? null);
        setLoading(false);

        void refreshAdmin(initialSession?.user ?? null);
      } catch (e) {
        console.error("[auth] getSession unexpected error:", e);

        if (!mounted) return;

        setSession(null);
        setLoading(false);
        setIsAdmin(false);
        setAdminLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession ?? null);
      setLoading(false);

      void refreshAdmin(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshAdmin]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user,
      loading,
      isAdmin,
      adminLoading,
      refreshAdmin: async () => {
        await refreshAdmin(session?.user ?? null);
      },
      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error("[auth] signOut error:", e);
        } finally {
          setSession(null);
          setIsAdmin(false);
          setAdminLoading(false);
        }
      },
    }),
    [session, user, loading, isAdmin, adminLoading, refreshAdmin]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}