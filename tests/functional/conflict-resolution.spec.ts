import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  addObjectDirect,
  updateObjectDirect,
  getAllCanvasObjects,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Conflict Resolution", () => {
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

    await pageA.goto("/");
    await signIn(pageA, "Conflict A");

    await pageB.goto("/");
    await signIn(pageB, "Conflict B");
  });

  test.afterEach(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    boardUrls.length = 0;
    await contextA.close();
    await contextB.close();
  });

  test("simultaneous position updates converge to same value", async () => {
    // User A creates a board with a sticky note
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Position Conflict");
    boardUrls.push(boardUrl);

    await addObjectDirect(pageA, {
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Conflict test",
    });
    await waitForSync(3000);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Both users should see the sticky
    const objsA = await getAllCanvasObjects(pageA);
    const objsB = await getAllCanvasObjects(pageB);
    expect(objsA.length).toBeGreaterThanOrEqual(1);
    expect(objsB.length).toBeGreaterThanOrEqual(1);

    const stickyId = objsA.find((o) => o.type === "sticky")!.id;

    // Both users simultaneously update position
    await Promise.all([
      updateObjectDirect(pageA, stickyId, { x: 300, y: 300 }),
      updateObjectDirect(pageB, stickyId, { x: 500, y: 500 }),
    ]);

    // Poll until both users converge to the same position (up to 15s via onSnapshot)
    let stickyA: { id: string; x: number; y: number } | undefined;
    let stickyB: { id: string; x: number; y: number } | undefined;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const finalA = await getAllCanvasObjects(pageA);
      const finalB = await getAllCanvasObjects(pageB);
      stickyA = finalA.find((o) => o.id === stickyId);
      stickyB = finalB.find((o) => o.id === stickyId);
      if (stickyA && stickyB && stickyA.x === stickyB.x && stickyA.y === stickyB.y) {
        break;
      }
      await waitForSync(500);
    }

    // If onSnapshot didn't converge, reload both pages to force fresh Firestore reads
    if (!stickyA || !stickyB || stickyA.x !== stickyB.x || stickyA.y !== stickyB.y) {
      await Promise.all([
        pageA.reload().then(() => pageA.waitForSelector(".konvajs-content", { timeout: 15_000 })),
        pageB.reload().then(() => pageB.waitForSelector(".konvajs-content", { timeout: 15_000 })),
      ]);
      await waitForSync(2000);
      const finalA = await getAllCanvasObjects(pageA);
      const finalB = await getAllCanvasObjects(pageB);
      stickyA = finalA.find((o) => o.id === stickyId);
      stickyB = finalB.find((o) => o.id === stickyId);
    }

    // Both users should see the same final position (we don't care which wins)
    expect(stickyA).toBeDefined();
    expect(stickyB).toBeDefined();
    expect(stickyA!.x).toBe(stickyB!.x);
    expect(stickyA!.y).toBe(stickyB!.y);
  });

  test("simultaneous text updates converge to same value", async () => {
    // User A creates a board with a sticky note
    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Text Conflict");
    boardUrls.push(boardUrl);

    await addObjectDirect(pageA, {
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      color: "#fef08a",
      text: "Original text",
    });
    await waitForSync(3000);

    // User B navigates to the same board
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Both users should see the sticky
    const objsA = await getAllCanvasObjects(pageA);
    const objsB = await getAllCanvasObjects(pageB);
    expect(objsA.length).toBeGreaterThanOrEqual(1);
    expect(objsB.length).toBeGreaterThanOrEqual(1);

    const stickyId = objsA.find((o) => o.type === "sticky")!.id;

    // Both users simultaneously update text
    await Promise.all([
      updateObjectDirect(pageA, stickyId, { text: "Hello from A" }),
      updateObjectDirect(pageB, stickyId, { text: "Hello from B" }),
    ]);

    // Poll until both users converge to the same text (up to 15s via onSnapshot)
    let stickyA: { id: string; text?: string } | undefined;
    let stickyB: { id: string; text?: string } | undefined;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const finalA = await getAllCanvasObjects(pageA);
      const finalB = await getAllCanvasObjects(pageB);
      stickyA = finalA.find((o) => o.id === stickyId);
      stickyB = finalB.find((o) => o.id === stickyId);
      if (stickyA && stickyB && stickyA.text === stickyB.text) {
        break;
      }
      await waitForSync(500);
    }

    // If onSnapshot didn't converge, reload both pages to force fresh Firestore reads
    if (!stickyA || !stickyB || stickyA.text !== stickyB.text) {
      await Promise.all([
        pageA.reload().then(() => pageA.waitForSelector(".konvajs-content", { timeout: 15_000 })),
        pageB.reload().then(() => pageB.waitForSelector(".konvajs-content", { timeout: 15_000 })),
      ]);
      await waitForSync(2000);
      const finalA = await getAllCanvasObjects(pageA);
      const finalB = await getAllCanvasObjects(pageB);
      stickyA = finalA.find((o) => o.id === stickyId);
      stickyB = finalB.find((o) => o.id === stickyId);
    }

    // Both users should see the same final text (we don't care which wins)
    expect(stickyA).toBeDefined();
    expect(stickyB).toBeDefined();
    expect(stickyA!.text).toBe(stickyB!.text);
    // The winning text should be one of the two writes
    expect(["Hello from A", "Hello from B"]).toContain(stickyA!.text);
  });
});
