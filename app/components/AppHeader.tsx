"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = React.useState(false);

  // ※ ここは好み：ログイン画面ではヘッダー不要なら true
  const hideOnLogin = true;
  if (hideOnLogin && pathname === "/login") return null;

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // ✅ 追加：超目立つデバッグバー（return の直前）
  // これが出ない＝AppHeader自体が読み込まれていない/別デプロイを見ている可能性が高い
  const debugText = `HEADER TEST | path=${pathname} | user=${
    loading ? "loading" : user ? "yes" : "no"
  }`;

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 9999,
          background: "yellow",
          padding: 8,
          borderBottom: "1px solid #000",
          fontWeight: 900,
        }}
      >
        {debugText}
      </div>

      <header style={styles.header}>
        <Link href="/" style={styles.brand}>
          SoccerHub
        </Link>

        <nav style={styles.nav}>
          {loading ? (
            <span style={styles.email}>...</span>
          ) : user ? (
            <>
              <span style={styles.email}>{user.email ?? user.id}</span>
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
            <Link
              href="/login"
              className="sh-btn"
              style={{ ...styles.btn, textDecoration: "none" }}
            >
              ログイン
            </Link>
          )}
        </nav>
      </header>
    </>
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