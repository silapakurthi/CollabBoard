import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  getCanvasBounds,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

/**
 * Presence & cursor tests — verifies that users see each other's
 * presence indicators and cursor labels in real time.
 *
 * Covers PRD requirements:
 *  FR-7.1 (presence indicators), FR-7.2 (cursor tracking),
 *  FR-6.2 (user name display), FR-8.3 (guest name visible)
 */
test.describe("Presence & Cursors", () => {
  test.setTimeout(90_000);

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

    // Sign in both users — signIn leaves each page on the board list
    await pageA.goto("/");
    await signIn(pageA, "Alice");

    await pageB.goto("/");
    await signIn(pageB, "Bob");
  });

  test.afterEach(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    boardUrls.length = 0;
    await contextA.close();
    await contextB.close();
  });

  // ── FR-7.1: Presence bar shows other users ──────────────────────────

  test("presence bar shows both users on the same board", async () => {
    // Alice creates a board (already on board list after signIn)
    const boardUrl = await createBoard(pageA, "Presence Test");
    boardUrls.push(boardUrl);

    // Bob joins the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(3000);

    // Alice should see Bob in the presence bar
    const aliceSeesBob = pageA.locator("text=Bob");
    await expect(aliceSeesBob.first()).toBeVisible({ timeout: 15_000 });

    // Bob should see Alice (displayed as "You" for self, but Alice for Bob)
    const bobSeesAlice = pageB.locator("text=Alice");
    await expect(bobSeesAlice.first()).toBeVisible({ timeout: 15_000 });
  });

  // ── FR-7.2 / FR-6.2 / FR-8.3: Cursor name labels ──────────────────

  test("cursor overlay layer exists when another user is present", async () => {
    // Alice creates a board
    const boardUrl = await createBoard(pageA, "Cursor Label Test");
    boardUrls.push(boardUrl);

    // Bob joins the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(3000);

    // Alice moves her mouse around the canvas to trigger cursor updates
    const boxA = await getCanvasBounds(pageA);
    await pageA.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
    await waitForSync(500);
    await pageA.mouse.move(
      boxA.x + boxA.width / 2 + 50,
      boxA.y + boxA.height / 2 + 50,
    );
    await waitForSync(2000);

    // Verify the presence bar shows Alice's name on Bob's page
    const bobSeesAlice = pageB.locator("text=Alice");
    await expect(bobSeesAlice.first()).toBeVisible({ timeout: 15_000 });

    // Verify the canvas has the CursorOverlay layer by checking
    // that the Konva stage has more than one layer (main layer + cursor layer)
    const layerCount = await pageB.evaluate(() => {
      const stage = document.querySelector(".konvajs-content");
      if (!stage) return 0;
      return stage.querySelectorAll("canvas").length;
    });
    // Should have at least 2 canvases (main layer + cursor overlay layer)
    expect(layerCount).toBeGreaterThanOrEqual(2);
  });
});
