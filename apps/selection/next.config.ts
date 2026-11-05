import type { NextConfig } from "next";
import path from "path";
import { SELECTION_ASSET_PREFIX } from "../../lib/selection-frontend/routing";

const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  assetPrefix: SELECTION_ASSET_PREFIX,
  env: {
    NEXT_PUBLIC_APP_ZONE: "selection",
  },
  // Hub source lives outside this app. Point tracing and Turbopack at the repo,
  // while package imports resolve to this app's node_modules via tsconfig paths.
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
