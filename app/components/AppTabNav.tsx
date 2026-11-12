"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import ZoneLink from "@/app/components/ZoneLink";
import { IconChat, IconFlag, IconHome, IconUser } from "@/app/components/ui/Icons";
import {
  getUnifiedBadgeCount,
  getUnreadChatCount,
  getUnreadSelectionCount,
  syncAppBadge,
} from "@/app/lib/badge";

const TABS = [
  { href: "/", label: "ホーム", icon: IconHome },
  { href: "/chat", label: "チャット", icon: IconChat },
  { href: "/selection", label: "セレクション", icon: IconFlag },
  { href: "/mypage", label: "マイページ", icon: IconUser },
];

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function isActive(pathname: string, href: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  if (target === "/") {
    return current === "/" || current === "/match";
  }

  return current === target || current.startsWith(`${target}/`);
}

export default function AppTabNav() {
  const pathname = usePathname() || "/";
  const { user, loading } = useAuth();
  const meId = user?.id ?? "";

  // 「チャット」タブに表示する数字はチャット未読数のみ(通知全般の合算ではない)
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  // 「セレクション」タブに表示する数字はセレクション新着通知の未読数のみ
  const [selectionBadgeCount, setSelectionBadgeCount] = useState(0);
  const [trackedUserId, setTrackedUserId] = useState(meId);

  if (trackedUserId !== meId) {
    setTrackedUserId(meId);
    setChatBadgeCount(0);
    setSelectionBadgeCount(0);
  }

  const chatBadgeText = useMemo(() => {
    if (chatBadgeCount <= 0) return "";
    if (chatBadgeCount > 99) return "99+";
    return String(chatBadgeCount);
  }, [chatBadgeCount]);

  const selectionBadgeText = useMemo(() => {
    if (selectionBadgeCount <= 0) return "";
    if (selectionBadgeCount > 99) return "99+";
    return String(selectionBadgeCount);
  }, [selectionBadgeCount]);

  useEffect(() => {
    if (loading) return;

    if (!meId) {
      void syncAppBadge(0);
      return;
    }

    let alive = true;

    const syncAll = async () => {
      try {
        // チャットタブの表示用: チャット未読数のみ
        const chatCount = await getUnreadChatCount(meId);
        if (!alive) return;
        setChatBadgeCount(chatCount);

        // セレクションタブの表示用: セレクション新着通知の未読数のみ
        const selectionCount = await getUnreadSelectionCount(meId);
        if (!alive) return;
        setSelectionBadgeCount(selectionCount);

        // OSアプリアイコンのバッジ用: チャット+その他通知の合算
        const unifiedTotal = await getUnifiedBadgeCount(meId);
        if (!alive) return;
        await syncAppBadge(unifiedTotal);
      } catch (e) {
        console.error("AppTabNav badge sync error:", e);
      }
    };

    void syncAll();

    const intervalId = window.setInterval(() => {
      void syncAll();
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncAll();
      }
    };

    const handleFocus = () => {
      void syncAll();
    };

    const handleBadgeUpdated = () => {
      void syncAll();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("badge-updated", handleBadgeUpdated);
    window.addEventListener("notifications-updated", handleBadgeUpdated);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("badge-updated", handleBadgeUpdated);
      window.removeEventListener("notifications-updated", handleBadgeUpdated);
    };
  }, [meId, loading]);

  return (
    <nav className="app-tab-nav" aria-label="メインナビゲーション">
      <div className="app-tab-row">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);

          const showChatBadge = tab.href === "/chat" && chatBadgeCount > 0;
          const showSelectionBadge =
            tab.href === "/selection" && selectionBadgeCount > 0;

          const badgeText = showChatBadge
            ? chatBadgeText
            : showSelectionBadge
            ? selectionBadgeText
            : "";

          const showBadge = showChatBadge || showSelectionBadge;

          return (
            <ZoneLink
              key={tab.href}
              href={tab.href}
              className={active ? "app-tab app-tab--active" : "app-tab"}
              aria-current={active ? "page" : undefined}
            >
              <tab.icon size={18} />
              <span className="app-tab-label">{tab.label}</span>
              {showBadge ? <span className="app-tab-badge">{badgeText}</span> : null}
            </ZoneLink>
          );
        })}
      </div>
    </nav>
  );
}
