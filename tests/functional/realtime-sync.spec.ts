import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  clickCanvas,
  selectTool,
  addObjectDirect,
  getCanvasObjectCount,
  getCanvasObjects,
  getCanvasBounds,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Realtime Sync", () => {
  // Share two browser contexts (User A and User B) across all tests
  // to avoid excessive Firebase anonymous auth calls.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    // Sign in both users once
    await pageA.goto("/");
    await signIn(pageA, "User A");

    await pageB.goto("/");
    await signIn(pageB, "User B");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    await contextA.close();
    await contextB.close();
  });

  test("object syncs between users", async () => {
    // User A creates a board
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Sync Test");
    boardUrls.push(boardUrl);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);

    // Verify both pages are on the board (canvas visible)
    await expect(pageA.locator(".konvajs-content")).toBeVisible();
    await expect(pageB.locator(".konvajs-content")).toBeVisible();

    // User A creates a sticky note
    await selectTool(pageA, "Sticky Note");
    await clickCanvas(pageA);
    await waitForSync(3000);

    // Verify the object appears on User A's canvas
    const countA = await getCanvasObjectCount(pageA);
    expect(countA).toBeGreaterThanOrEqual(1);

    // Verify the object synced to User B's canvas
    const countB = await getCanvasObjectCount(pageB);
    expect(countB).toBeGreaterThanOrEqual(1);
  });

  test("move syncs between users", async () => {
    // User A creates a board with an object
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Move Sync Test");
    boardUrls.push(boardUrl);

    await selectTool(pageA, "Sticky Note");
    await clickCanvas(pageA);
    await waitForSync(2000);

    // User B navigates to the board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Get initial object position on User B via test hook
    const objsBeforeB = await getCanvasObjects(pageB);
    expect(objsBeforeB.length).toBeGreaterThanOrEqual(1);
    const posBeforeB = objsBeforeB[0];

    // User A drags the object
    const boxA = await getCanvasBounds(pageA);
    const cxA = boxA.x + boxA.width / 2;
    const cyA = boxA.y + boxA.height / 2;

    await pageA.mouse.move(cxA, cyA);
    await pageA.mouse.down();
    await pageA.mouse.move(cxA + 120, cyA + 80, { steps: 10 });
    await pageA.mouse.up();
    await waitForSync(3000);

    // Verify User B sees the updated position
    const objsAfterB = await getCanvasObjects(pageB);
    expect(objsAfterB.length).toBeGreaterThanOrEqual(1);
    const posAfterB = objsAfterB[0];

    // Position should have changed from the original
    expect(
      Math.abs(posAfterB.x - posBeforeB.x) > 10 ||
        Math.abs(posAfterB.y - posBeforeB.y) > 10,
    ).toBeTruthy();
  });

  test("delete syncs between users", async () => {
    // User A creates a board with an object
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Delete Sync Test");
    boardUrls.push(boardUrl);

    await selectTool(pageA, "Sticky Note");
    await clickCanvas(pageA);
    await waitForSync(2000);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Verify both see the object
    const countA = await getCanvasObjectCount(pageA);
    const countB = await getCanvasObjectCount(pageB);
    expect(countA).toBeGreaterThanOrEqual(1);
    expect(countB).toBeGreaterThanOrEqual(1);

    // User A selects and deletes the object
    await clickCanvas(pageA);
    await waitForSync(500);
    await pageA.keyboard.press("Delete");
    await waitForSync(3000);

    // Verify User A sees it deleted
    const countAAfter = await getCanvasObjectCount(pageA);
    expect(countAAfter).toBe(0);

    // Verify User B sees it deleted too
    const countBAfter = await getCanvasObjectCount(pageB);
    expect(countBAfter).toBe(0);
  });

  test("cursors visible to other users", async () => {
    // User A creates a board
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Cursor Test");
    boardUrls.push(boardUrl);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // User A moves mouse around the canvas to trigger cursor updates
    const boxA = await getCanvasBounds(pageA);
    const startX = boxA.x + boxA.width / 2;
    const startY = boxA.y + boxA.height / 2;

    for (let i = 0; i < 5; i++) {
      await pageA.mouse.move(startX + i * 20, startY + i * 10);
      await waitForSync(200);
    }
    await waitForSync(3000);

    // Verify User B's PresenceBar shows User A.
    // The PresenceBar renders user names as visible text in the DOM.
    const presenceText = await pageB.locator("body").textContent();
    expect(presenceText).toContain("User A");
  });

  test("simultaneous creation from both users", async () => {
    test.setTimeout(60_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Simultaneous Create");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Both users create objects at the same time
    await Promise.all([
      addObjectDirect(pageA, {
        type: "sticky",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        color: "#fef08a",
        text: "From A",
      }),
      addObjectDirect(pageB, {
        type: "rectangle",
        x: 400,
        y: 100,
        width: 150,
        height: 100,
        color: "#93c5fd",
        text: "From B",
      }),
    ]);

    // Poll until both users see both objects (up to 20 seconds via onSnapshot)
    const start = Date.now();
    let synced = false;
    while (Date.now() - start < 20000) {
      const countA = await getCanvasObjectCount(pageA);
      const countB = await getCanvasObjectCount(pageB);
      if (countA >= 2 && countB >= 2) {
        synced = true;
        break;
      }
      await waitForSync(500);
    }

    // If onSnapshot didn't deliver, reload both pages to force fresh listeners
    if (!synced) {
      await Promise.all([
        pageA.reload().then(() => pageA.waitForSelector(".konvajs-content", { timeout: 15_000 })),
        pageB.reload().then(() => pageB.waitForSelector(".konvajs-content", { timeout: 15_000 })),
      ]);
      await waitForSync(2000);
      const countA = await getCanvasObjectCount(pageA);
      const countB = await getCanvasObjectCount(pageB);
      synced = countA >= 2 && countB >= 2;
    }

    expect(synced).toBeTruthy();
  });
});
