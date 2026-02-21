import { test as setup } from "@playwright/test";
import { signIn } from "./helpers/auth";
import * as fs from "fs";

/**
 * Playwright auth setup — runs once before all test projects.
 *
 * Signs in common test users and saves their browser storage state
 * to disk. Test files that need a pre-authenticated user can create
 * their browser context with `storageState` pointed at the saved file,
 * avoiding repeated Firebase anonymous auth calls.
 *
 * Requires VITE_E2E_TESTING=true on the dev server so Firebase uses
 * localStorage persistence (capturable by Playwright's storageState).
 */

const AUTH_DIR = "test-results/.auth";

setup("authenticate default user", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.goto("/");
  await signIn(page, "Test User");
  await page.context().storageState({ path: `${AUTH_DIR}/default.json` });
});

setup("authenticate AI tester", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.goto("/");
  await signIn(page, "AI Tester");
  await page.context().storageState({ path: `${AUTH_DIR}/ai-tester.json` });
});
