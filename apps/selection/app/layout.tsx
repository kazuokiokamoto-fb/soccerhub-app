import type { Metadata } from "next";
import HubLayout, { viewport } from "../../../app/layout";

export const metadata: Metadata = {
  title: "セレクション検索",
  description: "セレクション検索。気になるチームのセレクションを探せます。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "セレクション検索",
  },
};

export { viewport };

export default HubLayout;
