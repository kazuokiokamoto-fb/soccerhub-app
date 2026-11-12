import type { MetadataRoute } from "next";
import { SELECTION_CANVAS_COLOR, SELECTION_THEME_COLOR } from "@/lib/brand/site";

// public/ is shared with the hub via symlink. This file is the selection app's manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "セレクション検索",
    short_name: "セレクション検索",
    description: "セレクション検索。気になるチームのセレクションを探せます。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SELECTION_CANVAS_COLOR,
    theme_color: SELECTION_THEME_COLOR,
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    display_override: ["standalone", "minimal-ui"],
    prefer_related_applications: false,
  };
}
