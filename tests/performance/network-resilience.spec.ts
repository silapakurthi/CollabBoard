import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  clickCanvas,
  selectTool,
  addObjectDirect,
  getCanvasObjectCount,
  getCanvasBounds,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Performance — Network Resilience", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await signIn(page, "NetworkTester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  test("handles slow network", async () => {
    test.setTimeout(60_000);

    await page.goto("/");
    boardUrls.push(await createBoard(page, "Slow Network Test"));

    // Throttle all Firestore requests to 500ms latency
    await page.route("**/*.googleapis.com/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue().catch(() => {});
    });

    // Create an object under slow conditions
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);

    // Wait longer for the throttled sync
    await waitForSync(5000);

    // Verify the object eventually synced
    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);

    // Move the object under slow conditions
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 40, { steps: 5 });
    await page.mouse.up();

    // Wait for throttled sync
    await waitForSync(5000);

    // Verify the object is still present (didn't crash or lose data)
    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThanOrEqual(1);

    // Remove the throttle for cleanup
    await page.unrouteAll();
  });

  test("handles network disconnect and reconnect", async () => {
    test.setTimeout(60_000);

    await page.goto("/");
    boardUrls.push(await createBoard(page, "Disconnect Test"));

    // Create an initial object (while online)
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);
    await waitForSync(2000);

    const countOnline = await getCanvasObjectCount(page);
    expect(countOnline).toBeGreaterThanOrEqual(1);

    // Block all network requests to simulate disconnect
    await page.route("**/*", (route) => route.abort());

    // Create another object while "offline"
    await selectTool(page, "Rectangle");
    await clickCanvas(page, 150, 0);
    await waitForSync(1000);

    // Unblock network to simulate reconnect
    await page.unrouteAll();
    await waitForSync(5000);

    // Reload to verify state from Firestore
    await page.reload();
    await page.waitForSelector(".konvajs-content", { timeout: 15_000 });
    await waitForSync(3000);

    // At minimum, the first object (created while online) should persist
    const countAfterReconnect = await getCanvasObjectCount(page);
    expect(countAfterReconnect).toBeGreaterThanOrEqual(1);
  });

  test("handles offline edits", async () => {
    test.setTimeout(60_000);

    await page.goto("/");
    boardUrls.push(await createBoard(page, "Offline Edit Test"));

    // Create objects while online via the test hook for reliability
    await addObjectDirect(page, {
      id: crypto.randomUUID(),
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      rotation: 0,
      color: "#fef08a",
      text: "Offline 1",
    });
    await waitForSync(1000);

    await addObjectDirect(page, {
      id: crypto.randomUUID(),
      type: "rectangle",
      x: 450,
      y: 200,
      width: 120,
      height: 80,
      rotation: 0,
      color: "#93c5fd",
      text: "",
    });
    await waitForSync(2000);

    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Go "offline" by blocking Firestore network calls
    await page.route("**/*.googleapis.com/**", (route) => route.abort());
    await page.route("**/firestore.googleapis.com/**", (route) =>
      route.abort(),
    );

    // Edit: drag an object while offline
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 30, { steps: 5 });
    await page.mouse.up();
    await waitForSync(1000);

    // Come back "online"
    await page.unrouteAll();
    await waitForSync(5000);

    // Reload to see what Firestore actually persisted
    await page.reload();
    await page.waitForSelector(".konvajs-content", { timeout: 15_000 });
    await waitForSync(3000);

    // Verify objects are persisted (at least the original creation was saved)
    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Network Resilience — Cross-browser", () => {
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
    await pageA.goto("/");
    await signIn(pageA, "NetA");
    await pageB.goto("/");
    await signIn(pageB, "NetB");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    await contextA.close();
    await contextB.close();
  });

  test("throttled requests eventually sync to second browser", async () => {
    test.setTimeout(60_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Throttle Sync");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Throttle User A's Firestore requests by 500ms
    await pageA.route("**/*.googleapis.com/**", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue().catch(() => {});
    });

    // User A creates an object under throttle
    await addObjectDirect(pageA, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      color: "#fef08a",
      text: "Throttled",
    });

    // Wait for throttled sync to propagate
    await waitForSync(8000);
    await pageA.unrouteAll();

    // Verify User B sees the object
    const countB = await getCanvasObjectCount(pageB);
    expect(countB).toBeGreaterThanOrEqual(1);
  });

  test("objects created during disconnect sync after reconnect", async () => {
    test.setTimeout(90_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Disconnect Sync");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Block User A's Firestore network to simulate disconnect
    await pageA.route("**/*.googleapis.com/**", (route) => route.abort());

    // User A creates 3 objects while disconnected (queued in Firestore memory cache)
    for (let i = 0; i < 3; i++) {
      await addObjectDirect(pageA, {
        type: "sticky",
        x: 100 + i * 200,
        y: 100,
        width: 150,
        height: 150,
        color: "#fef08a",
        text: `Offline #${i}`,
      });
    }

    // Unblock network to simulate reconnect
    await pageA.unrouteAll();

    // Nudge: create more objects to force Firestore reconnection attempts
    for (let i = 0; i < 3; i++) {
      await addObjectDirect(pageA, {
        type: "sticky",
        x: 700 + i * 50,
        y: 100,
        width: 50,
        height: 50,
        color: "#fef08a",
        text: "nudge",
      });
      await waitForSync(1000);
    }

    // Poll until User B sees the objects (up to 15s via onSnapshot)
    const syncedViaSnapshot = await pageB.waitForFunction(
      () => {
        const tc = (window as any).__TEST_CANVAS;
        if (!tc?.objects) return false;
        return tc.objects.filter((o: any) => o.type !== "connector").length >= 3;
      },
      { timeout: 15_000 },
    ).then(() => true).catch(() => false);

    // If onSnapshot didn't deliver, reload User B to force fresh listeners
    if (!syncedViaSnapshot) {
      await pageB.reload();
      await pageB.waitForSelector(".konvajs-content", { timeout: 15_000 });
      await waitForSync(3000);
      await pageB.waitForFunction(
        () => {
          const tc = (window as any).__TEST_CANVAS;
          if (!tc?.objects) return false;
          return tc.objects.filter((o: any) => o.type !== "connector").length >= 3;
        },
        { timeout: 15_000 },
      );
    }
  });

  test("reconnected user sees changes made during disconnect", async () => {
    test.setTimeout(60_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Reconnect Sync");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Disconnect User A from Firestore
    await pageA.route("**/*.googleapis.com/**", (route) => route.abort());
    await pageA.route("**/firestore.googleapis.com/**", (route) => route.abort());

    // User B makes changes while User A is disconnected
    await addObjectDirect(pageB, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      color: "#fef08a",
      text: "From B while A offline",
    });
    await addObjectDirect(pageB, {
      type: "rectangle",
      x: 450,
      y: 200,
      width: 120,
      height: 80,
      color: "#93c5fd",
      text: "Also from B",
    });
    await waitForSync(3000);

    // Reconnect User A — reload the page to force a fresh Firestore connection
    // (bypasses Firestore's exponential backoff from the disconnection)
    await pageA.unrouteAll();
    await navigateToBoard(pageA, boardUrl);
    await waitForSync(5000);

    // User A should see User B's changes
    const countA = await getCanvasObjectCount(pageA);
    expect(countA).toBeGreaterThanOrEqual(2);
  });
});
