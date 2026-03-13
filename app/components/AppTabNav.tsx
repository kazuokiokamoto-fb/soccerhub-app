"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/match", icon: "⚽️", label: "試合" },
  { href: "/teams/search", icon: "🔎", label: "検索" },
  { href: "/chat", icon: "💬", label: "チャット" },
  { href: "/mypage", icon: "⚙️", label: "マイページ" },
];

export default function AppTabNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/match") {
      return pathname === "/match" || pathname?.startsWith("/matches");
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <nav style={wrap}>
      {tabs.map((tab) => {
        const active = isActive(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              ...tabItem,
              ...(active ? activeTab : inactiveTab),
            }}
          >
            <span style={tabIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
  marginBottom: 16,
};

const tabItem: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 15,
  border: "1px solid #dbe7df",
};

const activeTab: React.CSSProperties = {
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  boxShadow: "0 8px 20px rgba(20,92,42,0.18)",
};

const inactiveTab: React.CSSProperties = {
  background: "#fff",
  color: "#1f5d30",
};

const tabIcon: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};