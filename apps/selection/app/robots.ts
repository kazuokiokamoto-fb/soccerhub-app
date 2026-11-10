import type { MetadataRoute } from "next";

/** This file is served only on the selection deployment origin, not on www. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
