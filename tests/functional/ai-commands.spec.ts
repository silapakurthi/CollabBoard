import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signIn, loadStorageState } from "../helpers/auth";
import {
  createBoard,
  waitForSync,
  sendAICommand,
  getAllCanvasObjects,
  getCanvasObjectCount,
  addObjectDirect,
  getAIError,
  deleteBoard,
} from "../helpers/board";

/**
 * AI Board Agent — End-to-end tests for each command category.
 *
 * These tests send natural language commands to the AI agent via the UI,
 * wait for processing, and verify objects on the canvas.
 *
 * NOTE: These tests call the live boardAgent Cloud Function which invokes
 * the Anthropic API. They require:
 * - The Vite dev server running (handled by Playwright config)
 * - The boardAgent Cloud Function deployed and reachable
 * - A valid ANTHROPIC_API_KEY configured in functions/.env
 */

test.describe("AI Commands", () => {
  // Increase timeout for AI tests — LLM calls can take several seconds
  test.setTimeout(90_000);

  let context: BrowserContext;
  let page: Page;
  const boardUrls: string[] = [];

  // Share a single browser context across all AI tests to avoid
  // Firebase anonymous auth rate limiting. Each test creates its own
  // board, so they are data-independent despite sharing a context.
  // Serial mode is NOT used — a failure in one test won't skip the rest.
  test.beforeAll(async ({ browser }) => {
    const state = loadStorageState("ai-tester");
    context = state
      ? await browser.newContext({ storageState: state })
      : await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    // signIn is a no-op if auth was restored from storageState
    await signIn(page, "AI Tester");
  });

  test.afterAll(async () => {
    for (const url of boardUrls) {
      await deleteBoard(page, url).catch(() => {});
    }
    await context.close();
  });

  // ── Creation Commands ──────────────────────────────────────────────────

  test("AI can create a sticky note", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Sticky Test"));

    const countBefore = await getCanvasObjectCount(page);

    await sendAICommand(page, 'Add a yellow sticky note that says "User Research"');

    const objects = await getAllCanvasObjects(page);
    const stickies = objects.filter((o) => o.type === "sticky");

    expect(stickies.length).toBeGreaterThan(countBefore);

    // Verify at least one sticky has the expected text
    const match = stickies.find((s) => s.text?.includes("User Research"));
    expect(match).toBeTruthy();

    // No error should be displayed
    const err = await getAIError(page);
    expect(err).toBeNull();
  });

  test("AI can create a shape (rectangle)", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Shape Test"));

    await sendAICommand(page, "Create a blue rectangle");

    const objects = await getAllCanvasObjects(page);
    const rects = objects.filter((o) => o.type === "rectangle");

    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  test("AI can create a frame", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Frame Test"));

    await sendAICommand(page, 'Add a frame called "Sprint Planning"');

    const objects = await getAllCanvasObjects(page);
    const frames = objects.filter((o) => o.type === "frame");

    expect(frames.length).toBeGreaterThanOrEqual(1);

    const match = frames.find((f) => f.text?.includes("Sprint Planning"));
    expect(match).toBeTruthy();
  });

  test("AI can create a connector between two objects", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Connector Test"));

    // Pre-create two sticky notes for the AI to connect
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await addObjectDirect(page, {
      id: id1,
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "Start",
    });
    await addObjectDirect(page, {
      id: id2,
      type: "sticky",
      x: 400,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#bfdbfe",
      text: "End",
    });
    await waitForSync(1500);

    await sendAICommand(
      page,
      'Connect the "Start" sticky note to the "End" sticky note with a dashed connector',
    );

    const objects = await getAllCanvasObjects(page);
    const connectors = objects.filter((o) => o.type === "connector");

    expect(connectors.length).toBeGreaterThanOrEqual(1);
  });

  // ── Manipulation Commands ──────────────────────────────────────────────

  test("AI can change object color", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Color Test"));

    // Create a sticky note first
    const id = crypto.randomUUID();
    await addObjectDirect(page, {
      id,
      type: "sticky",
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "Change my color",
    });
    await waitForSync(1500);

    await sendAICommand(page, "Change the sticky note color to pink");

    const objects = await getAllCanvasObjects(page);
    const sticky = objects.find((o) => o.type === "sticky");

    expect(sticky).toBeTruthy();
    // The color should have changed from yellow (#fef08a)
    expect(sticky!.color).not.toBe("#fef08a");
  });

  test("AI can move an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Move Test"));

    // Create a sticky note at a known position
    const id = crypto.randomUUID();
    await addObjectDirect(page, {
      id,
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "Move me",
    });
    await waitForSync(1500);

    await sendAICommand(
      page,
      "Move the sticky note to position 500, 400",
    );

    const objects = await getAllCanvasObjects(page);
    const sticky = objects.find((o) => o.type === "sticky");

    expect(sticky).toBeTruthy();
    // Should have moved significantly from (100, 100)
    expect(
      Math.abs(sticky!.x - 100) > 50 || Math.abs(sticky!.y - 100) > 50,
    ).toBeTruthy();
  });

  test("AI can update text on an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI UpdateText Test"));

    const id = crypto.randomUUID();
    await addObjectDirect(page, {
      id,
      type: "sticky",
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "Old text",
    });
    await waitForSync(1500);

    await sendAICommand(page, 'Change the sticky note text to "New text"');

    const objects = await getAllCanvasObjects(page);
    const sticky = objects.find((o) => o.type === "sticky");

    expect(sticky).toBeTruthy();
    expect(sticky!.text).toContain("New text");
  });

  test("AI can resize an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Resize Test"));

    const id = crypto.randomUUID();
    await addObjectDirect(page, {
      id,
      type: "rectangle",
      x: 200,
      y: 200,
      width: 150,
      height: 100,
      rotation: 0,
      color: "#93c5fd",
    });
    await waitForSync(1500);

    await sendAICommand(page, "Resize the rectangle to 400 by 300 pixels");

    const objects = await getAllCanvasObjects(page);
    const rect = objects.find((o) => o.type === "rectangle");

    expect(rect).toBeTruthy();
    // Width and height should have changed from 150x100
    expect(
      Math.abs(rect!.width - 150) > 50 || Math.abs(rect!.height - 100) > 50,
    ).toBeTruthy();
  });

  test("AI can delete an object", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Delete Test"));

    const id = crypto.randomUUID();
    await addObjectDirect(page, {
      id,
      type: "sticky",
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "Delete me",
    });
    await waitForSync(1500);

    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBe(1);

    await sendAICommand(page, "Delete the sticky note");

    const countAfter = await getCanvasObjectCount(page);
    expect(countAfter).toBe(0);
  });

  // ── Connector Style Commands ───────────────────────────────────────────

  test("AI can change connector style from solid to dashed", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI ConnStyle Test"));

    // Create two stickies and a solid connector
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const connId = crypto.randomUUID();
    await addObjectDirect(page, {
      id: id1,
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "A",
    });
    await addObjectDirect(page, {
      id: id2,
      type: "sticky",
      x: 500,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#bfdbfe",
      text: "B",
    });
    await addObjectDirect(page, {
      id: connId,
      type: "connector",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      color: "#374151",
      connectedFrom: id1,
      connectedTo: id2,
      style: { lineStyle: "solid", arrowHead: true },
    });
    await waitForSync(1500);

    await sendAICommand(page, "Change the connector to a dashed line");

    const objects = await getAllCanvasObjects(page);
    const connector = objects.find((o) => o.type === "connector");

    expect(connector).toBeTruthy();
    expect(connector!.style?.lineStyle).toBe("dashed");
    // Connector should NOT have been deleted and recreated
    expect(connector!.id).toBe(connId);
  });

  test("AI can toggle connector arrow head off", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Arrow Test"));

    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const connId = crypto.randomUUID();
    await addObjectDirect(page, {
      id: id1,
      type: "sticky",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#fef08a",
      text: "X",
    });
    await addObjectDirect(page, {
      id: id2,
      type: "sticky",
      x: 500,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      color: "#bfdbfe",
      text: "Y",
    });
    await addObjectDirect(page, {
      id: connId,
      type: "connector",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      color: "#374151",
      connectedFrom: id1,
      connectedTo: id2,
      style: { lineStyle: "solid", arrowHead: true },
    });
    await waitForSync(1500);

    await sendAICommand(page, "Remove the arrow head from the connector");

    const objects = await getAllCanvasObjects(page);
    const connector = objects.find((o) => o.type === "connector");

    expect(connector).toBeTruthy();
    expect(connector!.style?.arrowHead).toBe(false);
  });

  // ── Layout Commands ────────────────────────────────────────────────────

  test("AI can arrange objects in a grid", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Grid Test"));

    // Create several sticky notes clustered at the same position
    for (let i = 0; i < 4; i++) {
      await addObjectDirect(page, {
        id: crypto.randomUUID(),
        type: "sticky",
        x: 100 + i * 10,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        color: "#fef08a",
        text: `Note ${i + 1}`,
      });
    }
    await waitForSync(1500);

    await sendAICommand(page, "Arrange these sticky notes in a 2x2 grid");

    const objects = await getAllCanvasObjects(page);
    const stickies = objects.filter((o) => o.type === "sticky");

    expect(stickies.length).toBe(4);

    // Verify objects are no longer all at roughly the same position
    const xs = new Set(stickies.map((s) => Math.round(s.x / 50)));
    const ys = new Set(stickies.map((s) => Math.round(s.y / 50)));
    // In a 2x2 grid there should be at least 2 distinct x and 2 distinct y positions
    expect(xs.size).toBeGreaterThanOrEqual(2);
    expect(ys.size).toBeGreaterThanOrEqual(2);
  });

  // ── Complex / Template Commands ────────────────────────────────────────

  test("AI can create a SWOT analysis template", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI SWOT Test"));

    await sendAICommand(page, "Create a SWOT analysis template");

    const objects = await getAllCanvasObjects(page);

    // Should have frames for the 4 quadrants
    const frames = objects.filter((o) => o.type === "frame");
    expect(frames.length).toBeGreaterThanOrEqual(4);

    // Check that SWOT labels are present (in frame titles or sticky notes)
    const allText = objects
      .map((o) => (o.text ?? "").toLowerCase())
      .join(" ");
    expect(allText).toContain("strength");
    expect(allText).toContain("weakness");
    expect(allText).toContain("opportunit");
    expect(allText).toContain("threat");
  });

  test("AI can create a retrospective board", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Retro Test"));

    await sendAICommand(
      page,
      "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns",
    );

    const objects = await getAllCanvasObjects(page);

    // Should have at least 3 frames (one per column)
    const frames = objects.filter((o) => o.type === "frame");
    expect(frames.length).toBeGreaterThanOrEqual(3);

    const allText = objects
      .map((o) => (o.text ?? "").toLowerCase())
      .join(" ");
    expect(allText).toContain("went well");
    expect(allText).toContain("didn");
    expect(allText).toContain("action");
  });

  // ── Multi-step / Compound Commands ─────────────────────────────────────

  test("AI can create multiple objects in one command", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Multi Test"));

    await sendAICommand(
      page,
      "Create 3 sticky notes: one that says Todo, one that says In Progress, and one that says Done",
    );

    const objects = await getAllCanvasObjects(page);
    const stickies = objects.filter((o) => o.type === "sticky");

    expect(stickies.length).toBeGreaterThanOrEqual(3);

    const allText = stickies.map((s) => (s.text ?? "").toLowerCase()).join(" ");
    expect(allText).toContain("todo");
    expect(allText).toContain("in progress");
    expect(allText).toContain("done");

    // Verify no overlaps — each sticky should have a distinct position
    const positions = stickies.map((s) => `${Math.round(s.x / 50)},${Math.round(s.y / 50)}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(stickies.length);
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  test("AI handles empty board gracefully", async () => {
    await page.goto("/");
    boardUrls.push(await createBoard(page, "AI Empty Board Test"));

    // Verify board is empty
    const countBefore = await getCanvasObjectCount(page);
    expect(countBefore).toBe(0);

    await sendAICommand(page, "Add a green sticky note that says Hello World");

    const objects = await getAllCanvasObjects(page);
    const stickies = objects.filter((o) => o.type === "sticky");

    expect(stickies.length).toBeGreaterThanOrEqual(1);
    const match = stickies.find((s) =>
      (s.text ?? "").toLowerCase().includes("hello world"),
    );
    expect(match).toBeTruthy();
  });
});
