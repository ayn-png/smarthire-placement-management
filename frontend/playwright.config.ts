import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * SmartHire — Playwright E2E Test Configuration
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: false,        // tests share Firebase state — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,             // 30s per test
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    // Load test env vars
    storageState: undefined,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testMatch: ["**/auth/**", "**/super-admin/dashboard*"],
    },
  ],

  // Auto-start dev server if not already running
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    cwd: path.resolve(__dirname),
    timeout: 60_000,
  },
});
