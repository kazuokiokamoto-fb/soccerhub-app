import type { NextConfig } from "next";
import { hubRoutingBuild, routingEnvFromProcess } from "./lib/selection-frontend/routing";

const routing = hubRoutingBuild(routingEnvFromProcess());

if (process.env.NODE_ENV !== "production" && process.env.SELECTION_FRONTEND_ROUTING === "1" && !routing.enabled) {
  console.warn(`[selection-frontend] routing stayed off (${routing.reason}). Existing /selection routes will be served by this app.`);
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  env: {
    // Derived from the rewrite decision. Do not set this in the Vercel dashboard.
    NEXT_PUBLIC_SELECTION_ZONE_ACTIVE: routing.clientFlag,
  },
  async rewrites() {
    return {
      beforeFiles: routing.beforeFiles,
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
