import { defineConfig, devices } from "@playwright/test";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: `test-results/history/run-${timestamp}.json` }],
  ],
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Auth setup — signs in common users and saves storage state to disk.
    // Runs once before the browser-specific test projects.
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["auth-setup"],
      testIgnore: "auth.setup.ts",
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["auth-setup"],
      testIgnore: "auth.setup.ts",
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      VITE_E2E_TESTING: "true",
    },
  },
});
