"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";

function shortenEmail(email?: string | null) {
  if (!email) return "";
  if (email.length <= 18) return email;
  return `${email.slice(0, 8)}…`;
}

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

  return (
    <header className="smh-header">
      <div className="smh-inner">
        <Link href="/" className="smh-brand" aria-label="サカまち トップへ">
          <div className="smh-logoMark">⚽</div>

          <div className="smh-logoTextWrap">
            <div className="smh-logoJa">サカまち</div>
            <div className="smh-logoEn">Soccer Match</div>
          </div>
        </Link>

        <nav className="smh-nav">
          <Link href="/match" className={`smh-link ${pathname === "/match" ? "is-active" : ""}`}>
            試合
          </Link>
          <Link href="/teams/search" className={`smh-link ${pathname?.startsWith("/teams/search") ? "is-active" : ""}`}>
            検索
          </Link>
          <Link href="/teams" className={`smh-link ${pathname?.startsWith("/teams") && !pathname?.startsWith("/teams/search") ? "is-active" : ""}`}>
            マイページ
          </Link>
          <Link href="/chat" className={`smh-link ${pathname?.startsWith("/chat") ? "is-active" : ""}`}>
            チャット
          </Link>
        </nav>

        <div className="smh-actions">
          {loading ? (
            <span className="smh-email">...</span>
          ) : user ? (
            <>
              <span className="smh-email" title={user.email ?? user.id}>
                {shortenEmail(user.email ?? user.id)}
              </span>
              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className="smh-logout"
              >
                {busy ? "…" : "ログアウト"}
              </button>
            </>
          ) : (
            <Link href="/login" className="smh-logout">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}