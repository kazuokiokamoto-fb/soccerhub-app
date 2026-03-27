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

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    loadUnread(user.id);

    const channel = supabase
      .channel(`notifications-header:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          loadUnread(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function loadUnread(userId: string) {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("header unread count error:", error);
      return;
    }

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
        <Link href="/" className="smh-brand">
          <div className="smh-brandMark">⚽</div>
          <div>
            <div className="logoText">サカまち</div>
            <div className="smh-brandSub">Soccer Match</div>
          </div>
        </Link>

        <nav className="smh-nav">
          {pathname !== "/login" && (
            <Link href="/notifications" className="smh-bell" aria-label="通知">
              🔔
              {unreadCount > 0 ? (
                <span className="smh-bellBadge">{unreadCount}</span>
              ) : null}
            </Link>
          )}

          {loading ? (
            <span className="smh-user">...</span>
          ) : user ? (
            <button
              onClick={onLogout}
              disabled={busy}
              className="sh-btn smh-logout"
            >
              {busy ? "..." : "ログアウト"}
            </button>
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