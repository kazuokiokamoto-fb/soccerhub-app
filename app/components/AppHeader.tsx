"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export default function AppHeader() {
  if (typeof window === "undefined") {
    return null;
  }

  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const [busy, setBusy] = React.useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 🔔 未読件数取得
  useEffect(() => {
    if (!user) return;

    loadUnread();

    const channel = supabase
      .channel("notifications-header")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadUnread() {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    if (!error) {
      setUnreadCount(count ?? 0);
    }
  }

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
          <div className="smh-brandMark">⚽</div>

          <div className="smh-brandTextWrap">
            <div className="logoText">サカまち</div>
            <div className="smh-brandSub">Soccer Match</div>
          </div>
        </Link>

        <nav className="smh-nav">
          {pathname !== "/login" ? (
            <>
              <Link href="/match" className="smh-link">
                試合
              </Link>
              <Link href="/teams/search" className="smh-link">
                検索
              </Link>
              <Link href="/teams" className="smh-link">
                マイページ
              </Link>
              <Link href="/chat" className="smh-link">
                チャット
              </Link>

              {/* 🔔 通知 */}
              <Link href="/notifications" className="smh-link" style={{ position: "relative" }}>
                🔔

                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -10,
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: "999px",
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 900,
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          ) : null}

          {loading ? (
            <span className="smh-user">...</span>
          ) : user ? (
            <>
              <span className="smh-user">{user.email ?? "ログイン中"}</span>
              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className="sh-btn smh-logout"
              >
                {busy ? "..." : "ログアウト"}
              </button>
            </>
          ) : pathname === "/login" ? (
            <Link href="/" className="sh-btn smh-logout">
              トップへ
            </Link>
          ) : (
            <Link href="/login" className="sh-btn smh-logout">
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}