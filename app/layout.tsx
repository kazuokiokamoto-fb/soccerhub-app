import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Zen_Kaku_Gothic_New } from "next/font/google";
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

const logoFont = Zen_Kaku_Gothic_New({
  variable: "--font-logo-jp",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "サカまっち",
  description: "サッカー練習試合マッチング",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "サカまっち",
  },
  icons: {
    apple: "/apple-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#145c2a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${logoFont.variable} antialiased`}
      >
        <AuthProvider>
          <AppHeader />
          {children}
        </AuthProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (!("serviceWorker" in navigator)) return;

                async function registerServiceWorker() {
                  try {
                    const reg = await navigator.serviceWorker.register("/sw.js");
                    console.log("SW registered", reg);

                    try {
                      await reg.update();
                    } catch (e) {
                      console.log("SW update skipped", e);
                    }
                  } catch (err) {
                    console.log("SW error", err);
                  }
                }

                window.addEventListener("load", registerServiceWorker);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}