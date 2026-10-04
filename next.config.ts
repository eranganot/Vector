import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Railway carries .next/cache between builds and environments (Dev and Prod build the same service). A corrupted
    // Turbopack cache failed the Dev build of a248652 ("Failed to open database … failed to remove file …/.del").
    // Builds are clean-room instead: a little slower, never dependent on a shared mutable cache. See STATUS.md.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
