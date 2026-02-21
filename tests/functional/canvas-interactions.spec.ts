import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  clickCanvas,
  selectTool,
  addObjectDirect,
  getCanvasObjectCount,
  getCanvasObjects,
  getCanvasBounds,
  waitForSync,
  getAllCanvasObjects,
  deleteBoard,
} from "../helpers/board";

/**
 * Canvas interaction tests — pan, zoom, selection, keyboard shortcuts,
 * line/text creation, connector behavior, and board renaming.
 *
 * Covers PRD requirements:
 *  FR-1.1 (infinite canvas), FR-1.2 (pan), FR-1.3 (zoom),
 *  FR-12.1–12.4 (selection), FR-13.1–13.4 (delete/duplicate/copy/paste),
 *  FR-10.4 (lines), FR-10.6 (standalone text), FR-10.5 (connectors),
 *  FR-14.2 (board renaming), FR-8.1 (auth gate)
 */
test.describe("Canvas Interactions", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await signIn(page, "CanvasTester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  // ── FR-1.1/1.2: Infinite canvas — viewport position shifts on zoom ──

  test("viewport position changes when zooming from off-center", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Pan Test"));

    // Get initial stage position (should be 0,0)
    const before = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.viewport ?? { stagePos: { x: 0, y: 0 }, stageScale: 1 };
    });
    expect(before.stagePos.x).toBe(0);
    expect(before.stagePos.y).toBe(0);

    // Zoom in from an off-center position — this shifts the viewport origin
    const box = await getCanvasBounds(page);
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.wheel(0, -500);
    await waitForSync(500);

    const after = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.viewport ?? { stagePos: { x: 0, y: 0 }, stageScale: 1 };
    });

    // stagePos should have shifted (zoom toward cursor repositions the viewport)
    expect(
      Math.abs(after.stagePos.x - before.stagePos.x) > 1 ||
        Math.abs(after.stagePos.y - before.stagePos.y) > 1,
    ).toBeTruthy();
    // Scale also increased
    expect(after.stageScale).toBeGreaterThan(before.stageScale);
  });

  // ── FR-1.3: Zoom ────────────────────────────────────────────────────

  test("can zoom the canvas with mouse wheel", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Zoom Test"));

    // Get initial scale
    const scaleBefore = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.viewport?.stageScale ?? 1;
    });

    // Scroll down (zoom out) on the canvas
    const box = await getCanvasBounds(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    // Negative deltaY = zoom in
    await page.mouse.wheel(0, -300);
    await waitForSync(500);

    const scaleAfter = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.viewport?.stageScale ?? 1;
    });

    // Scale should have increased (zoomed in)
    expect(scaleAfter).toBeGreaterThan(scaleBefore);
  });

  // ── FR-10.4: Line creation ──────────────────────────────────────────

  test("can create a line", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Line Test"));

    await selectTool(page, "Line");
    await clickCanvas(page);
    await waitForSync(1500);

    const objects = await getAllCanvasObjects(page);
    const line = objects.find((o) => o.type === "line");
    expect(line).toBeTruthy();
  });

  // ── FR-10.6: Standalone text ────────────────────────────────────────

  test("can create a standalone text element", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Text Test"));

    await selectTool(page, "Text");
    await clickCanvas(page);
    await waitForSync(1500);

    const objects = await getAllCanvasObjects(page);
    const textObj = objects.find((o) => o.type === "text");
    expect(textObj).toBeTruthy();
  });

  // ── FR-12.1: Single select / deselect ───────────────────────────────

  test("can select and deselect an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Select Test"));

    await addObjectDirect(page, {
      type: "sticky",
      x: 300,
      y: 300,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Select me",
    });
    await waitForSync(1000);

    // Click on the object to select it
    const box = await getCanvasBounds(page);
    const scale = await page.evaluate(
      () => (window as any).__TEST_CANVAS?.viewport?.stageScale ?? 1,
    );
    const stagePos = await page.evaluate(
      () =>
        (window as any).__TEST_CANVAS?.viewport?.stagePos ?? { x: 0, y: 0 },
    );

    // Convert object coords (300, 300) to screen coords
    const screenX = box.x + (300 + 100) * scale + stagePos.x;
    const screenY = box.y + (300 + 100) * scale + stagePos.y;

    await page.mouse.click(screenX, screenY);
    await waitForSync(500);

    // Check selection count
    const selectedCount = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(selectedCount).toBe(1);

    // Click on empty space to deselect
    await page.mouse.click(box.x + 10, box.y + 10);
    await waitForSync(500);

    const deselectedCount = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(deselectedCount).toBe(0);
  });

  // ── FR-12.2: Shift-click multi-select ───────────────────────────────

  test("shift-click adds to selection", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "ShiftSelect Test"));

    // Add two stickies at known positions
    await addObjectDirect(page, {
      type: "sticky",
      x: 100,
      y: 200,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "First",
    });
    await addObjectDirect(page, {
      type: "sticky",
      x: 500,
      y: 200,
      width: 200,
      height: 200,
      color: "#93c5fd",
      text: "Second",
    });
    await waitForSync(1000);

    const box = await getCanvasBounds(page);
    const scale = await page.evaluate(
      () => (window as any).__TEST_CANVAS?.viewport?.stageScale ?? 1,
    );
    const stagePos = await page.evaluate(
      () =>
        (window as any).__TEST_CANVAS?.viewport?.stagePos ?? { x: 0, y: 0 },
    );

    // Click on first object (center: 200, 300)
    const screenX1 = box.x + (100 + 100) * scale + stagePos.x;
    const screenY1 = box.y + (200 + 100) * scale + stagePos.y;
    await page.mouse.click(screenX1, screenY1);
    await waitForSync(300);

    const count1 = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(count1).toBe(1);

    // Shift-click on second object (center: 600, 300)
    const screenX2 = box.x + (500 + 100) * scale + stagePos.x;
    const screenY2 = box.y + (200 + 100) * scale + stagePos.y;
    await page.keyboard.down("Shift");
    await page.mouse.click(screenX2, screenY2);
    await page.keyboard.up("Shift");
    await waitForSync(300);

    const count2 = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(count2).toBe(2);
  });

  // ── FR-12.3: Marquee (rubber-band) selection ──────────────────────────

  test("marquee drag selects enclosed objects", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Marquee Test"));

    // Add two objects close together
    await addObjectDirect(page, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      color: "#fef08a",
      text: "M1",
    });
    await addObjectDirect(page, {
      type: "rectangle",
      x: 400,
      y: 200,
      width: 150,
      height: 150,
      color: "#93c5fd",
    });
    await waitForSync(1000);

    const box = await getCanvasBounds(page);
    const scale = await page.evaluate(
      () => (window as any).__TEST_CANVAS?.viewport?.stageScale ?? 1,
    );
    const stagePos = await page.evaluate(
      () =>
        (window as any).__TEST_CANVAS?.viewport?.stagePos ?? { x: 0, y: 0 },
    );

    // Drag a marquee rectangle that encloses both objects
    // Objects span from (200,200) to (550,350) in world coords
    // Start marquee above-left at (150, 150) and end below-right at (600, 400)
    const startX = box.x + 150 * scale + stagePos.x;
    const startY = box.y + 150 * scale + stagePos.y;
    const endX = box.x + 600 * scale + stagePos.x;
    const endY = box.y + 400 * scale + stagePos.y;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move in steps so the marquee threshold (3px) is met
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await waitForSync(500);

    const selectedCount = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(selectedCount).toBe(2);
  });

  // ── FR-12.4: Select all (Ctrl+A) ───────────────────────────────────

  test("Ctrl+A selects all objects", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "SelectAll Test"));

    // Add 3 objects
    await addObjectDirect(page, {
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "A",
    });
    await addObjectDirect(page, {
      type: "rectangle",
      x: 400,
      y: 100,
      width: 150,
      height: 100,
      color: "#93c5fd",
    });
    await addObjectDirect(page, {
      type: "circle",
      x: 700,
      y: 200,
      width: 100,
      height: 100,
      color: "#86efac",
      radius: 50,
    });
    await waitForSync(1000);

    const isMac = process.platform === "darwin";
    const mod = isMac ? "Meta" : "Control";

    // Press Ctrl+A
    await page.keyboard.press(`${mod}+a`);
    await waitForSync(500);

    const selectedCount = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(selectedCount).toBe(3);
  });

  // ── FR-13.2: Duplicate (Ctrl+D) ────────────────────────────────────

  test("Ctrl+D duplicates selected objects", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Duplicate Test"));

    await addObjectDirect(page, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Original",
    });
    await waitForSync(1000);

    // Click on the canvas to ensure it has focus
    const box = await getCanvasBounds(page);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForSync(300);

    // Select all with Ctrl+A
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+a`);
    await waitForSync(500);

    // Verify selection happened
    const selCount = await page.evaluate(() => {
      const tc = (window as any).__TEST_CANVAS;
      return tc?.selectedIds?.size ?? 0;
    });
    expect(selCount).toBeGreaterThanOrEqual(1);

    const countBefore = await getCanvasObjectCount(page);

    // Duplicate with Ctrl+D
    await page.keyboard.press(`${mod}+d`);
    await waitForSync(2000);

    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // ── FR-13.3/13.4: Copy/Paste (Ctrl+C / Ctrl+V) ─────────────────────

  test("Ctrl+C and Ctrl+V copies and pastes objects", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "CopyPaste Test"));

    await addObjectDirect(page, {
      type: "sticky",
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      color: "#93c5fd",
      text: "Copy me",
    });
    await waitForSync(1000);

    // Click on the canvas to ensure it has focus
    const box = await getCanvasBounds(page);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForSync(300);

    const mod = process.platform === "darwin" ? "Meta" : "Control";

    // Select all
    await page.keyboard.press(`${mod}+a`);
    await waitForSync(500);

    const countBefore = await getCanvasObjectCount(page);

    // Copy then paste
    await page.keyboard.press(`${mod}+c`);
    await waitForSync(500);
    await page.keyboard.press(`${mod}+v`);
    await waitForSync(2000);

    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // ── FR-13.1: Delete cascades to connectors ──────────────────────────

  test("deleting an object also deletes its connectors", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Delete Cascade Test"));

    // Create two stickies and a connector between them
    const idA = await addObjectDirect(page, {
      type: "sticky",
      x: 100,
      y: 200,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Source",
    });
    const idB = await addObjectDirect(page, {
      type: "sticky",
      x: 500,
      y: 200,
      width: 200,
      height: 200,
      color: "#93c5fd",
      text: "Target",
    });
    await addObjectDirect(page, {
      type: "connector",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      color: "#374151",
      connectedFrom: idA,
      connectedTo: idB,
      style: { lineStyle: "solid", arrowHead: true },
    });
    await waitForSync(1000);

    // Verify connector exists
    const allBefore = await getAllCanvasObjects(page);
    const connBefore = allBefore.filter((o) => o.type === "connector");
    expect(connBefore.length).toBe(1);

    // Select object A and delete it
    // Use Ctrl+A then filter — easier to select via keyboard after clicking the object
    // Instead, click on object A's position
    const box = await getCanvasBounds(page);
    const scale = await page.evaluate(
      () => (window as any).__TEST_CANVAS?.viewport?.stageScale ?? 1,
    );
    const stagePos = await page.evaluate(
      () =>
        (window as any).__TEST_CANVAS?.viewport?.stagePos ?? { x: 0, y: 0 },
    );

    const screenX = box.x + (100 + 100) * scale + stagePos.x;
    const screenY = box.y + (200 + 100) * scale + stagePos.y;
    await page.mouse.click(screenX, screenY);
    await waitForSync(300);

    // Delete the selected object
    await page.keyboard.press("Delete");
    await waitForSync(1500);

    // Verify connector is also gone
    const allAfter = await getAllCanvasObjects(page);
    const connAfter = allAfter.filter((o) => o.type === "connector");
    expect(connAfter.length).toBe(0);
  });

  // ── FR-10.5: Connector follows when object is moved ─────────────────

  test("connector updates when a connected object is moved", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "ConnectorFollow Test"));

    // Create two stickies and a connector
    const idA = await addObjectDirect(page, {
      type: "sticky",
      x: 100,
      y: 200,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Anchor",
    });
    const idB = await addObjectDirect(page, {
      type: "sticky",
      x: 500,
      y: 200,
      width: 200,
      height: 200,
      color: "#93c5fd",
      text: "Mover",
    });
    await addObjectDirect(page, {
      type: "connector",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      color: "#374151",
      connectedFrom: idA,
      connectedTo: idB,
      style: { lineStyle: "solid", arrowHead: true },
    });
    await waitForSync(1000);

    // Verify connector exists before the move
    const objsBefore = await getAllCanvasObjects(page);
    const connBefore = objsBefore.filter((o) => o.type === "connector");
    expect(connBefore.length).toBe(1);

    // Move object B by updating its position directly
    await page.evaluate((targetId) => {
      const tc = (window as any).__TEST_CANVAS;
      if (tc?.updateObject) {
        tc.updateObject(targetId, { x: 700, y: 400 });
      }
    }, idB);
    await waitForSync(1500);

    // Verify connector still exists after the move
    const objsAfter = await getAllCanvasObjects(page);
    const connAfter = objsAfter.filter((o) => o.type === "connector");
    expect(connAfter.length).toBe(1);

    // Verify object B actually moved
    const movedObj = objsAfter.find((o) => o.id === idB);
    expect(movedObj).toBeTruthy();
    expect(movedObj!.x).toBe(700);
    expect(movedObj!.y).toBe(400);
  });

  // ── FR-14.2: Board renaming ─────────────────────────────────────────

  test("can rename a board inline", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "Rename Me"));

    // Click the board name to enter edit mode
    const nameButton = page.locator("button").filter({ hasText: "Rename Me" });
    await expect(nameButton).toBeVisible({ timeout: 5_000 });
    await nameButton.click();

    // Wait for the input to appear
    const nameInput = page.locator('input[maxlength="80"]');
    await expect(nameInput).toBeVisible({ timeout: 3_000 });

    // Clear and type new name
    await nameInput.fill("Renamed Board");
    await nameInput.blur();
    await waitForSync(1500);

    // Verify the new name is displayed
    const renamed = page.locator("button").filter({ hasText: "Renamed Board" });
    await expect(renamed).toBeVisible({ timeout: 5_000 });
  });
});

// ── FR-8.1: Auth gate ───────────────────────────────────────────────

test.describe("Auth Gate", () => {
  test.setTimeout(30_000);

  test("unauthenticated user sees login page", async ({ browser }) => {
    // Fresh context with no auth state
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Try to access the app
    await page.goto("/");

    // Should see the login page, not the board list
    const loginInput = page.locator('input[placeholder="Enter your name..."]');
    const guestButton = page.locator("text=Continue as Guest");

    // At least one login element should be visible
    await expect(
      loginInput.or(guestButton).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should NOT see the "Create New Board" button
    const createBoardBtn = page.locator("text=+ Create New Board");
    await expect(createBoardBtn).not.toBeVisible({ timeout: 2_000 });

    await ctx.close();
  });
});
