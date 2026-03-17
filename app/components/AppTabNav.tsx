// app/components/AppTabNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const TABS = [
  { href: "/", label: "ホーム" },
  { href: "/match", label: "募集" },
  { href: "/teams/search", label: "チーム" },
  { href: "/chat", label: "チャット" },
  { href: "/teams", label: "マイ" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppTabNav() {
  const pathname = usePathname();

  return (
    <nav style={wrap} aria-label="メインナビゲーション">
      <div style={tabRow}>
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                ...tabBase,
                ...(active ? tabActive : tabInactive),
              }}
            >
              {tab.label}
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
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 8,
};

const tabBase: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 8px",
  borderRadius: 999,
  textAlign: "center",
  textDecoration: "none",
  fontSize: 13,
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