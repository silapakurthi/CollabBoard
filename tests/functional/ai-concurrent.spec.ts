import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  sendAICommand,
  getAllCanvasObjects,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

/**
 * Concurrent AI Commands — verifies that two users can issue AI commands
 * simultaneously on the same board without interference.
 *
 * Both commands go through the boardAgent Cloud Function, each creating
 * its own independent Firestore batch write. This test confirms that
 * concurrent requests don't corrupt or overwrite each other's results.
 */
test.describe("Concurrent AI Commands", () => {
  test.setTimeout(120_000);

  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  const boardUrls: string[] = [];

  test.beforeEach(async ({ browser }) => {
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    await pageA.goto("/");
    await signIn(pageA, "AI User A");

    await pageB.goto("/");
    await signIn(pageB, "AI User B");
  });

  test.afterEach(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    boardUrls.length = 0;
    await contextA.close();
    await contextB.close();
  });

  test("two users can issue AI commands simultaneously on the same board", async () => {
    // User A creates a board
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Concurrent AI Test");
    boardUrls.push(boardUrl);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Both users submit AI commands as close to simultaneously as possible
    await Promise.all([
      sendAICommand(pageA, "Add a yellow sticky note that says 'From User A'"),
      sendAICommand(pageB, "Add a blue sticky note that says 'From User B'"),
    ]);

    // Give Firestore time to propagate both writes via onSnapshot
    await waitForSync(3000);

    // Reload both pages to ensure fresh Firestore reads
    await Promise.all([
      pageA.reload().then(() =>
        pageA.waitForSelector(".konvajs-content", { timeout: 15_000 })
      ),
      pageB.reload().then(() =>
        pageB.waitForSelector(".konvajs-content", { timeout: 15_000 })
      ),
    ]);
    await waitForSync(2000);

    // Get objects from both browsers
    const objectsA = await getAllCanvasObjects(pageA);
    const objectsB = await getAllCanvasObjects(pageB);

    // Find sticky notes by text content
    const fromUserA_inA = objectsA.find(
      (o) => o.type === "sticky" && o.text?.includes("From User A"),
    );
    const fromUserB_inA = objectsA.find(
      (o) => o.type === "sticky" && o.text?.includes("From User B"),
    );
    const fromUserA_inB = objectsB.find(
      (o) => o.type === "sticky" && o.text?.includes("From User A"),
    );
    const fromUserB_inB = objectsB.find(
      (o) => o.type === "sticky" && o.text?.includes("From User B"),
    );

    // Both sticky notes must exist in BOTH browsers
    expect(fromUserA_inA, "User A's sticky should be visible to User A").toBeTruthy();
    expect(fromUserB_inA, "User B's sticky should be visible to User A").toBeTruthy();
    expect(fromUserA_inB, "User A's sticky should be visible to User B").toBeTruthy();
    expect(fromUserB_inB, "User B's sticky should be visible to User B").toBeTruthy();

    // Verify no errors in either browser
    const errorA = pageA.locator(".bg-red-50.border-red-200");
    const errorB = pageB.locator(".bg-red-50.border-red-200");
    expect(await errorA.isVisible().catch(() => false)).toBe(false);
    expect(await errorB.isVisible().catch(() => false)).toBe(false);
  });
});
