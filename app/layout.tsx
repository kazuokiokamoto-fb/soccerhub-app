import React from "react";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/app/lib/auth";
import AppHeader from "@/app/components/AppHeader";
import BadgeResync from "@/app/components/BadgeResync";
import SelectionSessionBoundary from "@/app/components/SelectionSessionBoundary";
import {
  HUB_THEME_COLOR,
  SELECTION_THEME_COLOR,
  SITE_ORIGIN,
  brandIcons,
  hubShareImage,
} from "@/lib/brand/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const scoreboard = Barlow_Condensed({
  variable: "--font-score",
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
});

const logoFont = Zen_Kaku_Gothic_New({
  variable: "--font-logo-jp",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const hubDescription =
  "練習試合マッチングです。相手を探して、募集して、チャットで調整できます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "サカまっち",
  description: hubDescription,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "サカまっち",
  },
  openGraph: {
    title: "サカまっち",
    description: hubDescription,
    siteName: "サカまっち",
    locale: "ja_JP",
    type: "website",
    url: "/",
    images: [hubShareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "サカまっち",
    description: hubDescription,
    images: [hubShareImage.url],
  },
  icons: brandIcons,
  // Google Search Console 所有権確認用
  verification: {
    google: "gvJkFsQb91zPZOvAMBloH9h810SE1nc9kakUYxbOg60",
  },
};

const appZone = process.env.NEXT_PUBLIC_APP_ZONE === "selection" ? "selection" : "hub";

export const viewport: Viewport = {
  themeColor: appZone === "selection" ? SELECTION_THEME_COLOR : HUB_THEME_COLOR,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" data-zone={appZone}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${logoFont.variable} ${scoreboard.variable} antialiased`}
      >
        <AuthProvider>
          <AppHeader />
          <BadgeResync />
          <SelectionSessionBoundary />
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
