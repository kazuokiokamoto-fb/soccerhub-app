import type { Metadata } from "next";
import HubLayout, { viewport } from "../../../app/layout";

const selectionDescription =
  "セレクション検索。気になるチームのセレクションを探せます。";

export const metadata: Metadata = {
  title: "セレクション検索",
  description: selectionDescription,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "セレクション検索",
  },
  openGraph: {
    title: "セレクション検索",
    description: selectionDescription,
    siteName: "セレクション検索",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "セレクション検索",
    description: selectionDescription,
  },
};

export { viewport };

export default HubLayout;
