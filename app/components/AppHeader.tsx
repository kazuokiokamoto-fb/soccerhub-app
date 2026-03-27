"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
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
        () => loadUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadUnread() {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    setUnreadCount(count ?? 0);
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
        {/* ロゴ */}
        <Link href="/" className="smh-brand">
          <div className="smh-brandMark">⚽</div>
          <div>
            <div className="logoText">サカまち</div>
            <div className="smh-brandSub">Soccer Match</div>
          </div>
        </Link>

        {/* ナビ */}
        <nav className="smh-nav">
          {pathname !== "/login" && (
            <>
              {/* 🔔 通知（←これが重要） */}
              <Link href="/notifications" className="smh-bell">
                🔔
                {unreadCount > 0 && (
                  <span className="smh-bellBadge">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {/* ユーザー */}
          {loading ? (
            <span className="smh-user">...</span>
          ) : user ? (
            <>
              <button
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