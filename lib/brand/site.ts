import type { Metadata } from "next";

export const SITE_ORIGIN = "https://www.sakamatch.com";

/** Lawn green from `--sm-accent`. Browser chrome and the installed app. */
export const HUB_THEME_COLOR = "#127a3c";

/** Sky blue from the selection zone `--sm-accent`. */
export const SELECTION_THEME_COLOR = "#2f6cb8";

/** `--sm-canvas`. */
export const CANVAS_COLOR = "#f6fbf4";

/** Selection zone `--sm-canvas`. */
export const SELECTION_CANVAS_COLOR = "#f4f8ff";

export const hubShareImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "サカまっち 練習試合マッチング",
};

export const selectionShareImage = {
  url: "/selection/og.png",
  width: 1200,
  height: 630,
  alt: "セレクション検索",
};

export const brandIcons = {
  apple: "/apple-icon.png",
  icon: [
    { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
} satisfies NonNullable<Metadata["icons"]>;
