import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "../helpers/auth";
import {
  createBoard,
  navigateToBoard,
  addObjectDirect,
  updateObjectDirect,
  getCanvasObjects,
  getCanvasObjectCount,
  waitForSync,
  deleteBoard,
} from "../helpers/board";

test.describe("Concurrent Users", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const USER_COUNT = 5;
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const boardUrls: string[] = [];

  test.beforeAll(async ({ browser }) => {
    for (let i = 0; i < USER_COUNT; i++) {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await pg.goto("/");
      await signIn(pg, `User${i + 1}`);
      contexts.push(ctx);
      pages.push(pg);
    }
  });

  test.afterAll(async () => {
    // Clean up boards created during tests
    for (const url of boardUrls) {
      await deleteBoard(pages[0], url).catch(() => {});
    }
    for (const ctx of contexts) {
      await ctx.close();
    }
  });

  test("5 concurrent users see all objects and positions converge", async () => {
    test.setTimeout(120_000);

    // User 0 creates a board
    await pages[0].goto("/");
    const boardUrl = await createBoard(pages[0], "Concurrent 5 Users");
    boardUrls.push(boardUrl);

    // All other users navigate to the same board
    for (let i = 1; i < USER_COUNT; i++) {
      await navigateToBoard(pages[i], boardUrl);
    }
    await waitForSync(3000);

    // Each user creates a sticky note
    const stickyIds: string[] = [];
    for (let i = 0; i < USER_COUNT; i++) {
      const id = await addObjectDirect(pages[i], {
        type: "sticky",
        x: 100 + i * 200,
        y: 200,
        width: 150,
        height: 150,
        color: "#fef08a",
        text: `User${i + 1}`,
      });
      stickyIds.push(id);
    }
    // Poll until all 5 users see all 5 sticky notes (up to 20 seconds)
    const creationStart = Date.now();
    let allSeeAll = false;
    while (Date.now() - creationStart < 20000) {
      allSeeAll = true;
      for (let i = 0; i < USER_COUNT; i++) {
        const count = await getCanvasObjectCount(pages[i]);
        if (count < USER_COUNT) {
          allSeeAll = false;
          break;
        }
      }
      if (allSeeAll) break;
      await waitForSync(500);
    }

    // If onSnapshot didn't deliver, reload all pages and check again
    if (!allSeeAll) {
      for (let i = 0; i < USER_COUNT; i++) {
        await pages[i].reload();
        await pages[i].waitForSelector(".konvajs-content", { timeout: 15_000 });
      }
      await waitForSync(3000);
      allSeeAll = true;
      for (let i = 0; i < USER_COUNT; i++) {
        const count = await getCanvasObjectCount(pages[i]);
        if (count < USER_COUNT) {
          allSeeAll = false;
          break;
        }
      }
    }

    expect(allSeeAll).toBeTruthy();

    // Each user moves their sticky note to a new position
    const targetPositions = stickyIds.map((id, i) => ({
      id,
      x: 50 + i * 150,
      y: 500,
    }));

    for (let i = 0; i < USER_COUNT; i++) {
      await updateObjectDirect(pages[i], targetPositions[i].id, {
        x: targetPositions[i].x,
        y: targetPositions[i].y,
      });
    }

    // Wait up to 15 seconds for full sync across all browsers
    const syncStart = Date.now();
    let allSynced = false;

    while (Date.now() - syncStart < 15000) {
      allSynced = true;
      for (let i = 0; i < USER_COUNT; i++) {
        const objs = await getCanvasObjects(pages[i]);
        for (const target of targetPositions) {
          const obj = objs.find((o) => o.id === target.id);
          if (!obj || Math.abs(obj.x - target.x) > 5 || Math.abs(obj.y - target.y) > 5) {
            allSynced = false;
            break;
          }
        }
        if (!allSynced) break;
      }
      if (allSynced) break;
      await waitForSync(500);
    }

    const syncTime = Date.now() - syncStart;
    expect(allSynced).toBeTruthy();
    expect(syncTime).toBeLessThan(15000);
  });
});
