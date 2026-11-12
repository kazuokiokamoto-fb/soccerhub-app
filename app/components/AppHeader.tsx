"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import ZoneLink, { assignCrossZone } from "@/app/components/ZoneLink";
import { IconFlag } from "@/app/components/ui/Icons";
import { getUnreadChatCount, syncAppBadge } from "@/app/lib/badge";

const selectionZone = process.env.NEXT_PUBLIC_APP_ZONE === "selection";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
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
      void syncAppBadge(0);
      return;
    }

    let alive = true;

    const loadBadge = async () => {
      try {
        const total = await getUnreadChatCount(user.id);
        if (!alive) return;
        await syncAppBadge(total);
      } catch (e) {
        console.error("AppHeader loadBadge error:", e);
      }
    };

    void loadBadge();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBadge();
      }
    };

    const onBadgeUpdated = () => {
      void loadBadge();
    };

    window.addEventListener("focus", onBadgeUpdated);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("badge-updated", onBadgeUpdated);
    window.addEventListener("notifications-updated", onBadgeUpdated);

    return () => {
      alive = false;
      window.removeEventListener("focus", onBadgeUpdated);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("badge-updated", onBadgeUpdated);
      window.removeEventListener("notifications-updated", onBadgeUpdated);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      try {
        const total = await getUnreadChatCount(user.id);
        await syncAppBadge(total);
      } catch (e) {
        console.error("AppHeader pathname sync error:", e);
      }
    };

    void run();
  }, [pathname, user?.id]);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);

    try {
      await signOut();
      await syncAppBadge(0);
      if (assignCrossZone("/login")) return;
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header ref={headerRef} className="smh-header">
      <div className="smh-inner">
        {selectionZone ? (
          <ZoneLink href="/selection" className="smh-brand">
            <div className="smh-brandMark sm-brand-mark--selection" aria-hidden="true">
              <IconFlag size={20} />
            </div>
            <div>
              <div className="logoText">セレクション</div>
            </div>
          </ZoneLink>
        ) : (
          <ZoneLink href="/" className="smh-brand">
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
              <div className="smh-brandSub">練習試合とセレクション</div>
            </div>
          </ZoneLink>
        )}

        <nav className="smh-nav">
          {selectionZone ? (
            <ZoneLink href="/" className="sm-back-site">
              サカまっち
            </ZoneLink>
          ) : null}
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
            <ZoneLink href="/" className="sh-btn smh-logout">
              トップへ
            </ZoneLink>
          ) : (
            <ZoneLink href="/login" className="sh-btn smh-logout">
              ログイン
            </ZoneLink>
          )}
        </nav>
      </div>
    </header>
  );
}