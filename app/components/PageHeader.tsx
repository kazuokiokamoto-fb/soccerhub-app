// app/components/PageHeader.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Props = {
  /** 右側に置くボタン群（1〜2個推奨） */
  actions?: React.ReactNode;
  /** 右端のログアウトを出すか（デフォルト true） */
  showLogout?: boolean;
};

export default function PageHeader({ actions, showLogout = true }: Props) {
  const router = useRouter();

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.refresh();
      router.replace("/login");
    }
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #eee",
        marginBottom: 14,
      }}
    >
      <Link
        href="/"
        style={{
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: 0.2,
          textDecoration: "none",
          color: "#111827",
        }}
      >
        SoccerHub
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}

        {showLogout ? (
          <button className="sh-btn" type="button" onClick={logout}>
            ログアウト
          </button>
        ) : null}
      </div>
    </header>
  );
}