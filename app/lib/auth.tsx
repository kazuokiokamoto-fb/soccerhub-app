"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";

type AuthCtx = {
  session: Session | null;
  user: User | null;

  loading: boolean;

  // 管理者判定
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
  const [adminLoading, setAdminLoading] = useState(true);

  const user = session?.user ?? null;

  // 自分が admins に入ってるか確認（RLSで「本人の select のみ許可」想定）
  const refreshAdmin = async () => {
    // user がいないなら admin でもない
    if (!user) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // maybeSingle() は「行なし」でも error にならず data=null のはず
      if (error) {
        console.error("[admins] check error:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 初回セッション取得
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch((e) => {
        console.error("[auth] getSession error:", e);
        setSession(null);
        setLoading(false);
      });

    // 以降のログイン/ログアウトを購読
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // session/user が変わるたびに管理者判定も更新
  useEffect(() => {
    // auth のロード中は待つ
    if (loading) return;
    refreshAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user,
      loading,
      isAdmin,
      adminLoading,
      refreshAdmin,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, loading, isAdmin, adminLoading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}