import path from "node:path";
import { defineConfig } from "vitest/config";

/** Integration tests run against a real Postgres (DATABASE_URL). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    // 52 weeks of synthetic history (plan v2, E1c): a seed plus a demo reset in a beforeAll takes ~10–15 s.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
