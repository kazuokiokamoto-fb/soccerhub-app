"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";

export default function AppHeader() {
  if (typeof window === "undefined") {
    return null;
  }

  const router = useRouter();
  const pathname = usePathname();

  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = React.useState(false);

  if (pathname === "/login") return null;

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

  const navItems = [
    { href: "/match", label: "試合を探す" },
    { href: "/teams/search", label: "チーム検索" },
    { href: "/teams", label: "マイページ" },
    { href: "/chat", label: "チャット" },
  ];

  return (
    <header style={styles.shell}>
      <div style={styles.inner}>
        <Link href="/" style={styles.brandWrap}>
          <div style={styles.logoBall}>⚽</div>
          <div style={styles.brandTextWrap}>
            <div style={styles.brandMain}>サカまち</div>
            <div style={styles.brandSub}>Soccer Match Hub</div>
          </div>
        </Link>

        <nav style={styles.centerNav}>
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.navLink,
                  ...(active ? styles.navLinkActive : null),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={styles.right}>
          {loading ? (
            <span style={styles.email}>読み込み中…</span>
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
              className="sh-btn sh-btn--primary"
              style={{ ...styles.btn, textDecoration: "none" }}
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    borderBottom: "1px solid #dbe9de",
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
  },
  inner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "12px 16px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 16,
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    minWidth: 0,
  },
  logoBall: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
    color: "#fff",
    fontSize: 22,
    boxShadow: "0 6px 14px rgba(20,92,42,0.18)",
    flexShrink: 0,
  },
  brandTextWrap: {
    display: "grid",
    lineHeight: 1.1,
  },
  brandMain: {
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: 0.2,
    color: "#145c2a",
  },
  brandSub: {
    fontSize: 11,
    color: "#5a6b60",
    letterSpacing: 0.3,
  },
  centerNav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  navLink: {
    textDecoration: "none",
    color: "#23412c",
    fontWeight: 700,
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 999,
    background: "transparent",
    border: "1px solid transparent",
  },
  navLinkActive: {
    background: "#eef7f0",
    borderColor: "#d6eadb",
    color: "#145c2a",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-end",
    minWidth: 0,
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
    padding: "8px 12px",
    borderRadius: 10,
    whiteSpace: "nowrap",
  },
};