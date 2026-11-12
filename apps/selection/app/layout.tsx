import type { Metadata } from "next";
import HubLayout, { viewport } from "../../../app/layout";
import {
  SITE_ORIGIN,
  brandIcons,
  selectionShareImage,
} from "@/lib/brand/site";

const selectionDescription =
  "セレクション検索。気になるチームのセレクションを探せます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
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
    url: "/selection",
    images: [selectionShareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "セレクション検索",
    description: selectionDescription,
    images: [selectionShareImage.url],
  },
  icons: brandIcons,
};

export { viewport };

export default HubLayout;
