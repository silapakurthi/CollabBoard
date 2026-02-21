import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  clickCanvas,
  selectTool,
  selectColor,
  getCanvasObjectCount,
  getCanvasObjects,
  getCanvasBounds,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Board Objects", () => {
  // Share a single browser context (and auth session) across all tests
  // to avoid hitting Firebase's anonymous auth rate limit.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await signIn(page, "ObjectTester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  test("can create a sticky note", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Sticky Test"));

    // Select the sticky tool
    await selectTool(page, "Sticky Note");

    // Click on the canvas to create a sticky note
    await clickCanvas(page);

    // Wait for Firestore sync
    await waitForSync(1500);

    // Verify the tool switched back to "select" (side-effect of creation)
    const selectBtn = page.locator('button[title="Select"]');
    await expect(selectBtn).toHaveClass(/bg-blue-100/);

    // Verify the object was created on the canvas
    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("can create a rectangle", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Rect Test"));

    await selectTool(page, "Rectangle");
    await clickCanvas(page);
    await waitForSync(1500);

    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("can create a circle", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Circle Test"));

    await selectTool(page, "Circle");
    await clickCanvas(page);
    await waitForSync(1500);

    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("can edit sticky note text", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Edit Sticky Test"));

    // Create a sticky note
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);
    await waitForSync(1500);

    // Double-click on the sticky to start editing.
    // The sticky's top-left is placed at the click position (canvas center),
    // with size 200x200. Double-click the center of the sticky.
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.dblclick(cx + 100, cy + 100);

    // Wait for the textarea overlay to appear
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Type text and blur to save
    await textarea.fill("Hello Playwright");
    await textarea.blur();
    await waitForSync(1500);

    // Verify the textarea is closed after blur
    await expect(textarea).not.toBeVisible({ timeout: 3000 });
  });

  test("can drag an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Drag Test"));

    // Create a sticky note
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);
    await waitForSync(1500);

    // Get initial position of the object via __TEST_CANVAS
    const objectsBefore = await getCanvasObjects(page);
    expect(objectsBefore.length).toBeGreaterThanOrEqual(1);
    const startX = objectsBefore[0].x;
    const startY = objectsBefore[0].y;

    // Drag the object: click on it, then drag 100px right and 50px down
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 50, { steps: 10 });
    await page.mouse.up();
    await waitForSync(1500);

    // Verify position changed
    const objectsAfter = await getCanvasObjects(page);
    expect(objectsAfter.length).toBeGreaterThanOrEqual(1);
    const movedObj = objectsAfter[0];
    expect(
      Math.abs(movedObj.x - startX) > 10 ||
        Math.abs(movedObj.y - startY) > 10,
    ).toBeTruthy();
  });

  test("can delete an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Delete Test"));

    // Create a sticky note
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);
    await waitForSync(1500);

    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Click the object to select it
    await clickCanvas(page);
    await waitForSync(500);

    // Press Delete key
    await page.keyboard.press("Delete");
    await waitForSync(1500);

    // Verify the object is gone
    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("can change object color", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Color Test"));

    // Select pink color before creating
    await selectColor(page, "Pink");

    // Create a sticky note with the pink color
    await selectTool(page, "Sticky Note");
    await clickCanvas(page);
    await waitForSync(1500);

    // Verify the color button is active (has the blue border class)
    const pinkBtn = page.locator('button[aria-label="Pink"]');
    await expect(pinkBtn).toHaveClass(/border-blue-500/);

    // Verify object was created (basic check)
    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify the object has the pink color via the test hook
    const objectColor = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      if (!tc?.objects?.length) return null;
      const sticky = tc.objects.find((o: any) => o.type === "sticky");
      return sticky?.color ?? null;
    });

    expect(objectColor).toBe("#fbcfe8");
  });
});
