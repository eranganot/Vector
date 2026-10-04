import path from "node:path";
import { defineConfig } from "vitest/config";

/** Integration tests run against a real Postgres (DATABASE_URL). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
