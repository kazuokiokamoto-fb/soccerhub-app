import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "サカまっち",
    short_name: "サカまっち",
    description:
      "練習試合マッチングです。相手を探して、募集して、チャットで調整できます。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6fbf4",
    theme_color: "#1a9a52",
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
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}