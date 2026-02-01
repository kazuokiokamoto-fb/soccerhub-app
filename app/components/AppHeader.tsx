"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type UserLike = { id: string; email?: string | null } | null;

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserLike>(null);
  const [busy, setBusy] = useState(false);

  // セッション状態を追跡（初期取得 + 変化を購読）
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ログイン画面ではヘッダーを表示しない（好みで）
  if (pathname === "/login") return null;

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header style={styles.header}>
      <Link href="/" style={styles.brand}>
        SoccerHub
      </Link>

      <nav style={styles.nav}>
        {user ? (
          <>
            <span style={styles.email}>{user.email ?? "login"}</span>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className="sh-btn"
              style={styles.btn}
            >
              {busy ? "ログアウト中…" : "ログアウト"}
            </button>
          </>
        ) : (
          <Link href="/login" className="sh-btn" style={{ ...styles.btn, textDecoration: "none" }}>
            ログイン
          </Link>
        )}
      </nav>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(6px)",
  },
  brand: {
    fontWeight: 900,
    letterSpacing: 0.2,
    textDecoration: "none",
    color: "#111827",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  email: {
    fontSize: 12,
    color: "#666",
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  btn: {
    padding: "8px 10px",
    borderRadius: 10,
  },
};