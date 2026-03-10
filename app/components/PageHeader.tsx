"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Props = {
  actions?: React.ReactNode;
  showLogout?: boolean;
  hideActionsOnChat?: boolean;
};

export default function PageHeader({
  actions,
  showLogout = true,
  hideActionsOnChat = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const isChat = pathname?.startsWith("/chat");
  const shouldHideActions = hideActionsOnChat && isChat;

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.refresh();
      router.replace("/login");
    }
  };

  return (
    <header style={styles.header}>
      <Link href="/" style={styles.brandWrap}>
        <div style={styles.logo}>⚽</div>

        <div style={styles.brandTextWrap}>
          <div style={styles.brandMain}>サカまち</div>
          <div style={styles.brandSub}>Soccer Match</div>
        </div>
      </Link>

      <div style={styles.right}>
        {!shouldHideActions && actions ? (
          <div style={styles.actions}>{actions}</div>
        ) : null}

        {showLogout ? (
          <button className="sh-btn" onClick={logout}>
            ログアウト
          </button>
        ) : null}
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 14,
  },

  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },

  logo: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "linear-gradient(135deg,#1e7f3c,#145c2a)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },

  brandTextWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.1,
  },

  brandMain: {
    fontWeight: 900,
    fontSize: 20,
    fontStyle: "italic",
    color: "#145c2a",
    letterSpacing: 0.5,
  },

  brandSub: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
};