import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  // One shared demo database: files run one at a time, in name order (00-time-to-understanding needs a fresh reset).
  workers: 1,
  fullyParallel: false,
  // PW_CHROMIUM_PATH lets sandboxes with a preinstalled Chromium skip the browser download.
  use: { baseURL, launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {} },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // When BASE_URL is not given, build-and-start the app locally for the run.
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "pnpm start", url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
