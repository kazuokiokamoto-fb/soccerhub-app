"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { getUnreadChatCount, syncAppBadge } from "@/app/lib/badge";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const setHeaderHeight = () => {
      const height = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${height}px`
      );
    };

    setHeaderHeight();

    const resizeObserver = new ResizeObserver(() => {
      setHeaderHeight();
    });

    resizeObserver.observe(el);
    window.addEventListener("resize", setHeaderHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", setHeaderHeight);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setChatUnreadCount(0);
      syncAppBadge(0);
      return;
    }

    loadChatUnread(user.id);

    const channels = [
      supabase
        .channel(`header-chat-members:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_members",
          },
          () => {
            loadChatUnread(user.id);
          }
        )
        .subscribe(),

      supabase
        .channel(`header-chat-messages:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
          },
          () => {
            loadChatUnread(user.id);
          }
        )
        .subscribe(),
    ];

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadChatUnread(user.id);
      }
    };

    const onBadgeUpdated = () => {
      loadChatUnread(user.id);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("badge-updated", onBadgeUpdated);
    window.addEventListener("notifications-updated", onBadgeUpdated);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("badge-updated", onBadgeUpdated);
      window.removeEventListener("notifications-updated", onBadgeUpdated);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadChatUnread(user.id);
  }, [pathname, user?.id]);

  async function loadChatUnread(userId: string) {
    try {
      const total = await getUnreadChatCount(userId);
      setChatUnreadCount(total);
      await syncAppBadge(total);
    } catch (e) {
      console.error("loadChatUnread error:", e);
    }
  }

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      await syncAppBadge(0);
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header ref={headerRef} className="smh-header">
      <div className="smh-inner">
        <Link href="/" className="smh-brand">
          <div className="smh-brandMark">
            <Image
              src="/header-logo.png"
              alt="サカまちロゴ"
              width={36}
              height={36}
              className="smh-brandMarkImage"
              priority
            />
          </div>

          <div>
            <div className="logoText">サカまっち</div>
            <div className="smh-brandSub">Soccer Match</div>
          </div>
        </Link>

        <nav className="smh-nav">
          {pathname !== "/login" && (
            <Link href="/chat" className="smh-bell" aria-label="チャット">
              💬
              {chatUnreadCount > 0 ? (
                <span className="smh-bellBadge">{chatUnreadCount}</span>
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