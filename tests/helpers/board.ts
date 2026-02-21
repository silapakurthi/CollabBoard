import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Extract the board ID from a board URL (e.g. http://localhost:5173/board/abc-123 → abc-123).
 */
export function boardIdFromUrl(boardUrl: string): string {
  const match = boardUrl.match(/\/board\/([^/?#]+)/);
  if (!match) throw new Error(`Could not extract board ID from URL: ${boardUrl}`);
  return match[1];
}

/**
 * Delete a board and its subcollections (objects, presence) via Firestore client SDK
 * running inside the browser. The page must be on the app origin (any route).
 */
export async function deleteBoard(page: Page, boardUrl: string) {
  const boardId = boardIdFromUrl(boardUrl);
  await page.evaluate(async (id: string) => {
    const { getFirestore, collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");
    const db = getFirestore();
    // Delete subcollections first
    for (const sub of ["objects", "presence"]) {
      const snap = await getDocs(collection(db, `boards/${id}/${sub}`));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    // Delete the board document
    await deleteDoc(doc(db, "boards", id));
  }, boardId);
}

/**
 * Create a new board from the board list page and return the board URL.
 * Assumes the user is already signed in and on the board list page.
 */
export async function createBoard(page: Page, name?: string): Promise<string> {
  // Wait for the board list page to be ready (Firebase auth may still be restoring after page.goto)
  await page.waitForSelector("text=+ Create New Board", { timeout: 30_000 });

  // Click "+ Create New Board"
  await page.click("text=+ Create New Board");

  // Fill board name if provided, otherwise just hit Create (defaults to "Untitled Board")
  if (name) {
    await page.fill('input[placeholder="Board name..."]', name);
  }
  await page.click('button:has-text("Create"):not(:has-text("New"))');

  // Wait for the board view to load (canvas appears)
  await page.waitForSelector(".konvajs-content", { timeout: 30_000 });

  return page.url();
}

/**
 * Navigate directly to a board URL and wait for the canvas to be ready.
 */
export async function navigateToBoard(page: Page, boardUrl: string) {
  await page.goto(boardUrl);
  await page.waitForSelector(".konvajs-content", { timeout: 30_000 });
}

/**
 * Simple wait helper for sync assertions.
 * Waits for Firestore sync propagation.
 */
export async function waitForSync(ms = 2000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the bounding box of the Konva canvas element.
 */
export async function getCanvasBounds(page: Page) {
  const canvas = page.locator(".konvajs-content canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  return box;
}

/**
 * Click on the canvas at a position relative to its center.
 * offsetX/offsetY are offsets from the center of the canvas.
 */
export async function clickCanvas(
  page: Page,
  offsetX = 0,
  offsetY = 0,
) {
  const box = await getCanvasBounds(page);
  const x = box.x + box.width / 2 + offsetX;
  const y = box.y + box.height / 2 + offsetY;
  await page.mouse.click(x, y);
}

/**
 * Select a tool from the toolbar by its title attribute.
 */
export async function selectTool(
  page: Page,
  tool:
    | "Select"
    | "Sticky Note"
    | "Rectangle"
    | "Circle"
    | "Line"
    | "Text"
    | "Connector (click source then target)"
    | "Frame (click and drag)",
) {
  await page.click(`button[title="${tool}"]`);
}

/**
 * Select a color from the toolbar by its name.
 */
export async function selectColor(
  page: Page,
  color:
    | "Yellow"
    | "Pink"
    | "Blue"
    | "Green"
    | "White"
    | "Red"
    | "Navy"
    | "Emerald"
    | "Purple"
    | "Charcoal",
) {
  await page.click(`button[aria-label="${color}"]`);
}

/**
 * Get the count of board objects via the test hook exposed by Canvas.tsx.
 * The Canvas component sets window.__TEST_CANVAS.objects = the React objects array.
 */
export async function getCanvasObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tc = (window as any).__TEST_CANVAS;
    if (!tc?.objects) return 0;
    // Exclude connectors from the visible object count (they aren't standalone shapes)
    return tc.objects.filter((o: any) => o.type !== "connector").length;
  });
}

/**
 * Get the full objects array from the test hook (includes all types).
 */
export async function getCanvasObjectCountAll(page: Page): Promise<number> {
  return page.evaluate(() => {
    return (window as any).__TEST_CANVAS?.objects?.length ?? 0;
  });
}

/**
 * Get positions of all non-connector objects on the canvas.
 */
export async function getCanvasObjects(
  page: Page,
): Promise<Array<{ id: string; type: string; x: number; y: number }>> {
  return page.evaluate(() => {
    const tc = (window as any).__TEST_CANVAS;
    if (!tc?.objects) return [];
    return tc.objects
      .filter((o: any) => o.type !== "connector")
      .map((o: any) => ({ id: o.id, type: o.type, x: o.x, y: o.y }));
  });
}

/**
 * Add an object programmatically via the exposed addObject function.
 * Used by performance tests to bulk-create objects without UI interaction.
 * Auto-generates an id if not provided and returns it.
 *
 * The Firestore write is awaited with a 5s timeout — if the network is blocked
 * (e.g. during disconnect tests), the write still queues locally in Firestore
 * but we don't hang waiting for server confirmation.
 */
export async function addObjectDirect(
  page: Page,
  obj: Record<string, any>,
): Promise<string> {
  return page.evaluate(async (o) => {
    const tc = (window as any).__TEST_CANVAS;
    if (!tc?.addObject) throw new Error("__TEST_CANVAS.addObject not available");
    if (!o.id) o.id = crypto.randomUUID();
    if (o.rotation === undefined) o.rotation = 0;
    await Promise.race([
      tc.addObject(o),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    return o.id as string;
  }, obj);
}

/**
 * Update an object programmatically via the exposed updateObject function.
 * Used by conflict resolution tests to simulate concurrent writes.
 */
export async function updateObjectDirect(
  page: Page,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  await page.evaluate(({ id, updates }) => {
    const tc = (window as any).__TEST_CANVAS;
    if (!tc?.updateObject) throw new Error("__TEST_CANVAS.updateObject not available");
    return Promise.race([
      tc.updateObject(id, updates),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }, { id, updates });
}

// ── AI Command Helpers ─────────────────────────────────────────────────────

/**
 * Send an AI command via the AI input bar and wait for it to complete.
 *
 * Retries up to 3 total attempts when:
 *  - The error banner appears (transient API failure)
 *  - The LLM responded but didn't change any objects (no tool calls)
 *
 * After the final attempt, waits briefly for Firestore sync.
 */
/**
 * Serialize objects for comparison, excluding volatile metadata fields
 * (updatedAt, lastEditedBy, zIndex) that may cause false negatives.
 */
function stableSerialize(objects: any[]): string {
  return JSON.stringify(
    objects.map((o: any) => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      text: o.text,
      color: o.color,
      rotation: o.rotation,
      radius: o.radius,
      connectedFrom: o.connectedFrom,
      connectedTo: o.connectedTo,
      style: o.style,
    })),
  );
}

export async function sendAICommand(page: Page, command: string) {
  // Snapshot object state before sending so we can detect changes.
  const beforeSnapshot = await page.evaluate(() => {
    const tc = (window as any).__TEST_CANVAS;
    const objects = tc?.objects ?? [];
    return JSON.stringify(
      objects.map((o: any) => ({
        id: o.id, type: o.type, x: o.x, y: o.y,
        width: o.width, height: o.height,
        text: o.text, color: o.color, rotation: o.rotation,
        radius: o.radius, connectedFrom: o.connectedFrom,
        connectedTo: o.connectedTo, style: o.style,
      })),
    );
  });

  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const input = page.locator('input[placeholder="Ask AI to modify the board..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill(command);

    // Wait for Send button to be enabled before clicking
    const sendBtn = page.locator('button[type="submit"]:has-text("Send")');
    await expect(sendBtn).toBeEnabled({ timeout: 3_000 });
    await sendBtn.click();

    // Wait for the loading spinner to appear then disappear (AI processing complete)
    const spinner = page.locator(".animate-spin").first();
    await spinner.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
      // spinner may have already gone if the command was very fast
    });
    await spinner.waitFor({ state: "hidden", timeout: 60_000 });

    // Check if the error banner appeared — if so, retry
    const errorBanner = page.locator(".bg-red-50.border-red-200");
    if (await errorBanner.isVisible().catch(() => false)) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await waitForSync(2000);
        continue;
      }
      break;
    }

    // Wait briefly for onSnapshot to deliver the changes
    await waitForSync(2000);

    // Check if objects changed via onSnapshot
    const changed = await page.evaluate(
      (prev: string) => {
        const tc = (window as any).__TEST_CANVAS;
        const objects = tc?.objects ?? [];
        const current = JSON.stringify(
          objects.map((o: any) => ({
            id: o.id, type: o.type, x: o.x, y: o.y,
            width: o.width, height: o.height,
            text: o.text, color: o.color, rotation: o.rotation,
            radius: o.radius, connectedFrom: o.connectedFrom,
            connectedTo: o.connectedTo, style: o.style,
          })),
        );
        return current !== prev;
      },
      beforeSnapshot,
    );

    if (changed) {
      break;
    }

    // onSnapshot didn't deliver — force refresh by reloading the page.
    // This creates fresh Firestore listeners that fetch latest server data.
    await page.reload();
    await page.waitForSelector(".konvajs-content", { timeout: 15_000 });
    await waitForSync(1000);

    // Check again after reload
    const changedAfterReload = await page.evaluate(
      (prev: string) => {
        const tc = (window as any).__TEST_CANVAS;
        const objects = tc?.objects ?? [];
        const current = JSON.stringify(
          objects.map((o: any) => ({
            id: o.id, type: o.type, x: o.x, y: o.y,
            width: o.width, height: o.height,
            text: o.text, color: o.color, rotation: o.rotation,
            radius: o.radius, connectedFrom: o.connectedFrom,
            connectedTo: o.connectedTo, style: o.style,
          })),
        );
        return current !== prev;
      },
      beforeSnapshot,
    );

    if (changedAfterReload || attempt >= MAX_ATTEMPTS - 1) {
      break;
    }
    // LLM didn't make changes — retry
    await waitForSync(1000);
  }
}

/**
 * Get all objects on the canvas including full details (type, color, text, style, etc.).
 */
export async function getAllCanvasObjects(page: Page): Promise<
  Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    color?: string;
    connectedFrom?: string;
    connectedTo?: string;
    style?: { lineStyle?: string; arrowHead?: boolean };
  }>
> {
  return page.evaluate(() => {
    const tc = (window as any).__TEST_CANVAS;
    if (!tc?.objects) return [];
    return tc.objects.map((o: any) => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      text: o.text,
      color: o.color,
      connectedFrom: o.connectedFrom,
      connectedTo: o.connectedTo,
      style: o.style,
    }));
  });
}

/**
 * Check if the AI error banner is visible.
 */
export async function getAIError(page: Page): Promise<string | null> {
  const errorBanner = page.locator(".bg-red-50.border-red-200");
  if (await errorBanner.isVisible()) {
    return errorBanner.textContent();
  }
  return null;
}
