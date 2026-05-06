"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import { getUnifiedBadgeCount, syncAppBadge } from "@/app/lib/badge";

const TABS = [
  { href: "/", label: "ホーム" },
  { href: "/chat", label: "チャット" },
  { href: "/mypage", label: "マイページ" },
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

  const [badgeCount, setBadgeCount] = useState(0);

  const chatBadgeText = useMemo(() => {
    if (badgeCount <= 0) return "";
    if (badgeCount > 99) return "99+";
    return String(badgeCount);
  }, [badgeCount]);

  useEffect(() => {
    if (loading) return;

    if (!meId) {
      setBadgeCount(0);
      void syncAppBadge(0);
      return;
    }

    let alive = true;

    const syncAll = async () => {
      try {
        const total = await getUnifiedBadgeCount(meId);
        if (!alive) return;

        setBadgeCount(total);
        await syncAppBadge(total);
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
    <nav style={wrap} aria-label="メインナビゲーション">
      <div style={tabRow}>
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);

          const showBadge = tab.href === "/chat" && badgeCount > 0;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                ...tabBase,
                ...(active ? tabActive : tabInactive),
              }}
            >
              <span style={tabInner}>
                <span style={tabLabel}>{tab.label}</span>

                {showBadge ? (
                  <span style={badge}>{chatBadgeText}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const wrap: React.CSSProperties = {
  marginBottom: 12,
};

const tabRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const tabBase: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 8px",
  borderRadius: 999,
  textAlign: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  border: "1px solid #d6eadb",
  transition: "all 0.15s ease",
};

const tabActive: React.CSSProperties = {
  background: "#145c2a",
  borderColor: "#145c2a",
  color: "#fff",
  boxShadow: "0 6px 14px rgba(20,92,42,0.14)",
};

const tabInactive: React.CSSProperties = {
  background: "#fff",
  color: "#23412c",
};

const tabInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minWidth: 0,
  maxWidth: "100%",
};

const tabLabel: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const badge: React.CSSProperties = {
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
  lineHeight: "18px",
  textAlign: "center",
  flexShrink: 0,
  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
};