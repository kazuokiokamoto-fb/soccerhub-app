import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/app/lib/auth";
import AppHeader from "@/app/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "サカまち",
  description: "サッカー練習試合マッチングサービス",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          background: "#f6f8f7",
          color: "#111827",
        }}
      >
        {/* 認証Provider */}
        <AuthProvider>
          {/* 共通ヘッダー */}
          <AppHeader />

          {/* メイン */}
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "16px",
              minHeight: "calc(100vh - 80px)",
            }}
          >
            {children}
          </div>

          {/* フッター */}
          <footer
            style={{
              marginTop: 40,
              padding: "20px 16px",
              borderTop: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              <div>© {new Date().getFullYear()} サカまち</div>

              <div style={{ display: "flex", gap: 14 }}>
                <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>
                  ホーム
                </a>
                <a href="/match" style={{ color: "#6b7280", textDecoration: "none" }}>
                  マッチング
                </a>
                <a href="/teams" style={{ color: "#6b7280", textDecoration: "none" }}>
                  マイページ
                </a>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}