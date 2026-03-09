import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_JP, Yuji_Syuku } from "next/font/google";
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

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const yujiSyuku = Yuji_Syuku({
  variable: "--font-yuji-syuku",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "サカまち",
  description: "練習試合 マッチング",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerifJp.variable} ${yujiSyuku.variable} antialiased`}
      >
        <AuthProvider>
          <AppHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}