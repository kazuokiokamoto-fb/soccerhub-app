import type { MetadataRoute } from "next";

const BASE_URL = "https://www.sakamatch.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth",
        "/calendar",
        "/chat",
        "/login",
        "/map",
        "/match",
        "/mypage",
        "/results",
        "/search",
        "/selection",
        "/teams",
        "/venues",
        "/video",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
