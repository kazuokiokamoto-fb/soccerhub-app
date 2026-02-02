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
  title: "SoccerHub",
  description: "U-12 練習試合 自動マッチング",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 🔐 認証 Provider を一番外側に */}
        <AuthProvider>
          {/* ✅ useAuth を使うものは必ず内側 */}
          <AppHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}