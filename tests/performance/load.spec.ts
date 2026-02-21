import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  addObjectDirect,
  updateObjectDirect,
  getCanvasObjectCount,
  getCanvasObjects,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Performance — Load", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await signIn(page, "LoadTester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  test("handles 500+ objects", async () => {
    test.setTimeout(120_000); // 2 minutes for this test

    await page.goto("/");
    boardUrls.push(await createBoard(page, "Load 500 Test"));

    // Programmatically create 500 objects via the __TEST_CANVAS.addObject hook.
    // Each batch uses a single page.evaluate that awaits all setDoc writes,
    // ensuring Firestore has persisted every object before we reload.
    const total = 500;
    const batchSize = 50;

    for (let batch = 0; batch < total / batchSize; batch++) {
      await page.evaluate(
        async ({ start, size }: { start: number; size: number }) => {
          const tc = (window as any).__TEST_CANVAS;
          if (!tc?.addObject) throw new Error("__TEST_CANVAS.addObject not available");
          const promises = [];
          for (let i = 0; i < size; i++) {
            const idx = start + i;
            const row = Math.floor(idx / 25);
            const col = idx % 25;
            promises.push(
              tc.addObject({
                id: crypto.randomUUID(),
                type: "sticky",
                x: 50 + col * 80,
                y: 50 + row * 80,
                width: 60,
                height: 60,
                rotation: 0,
                color: "#fef08a",
                text: `#${idx}`,
              }),
            );
          }
          await Promise.all(promises);
        },
        { start: batch * batchSize, size: batchSize },
      );
    }

    // Now measure render time: reload the page and time until all objects load
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector(".konvajs-content", { timeout: 30_000 });

    // Poll until all 500 objects load from Firestore via onSnapshot
    await page.waitForFunction(
      (target: number) => {
        const tc = (window as any).__TEST_CANVAS;
        if (!tc?.objects) return false;
        return tc.objects.filter((o: any) => o.type !== "connector").length >= target;
      },
      total,
      { timeout: 30_000 },
    );
    const renderTime = Date.now() - startTime;

    // Assert render time < 30 seconds (generous for 500 objects via Firestore)
    expect(renderTime).toBeLessThan(30_000);

    // Verify all objects loaded
    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(500);

    // Measure FPS: use page.evaluate to time a series of render frames
    const fps = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        const duration = 2000; // Measure over 2 seconds

        function countFrame() {
          frameCount++;
          if (performance.now() - start < duration) {
            requestAnimationFrame(countFrame);
          } else {
            const elapsed = performance.now() - start;
            resolve(Math.round((frameCount / elapsed) * 1000));
          }
        }
        requestAnimationFrame(countFrame);
      });
    });

    // FPS should be at least 10 (not completely frozen)
    expect(fps).toBeGreaterThanOrEqual(10);
  });

  test("handles rapid object creation", async () => {
    test.setTimeout(60_000);

    await page.goto("/");
    boardUrls.push(await createBoard(page, "Rapid Create Test"));

    // Create 50 objects in quick succession via the test hook (addObject).
    for (let i = 0; i < 50; i++) {
      const row = Math.floor(i / 10);
      const col = i % 10;

      await addObjectDirect(page, {
        id: crypto.randomUUID(),
        type: "sticky",
        x: 50 + col * 80,
        y: 50 + row * 80,
        width: 60,
        height: 60,
        rotation: 0,
        color: "#fef08a",
        text: `Rapid #${i}`,
      });
    }

    // Wait for all Firestore writes to sync
    await waitForSync(5000);

    // Verify all 50 objects appear
    const count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(50);
  });
});

test.describe("Performance — Rapid Sync", () => {
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
    await signIn(pageA, "RapidA");
    await pageB.goto("/");
    await signIn(pageB, "RapidB");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(pageA, url).catch(() => {});
    }
    await contextA.close();
    await contextB.close();
  });

  test("rapid creation syncs to second browser", async () => {
    test.setTimeout(60_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Rapid Sync Test");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // User A rapidly creates 20 sticky notes (~200ms apart)
    for (let i = 0; i < 20; i++) {
      await addObjectDirect(pageA, {
        type: "sticky",
        x: 50 + (i % 5) * 120,
        y: 50 + Math.floor(i / 5) * 120,
        width: 100,
        height: 100,
        color: "#fef08a",
        text: `Rapid #${i}`,
      });
      await waitForSync(200);
    }

    // All 20 should appear in User B within 5 seconds
    await waitForSync(5000);

    const countB = await getCanvasObjectCount(pageB);
    expect(countB).toBeGreaterThanOrEqual(20);
  });

  test("rapid movement syncs to second browser", async () => {
    test.setTimeout(60_000);

    await pageA.goto("/");
    const boardUrl = await createBoard(pageA, "Rapid Move Sync");
    boardUrls.push(boardUrl);
    await navigateToBoard(pageB, boardUrl);
    await waitForSync(2000);

    // Create 10 stickies
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = await addObjectDirect(pageA, {
        type: "sticky",
        x: 50 + i * 100,
        y: 50,
        width: 80,
        height: 80,
        color: "#fef08a",
        text: `Move #${i}`,
      });
      ids.push(id);
    }
    await waitForSync(3000);

    // Rapidly move all 10 to new positions
    const targetPositions = ids.map((id, i) => ({
      id,
      x: 100 + i * 60,
      y: 400 + (i % 2) * 80,
    }));

    for (const { id, x, y } of targetPositions) {
      await updateObjectDirect(pageA, id, { x, y });
    }
    await waitForSync(5000);

    // Verify User B sees all final positions
    const objsB = await getCanvasObjects(pageB);
    for (const { id, x, y } of targetPositions) {
      const obj = objsB.find((o) => o.id === id);
      expect(obj).toBeDefined();
      expect(Math.abs(obj!.x - x)).toBeLessThan(5);
      expect(Math.abs(obj!.y - y)).toBeLessThan(5);
    }
  });
});
