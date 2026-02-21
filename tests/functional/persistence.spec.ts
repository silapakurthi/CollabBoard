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

test.describe("Persistence", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await signIn(page, "PersistTester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  test("board state persists after refresh", async () => {
    await page.goto("/");
    const boardUrl = await createBoard(page, "Persist Refresh Test");
    boardUrls.push(boardUrl);

    // Create objects via test hook for reliability
    await addObjectDirect(page, {
      id: crypto.randomUUID(),
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      rotation: 0,
      color: "#fef08a",
      text: "Persist 1",
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

    // Verify objects exist before refresh
    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Refresh the page
    await page.reload();

    // Wait for the canvas to reload
    // Firebase anonymous auth persists via IndexedDB by default
    await page.waitForSelector(".konvajs-content", { timeout: 15_000 });
    await waitForSync(3000);

    // Verify objects still exist after refresh
    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThanOrEqual(2);
  });

  test("board state persists after closing and reopening", async () => {
    await page.goto("/");
    const boardUrl = await createBoard(page, "Persist Close Test");
    boardUrls.push(boardUrl);

    // Create objects via test hook
    await addObjectDirect(page, {
      id: crypto.randomUUID(),
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      rotation: 0,
      color: "#fef08a",
      text: "Close 1",
    });
    await waitForSync(1000);

    await addObjectDirect(page, {
      id: crypto.randomUUID(),
      type: "circle",
      x: 400,
      y: 300,
      radius: 50,
      rotation: 0,
      color: "#86efac",
      text: "",
    });
    await waitForSync(2000);

    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Close the page
    await page.close();

    // Open a new page in the same context (session persists)
    page = await context.newPage();
    await navigateToBoard(page, boardUrl);
    await waitForSync(3000);

    // Verify objects still present
    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThanOrEqual(2);
  });

  test("state persists when refreshing mid-drag", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Mid-Drag Refresh"));

    await addObjectDirect(page, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      color: "#fef08a",
      text: "Drag me",
    });
    await waitForSync(2000);

    // Record pre-drag object state
    const objsBefore = await getCanvasObjects(page);
    expect(objsBefore.length).toBeGreaterThanOrEqual(1);
    const beforeX = objsBefore[0].x;
    const beforeY = objsBefore[0].y;

    // Start a drag but do NOT release the mouse (dragEnd never fires)
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy + 200, { steps: 5 });
    // No mouseup — refresh while drag is in progress

    await page.reload();
    await page.waitForSelector(".konvajs-content", { timeout: 15_000 });
    await waitForSync(3000);

    // Original position should be preserved (drag was never committed via dragEnd)
    const objsAfter = await getCanvasObjects(page);
    expect(objsAfter.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(objsAfter[0].x - beforeX)).toBeLessThan(50);
    expect(Math.abs(objsAfter[0].y - beforeY)).toBeLessThan(50);
  });
});
