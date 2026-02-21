import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Try to load a previously saved storage state file for the given user.
 * Returns the file path if it exists, or undefined if not available.
 * Used by tests to restore Firebase auth from a prior auth.setup run.
 */
export function loadStorageState(user: string): string | undefined {
  const statePath = path.join(
    process.cwd(),
    "test-results",
    ".auth",
    `${user}.json`,
  );
  return fs.existsSync(statePath) ? statePath : undefined;
}

/**
 * Sign in as a guest user via anonymous Firebase auth.
 * Fills the name input on the login page and clicks "Continue as Guest".
 *
 * If the page already shows "Welcome," (e.g. auth was restored from
 * Playwright's storageState), this function returns immediately.
 *
 * When running against Firebase emulators (recommended for testing),
 * there are no rate limits. If hitting production Firebase, retries
 * with exponential backoff on rate-limit errors.
 */
export async function signIn(page: Page, displayName = "Test User") {
  // If already authenticated, skip sign-in
  const alreadySignedIn = await page
    .locator("text=Welcome,")
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  if (alreadySignedIn) {
    return;
  }

  // Wait for the login page to load
  await page.waitForSelector('input[placeholder="Enter your name..."]', {
    timeout: 15_000,
  });

  // Fill the guest name input
  await page.fill('input[placeholder="Enter your name..."]', displayName);

  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Click "Continue as Guest"
    await page.click("text=Continue as Guest");

    // Wait for either the board list (success) or an error message
    const result = await Promise.race([
      page
        .waitForSelector("text=Welcome,", { timeout: 15_000 })
        .then(() => "success" as const),
      page
        .waitForSelector("text=too-many-requests", { timeout: 10_000 })
        .then(() => "rate-limited" as const),
    ]);

    if (result === "success") {
      return;
    }

    // Rate-limited — wait with exponential backoff and retry
    if (attempt < maxRetries) {
      const delay = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
      await page.waitForTimeout(delay);
    }
  }

  throw new Error(
    `signIn failed after ${maxRetries + 1} attempts due to Firebase rate limiting. ` +
      `Ensure Firebase emulators are running: npx firebase emulators:start --only auth,firestore`,
  );
}
