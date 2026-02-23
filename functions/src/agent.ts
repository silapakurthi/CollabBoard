import Anthropic from "@anthropic-ai/sdk";
import * as admin from "firebase-admin";
import { tracedLLMCall, flushTraces } from "./observability";
import { config } from "./config";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const SYSTEM_PROMPT = `You are an AI assistant that manipulates a collaborative whiteboard.
You have access to tools to create, modify, and arrange objects on the board.
When given a command, determine which tools to call and in what order.
Always call tools — never respond with just text. You MUST call at least one tool for every command.

EFFICIENCY — BATCH YOUR TOOL CALLS:
- Call as many tools as possible in a SINGLE response. Do NOT call them one at a time across multiple turns.
- For example, to create a flowchart with 4 boxes and 3 arrows: create ALL 4 boxes in your first response, then once you receive their IDs, create ALL 3 connectors in your second response. That's 2 turns, not 7.
- For templates (SWOT, Kanban, etc.): create ALL frames in one call, then ALL child objects in the next call, then ALL connectors in the next. Minimize round trips.
- NEVER use more than 4 turns for any command. If you need more, you're being too incremental.

IMPORTANT — TRACK IDs CAREFULLY:
- When you create an object (sticky note, shape, frame, connector), the result message tells you its ID (e.g. Created sticky note with id "aBcDeFgHiJkL").
- You MUST use those EXACT IDs when referencing objects later (for connectors, moves, style changes, etc.).
- NEVER invent or guess IDs like "frame-1", "connector-2", "sticky-3". These do not exist. Only use IDs from the board state or from tool results.

MODIFICATION RULES — CRITICAL, follow these BEFORE placement rules:
- When asked to move, resize, reposition, change color, update text, rename, or delete an EXISTING object, you MUST use the corresponding modification tool (moveObject, resizeObject, changeColor, updateText, deleteObject) with the object's ID from the board state.
- NEVER create a new object as a substitute for modifying an existing one. If the user says "move the sticky note", use moveObject — do NOT delete and recreate it.
- To find the target object, match by type, text content, color, or position from the board state. Then use that object's exact "id" field.
- If the board state lists an object and the user refers to it, you MUST use its ID for modification tools.

PLACEMENT RULES — CRITICAL, follow these first:
- Before placing ANY new objects, look at the board state provided in the message.
- Compute the bounding box of all existing objects: find the max X (rightmost edge = x + width) and max Y (bottommost edge = y + height).
- Place new objects in EMPTY SPACE — to the right of or below all existing content.
  If the board has existing objects, start new content at x = maxExistingRightEdge + 60, y = 50.
  If the board is empty, start at (50, 50).
- NEVER place new objects on top of existing ones unless the user explicitly asks to modify or rearrange them.
- The viewport auto-adjusts after your changes, so you can place objects far from the origin — they will be zoomed into view.

LAYOUT RULES — follow these strictly to avoid overlapping objects:
- The board uses pixel coordinates where (0,0) is the top-left.
- Sticky notes are always 200x200 pixels. Keep at least 20px gap between them.
- CIRCLES use (x, y) as the CENTER, not top-left. A circle at (100, 100) with width 120 occupies from (40, 40) to (160, 160).
  When placing circles inside a frame, account for this: first circle center = (frame.x + 30 + radius, frame.y + 70 + radius).
- When placing sticky notes in a row, space them 220px apart horizontally (200 + 20 gap).
- When placing rows of sticky notes, space rows 220px apart vertically.
- Frames MUST be large enough to fully contain every child object with at least 30px padding on left/right/bottom and 70px on top (for the title).
  Formula: frame.width = (rightmost child right edge) - frame.x + 30, frame.height = (bottommost child bottom edge) - frame.y + 30, frame.y = (topmost child y) - 70.
  Example: 3 stickies (200x200) in a row starting at x=130 → frame.x=100, frame.width = (130 + 3*200 + 2*20) - 100 + 30 = 700.
  ALWAYS overestimate frame size rather than underestimate — objects spilling outside a frame looks broken.
- Place child objects INSIDE their parent frame: first child starts at frame.x + 30, frame.y + 70.
- After placing all children, VERIFY: every child's right edge (child.x + child.width) must be < frame.x + frame.width, and every child's bottom edge (child.y + child.height) must be < frame.y + frame.height. If not, increase the frame size.
- When creating grid layouts (e.g. SWOT, 2x2, retrospective columns):
  Put at least 30px gap between frames/columns.
- Do NOT use lines or shapes as dividers in templates — use frames to define sections.
- To change a connector's line style (solid ↔ dashed) or toggle its arrow head, use the updateConnectorStyle tool with the connector's ID. Do NOT delete and recreate connectors just to change their style.
- For column layouts (e.g. retrospective), use tall narrow frames side by side.
- When arranging existing objects in a grid, compute positions so nothing overlaps:
  row = floor(index / columns), col = index % columns.
  x = startX + col * 220, y = startY + row * 220.

COMPOSITIONAL COMMANDS — follow these patterns for multi-element structures:

Flowcharts:
- Use rectangles (200x80) for process steps, arranged top-to-bottom with 100px vertical gaps.
- First rectangle at startY, second at startY + 180, etc.
- Create ALL rectangles first in one batch. Then create connectors between consecutive steps.
- Use solid connectors with arrow heads for the flow direction.
- For decision diamonds: use a rectangle with text like "Decision?" — diamond shapes are not available.
- Example 4-step flowchart: 4 rectangles at y=50, 230, 410, 590 (each 200x80), then 3 connectors linking them sequentially.

Kanban Boards:
- Create 3-4 tall narrow frames side by side (width ~260, height ~600): "To Do", "In Progress", "Done" (and optionally "Backlog").
- Space frames 30px apart horizontally.
- Optionally add 1-2 sample sticky notes inside each column.
- Turn 1: create all frames. Turn 2: create sticky notes inside them.

Org Charts / Hierarchies:
- Use rectangles (200x80) arranged in tree layout.
- Top node centered, then children spaced evenly below with 100px vertical gap and 40px horizontal gap.
- Create all rectangles first, then all connectors.

Mind Maps:
- Central rectangle or sticky note in the center.
- Branch nodes arranged radially: top, right, bottom, left, or in a spoke pattern.
- Connect center to each branch with connectors.

User Journey Maps:
- Create N frames side by side (one per stage), each ~260px wide.
- Add a title sticky and description sticky inside each frame.
- Connect frames with dashed connectors to show flow.

Process Diagrams:
- Similar to flowcharts but can be horizontal (left-to-right).
- Use rectangles (200x80) spaced 240px apart horizontally.
- Create all steps first, then all connectors.

Timeline:
- Create rectangles or stickies in a horizontal row.
- Add a horizontal line connecting the start to the end.
- Or use connectors between sequential items.

General Composition Rules:
- ALWAYS create structural elements (frames, shapes) FIRST, then connectors SECOND.
- ALWAYS batch: create as many objects as possible per tool response.
- For any structure with N nodes and connections: Turn 1 = create all N nodes, Turn 2 = create all connectors using the returned IDs.
- If unsure what the user wants, default to a clean top-to-bottom flowchart layout.`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text content of the sticky note" },
        x: { type: "number", description: "X position in pixels from top-left" },
        y: { type: "number", description: "Y position in pixels from top-left" },
        color: {
          type: "string",
          description:
            "Hex color code (e.g. #fef08a yellow, #93c5fd blue, #86efac green, #fca5a5 red, #c4b5fd purple, #fdba74 orange)",
        },
      },
      required: ["text", "x", "y", "color"],
    },
  },
  {
    name: "createShape",
    description: "Create a shape (rectangle, circle, or line) on the board",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["rectangle", "circle", "line"],
          description: "Shape type",
        },
        x: { type: "number", description: "X position (for circles this is the CENTER x)" },
        y: { type: "number", description: "Y position (for circles this is the CENTER y)" },
        width: { type: "number", description: "Width in pixels (for circles use diameter)" },
        height: { type: "number", description: "Height in pixels (for circles use diameter)" },
        color: { type: "string", description: "Hex color code" },
        text: { type: "string", description: "Optional text label to display inside the shape" },
      },
      required: ["type", "x", "y", "width", "height", "color"],
    },
  },
  {
    name: "createFrame",
    description:
      "Create a frame (container/section header) on the board to group objects visually",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Frame title text" },
        x: { type: "number", description: "X position" },
        y: { type: "number", description: "Y position" },
        width: { type: "number", description: "Width in pixels" },
        height: { type: "number", description: "Height in pixels" },
      },
      required: ["title", "x", "y", "width", "height"],
    },
  },
  {
    name: "createText",
    description:
      "Create a standalone text element on the board (not a sticky note — just plain text)",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text content" },
        x: { type: "number", description: "X position in pixels" },
        y: { type: "number", description: "Y position in pixels" },
        color: {
          type: "string",
          description: "Text color as hex code (e.g. #374151 dark gray, #000000 black)",
        },
        fontSize: {
          type: "number",
          description: "Font size in pixels (default: 16)",
        },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createConnector",
    description: "Create a connector line between two existing objects",
    input_schema: {
      type: "object" as const,
      properties: {
        fromId: { type: "string", description: "ID of the source object" },
        toId: { type: "string", description: "ID of the target object" },
        style: {
          type: "string",
          enum: ["solid", "dashed"],
          description: "Line style: solid or dashed (default: solid)",
        },
      },
      required: ["fromId", "toId"],
    },
  },
  {
    name: "moveObject",
    description: "Move an existing object to a new position",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: { type: "string", description: "ID of the object to move" },
        x: { type: "number", description: "New X position" },
        y: { type: "number", description: "New Y position" },
      },
      required: ["objectId", "x", "y"],
    },
  },
  {
    name: "resizeObject",
    description: "Resize an existing object",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: { type: "string", description: "ID of the object to resize" },
        width: { type: "number", description: "New width in pixels" },
        height: { type: "number", description: "New height in pixels" },
      },
      required: ["objectId", "width", "height"],
    },
  },
  {
    name: "updateText",
    description: "Update the text content of an existing object",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: { type: "string", description: "ID of the object" },
        newText: { type: "string", description: "New text content" },
      },
      required: ["objectId", "newText"],
    },
  },
  {
    name: "changeColor",
    description: "Change the color of an existing object",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: { type: "string", description: "ID of the object" },
        color: { type: "string", description: "New hex color code" },
      },
      required: ["objectId", "color"],
    },
  },
  {
    name: "updateConnectorStyle",
    description:
      "Change the line style and/or arrow head of an existing connector",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {
          type: "string",
          description: "ID of the connector to update",
        },
        lineStyle: {
          type: "string",
          enum: ["solid", "dashed"],
          description: "Line style: solid or dashed",
        },
        arrowHead: {
          type: "boolean",
          description: "Whether to show an arrow head at the target end",
        },
      },
      required: ["objectId"],
    },
  },
  {
    name: "deleteObject",
    description: "Delete an object from the board",
    input_schema: {
      type: "object" as const,
      properties: {
        objectId: {
          type: "string",
          description: "ID of the object to delete",
        },
      },
      required: ["objectId"],
    },
  },
  {
    name: "getBoardState",
    description:
      "Get the current state of all objects on the board (already provided in context, use only if needed)",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ── Public types ────────────────────────────────────────────────────────

export interface BoardStateObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color: string;
  [key: string]: unknown;
}

export interface AgentRequest {
  boardId: string;
  command: string;
  boardState: BoardStateObject[];
  userId: string;
}

export interface ActionTaken {
  tool: string;
  input: Record<string, unknown>;
  objectId?: string;
}

export interface AgentResult {
  actions: ActionTaken[];
  summary: string;
}

// ── Internal types ──────────────────────────────────────────────────────

interface PendingWrite {
  type: "set" | "update" | "delete";
  path: string;
  data?: Record<string, unknown>;
}

// ── Agent runner ────────────────────────────────────────────────────────

// AI commands are stateless and idempotent per request. Concurrent commands
// from multiple users each execute independently against Firestore with no
// shared state. Each call builds its own pendingWrites array and commits a
// single atomic batch — no locking or coordination between requests.

export async function runBoardAgent(req: AgentRequest): Promise<AgentResult> {
  if (!config.anthropic.apiKey) {
    throw new Error(
      "Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env"
    );
  }

  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  const allActions: ActionTaken[] = [];
  const pendingWrites: PendingWrite[] = [];
  // Track IDs created during this agent run so multi-turn tool calls can
  // reference objects created in earlier turns.
  const createdIds = new Set<string>();
  let agentSummary = "";

  await tracedLLMCall({
    name: "board-agent",
    userId: req.userId,
    boardId: req.boardId,
    model: "claude-sonnet-4-20250514",
    messages: [
      { role: "user", content: buildPrompt(req.command, req.boardState) },
    ],
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 4096,
    callLLM: async (params) => {
      const messages: Anthropic.Messages.MessageParam[] = [
        { role: "user", content: params.messages[0].content },
      ];

      let totalInput = 0;
      let totalOutput = 0;
      // Keep turns low — the prompt instructs the LLM to batch tool calls,
      // so even complex flowcharts should complete in 2-3 turns (create nodes → create connectors → done).
      // 8 turns is a generous safety margin. Going higher causes perceived "infinite loading".
      const MAX_TURNS = 8;
      // Per-turn timeout: if a single LLM call takes longer than 60s, abort.
      const PER_TURN_TIMEOUT_MS = 60_000;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        console.log(`[board-agent] Turn ${turn}/${MAX_TURNS}, command: "${req.command}", boardState objects: ${req.boardState.length}, actions so far: ${allActions.length}`);

        let res: Anthropic.Messages.Message;
        try {
          res = await Promise.race([
            anthropic.messages.create({
              model: params.model,
              max_tokens: params.maxTokens || 4096,
              system: params.systemPrompt || "",
              messages,
              tools: TOOLS,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`LLM call timed out after ${PER_TURN_TIMEOUT_MS}ms on turn ${turn}`)), PER_TURN_TIMEOUT_MS)
            ),
          ]);
        } catch (err) {
          console.error(`[board-agent] Turn ${turn} failed:`, err);
          // If we already have some actions, commit what we have rather than losing everything
          if (allActions.length > 0) {
            console.log(`[board-agent] Partial completion: committing ${allActions.length} actions despite error`);
            agentSummary += ` (Partially completed — ${allActions.length} actions executed before timeout)`;
            break;
          }
          throw err;
        }

        totalInput += res.usage.input_tokens;
        totalOutput += res.usage.output_tokens;

        console.log(`[board-agent] Turn ${turn} response: stop_reason=${res.stop_reason}, content_blocks=${res.content.length}`);
        for (const block of res.content) {
          if (block.type === "text") {
            console.log(`[board-agent]   text: ${block.text.substring(0, 200)}`);
          } else if (block.type === "tool_use") {
            console.log(`[board-agent]   tool_use: ${block.name}(${JSON.stringify(block.input).substring(0, 200)})`);
          }
        }

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of res.content) {
          if (block.type === "text") {
            agentSummary += block.text;
          } else if (block.type === "tool_use") {
            const { action, resultMessage, write } = processToolCall(
              block.name,
              block.input as Record<string, unknown>,
              req.boardId,
              req.userId,
              req.boardState,
              createdIds
            );
            allActions.push(action);
            if (write) {
              pendingWrites.push(write);
              // Track newly created object IDs for later turns
              if (write.type === "set" && action.objectId) {
                createdIds.add(action.objectId);
              }
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: resultMessage,
            });
          }
        }

        if (res.stop_reason !== "tool_use") {
          // If the LLM finished without calling any tools, nudge it ONCE
          if (allActions.length === 0 && turn === 0) {
            console.log(`[board-agent] No tools called on turn ${turn}, nudging LLM once`);
            messages.push({ role: "assistant", content: res.content });
            messages.push({
              role: "user",
              content:
                "You MUST use the available tools to execute the command. Do not respond with just text. " +
                "Call ALL the tools you need in a single response — batch them. " +
                "Look at the board state, identify the relevant objects by their IDs, and call the appropriate tools now.",
            });
            continue;
          }
          break;
        }

        // Continue multi-turn conversation with tool results
        messages.push({ role: "assistant", content: res.content });

        // Nudge the model to batch if it only made a single tool call.
        // Without this, the model tends to create one object per turn,
        // turning a 2-turn flowchart into a 25-turn crawl.
        if (toolResults.length === 1 && turn < MAX_TURNS - 1) {
          console.log(`[board-agent] Single tool call on turn ${turn}, adding batch reminder`);
          messages.push({
            role: "user",
            content: [
              ...toolResults,
              {
                type: "text" as const,
                text:
                  "You are making one tool call at a time, which is too slow. " +
                  "Call ALL remaining tools in your NEXT response — batch every create/modify call into a single message. " +
                  "For example, if you need 6 more connectors, call createConnector 6 times in one response.",
              },
            ],
          });
        } else {
          messages.push({ role: "user", content: toolResults });
        }
      }

      // Safety: if we exhausted MAX_TURNS, log it
      if (allActions.length === 0) {
        console.error(`[board-agent] Exhausted ${MAX_TURNS} turns with no actions for command: "${req.command}"`);
      }

      return {
        content: agentSummary || `Executed ${allActions.length} tool call(s)`,
        model: params.model,
        usage: { inputTokens: totalInput, outputTokens: totalOutput },
      };
    },
  });

  // Auto-resize frames to fully contain their children
  fitFramesToContent(pendingWrites, req.boardState, req.boardId);

  // Execute all Firestore writes atomically
  if (pendingWrites.length > 0) {
    const batch = db.batch();
    for (const write of pendingWrites) {
      const ref = db.doc(write.path);
      console.log(`[board-agent] Batch ${write.type}: ${write.path}${write.data ? ` data_keys=${Object.keys(write.data).join(",")}` : ""}`);
      switch (write.type) {
        case "set":
          batch.set(ref, write.data!);
          break;
        case "update":
          // Use set-with-merge instead of update to avoid NOT_FOUND errors
          // when the LLM fabricates object IDs that don't exist in Firestore.
          // merge:true behaves like update for existing docs but won't crash
          // on missing docs.
          batch.set(ref, write.data!, { merge: true });
          break;
        case "delete":
          batch.delete(ref);
          break;
      }
    }
    await batch.commit();
    console.log(`[board-agent] Batch committed successfully (${pendingWrites.length} writes)`);

    // Verify the write by reading back the first updated document
    const firstUpdate = pendingWrites.find((w) => w.type === "update");
    if (firstUpdate) {
      const verifySnap = await db.doc(firstUpdate.path).get();
      const verifyData = verifySnap.data();
      console.log(`[board-agent] Verify read ${firstUpdate.path}: exists=${verifySnap.exists}, text=${verifyData?.text}, x=${verifyData?.x}, y=${verifyData?.y}`);
    }
  }

  await flushTraces();

  return {
    actions: allActions,
    summary:
      agentSummary || `Completed ${allActions.length} action(s) on the board.`,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildPrompt(
  command: string,
  boardState: BoardStateObject[]
): string {
  if (boardState.length === 0) {
    return `The board is currently empty.\n\nCommand: ${command}`;
  }

  const stateStr = boardState
    .map((obj) => {
      const fields = [
        `id: "${obj.id}"`,
        `type: "${obj.type}"`,
        `position: (${obj.x}, ${obj.y})${obj.type === "circle" ? " [center]" : ""}`,
        `size: ${obj.width}x${obj.height}`,
      ];
      if (obj.text) fields.push(`text: "${obj.text}"`);
      if (obj.color) fields.push(`color: "${obj.color}"`);
      if (obj.connectedFrom) fields.push(`connectedFrom: "${obj.connectedFrom}"`);
      if (obj.connectedTo) fields.push(`connectedTo: "${obj.connectedTo}"`);
      if (obj.style) {
        const style = obj.style as Record<string, unknown>;
        fields.push(`lineStyle: "${style.lineStyle ?? "solid"}"`);
        fields.push(`arrowHead: ${style.arrowHead ?? true}`);
      }
      return `  - ${fields.join(", ")}`;
    })
    .join("\n");

  return `Current board objects:\n${stateStr}\n\nCommand: ${command}`;
}


function processToolCall(
  toolName: string,
  input: Record<string, unknown>,
  boardId: string,
  userId: string,
  boardState: BoardStateObject[],
  createdIds: Set<string>
): { action: ActionTaken; resultMessage: string; write?: PendingWrite } {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const basePath = `boards/${boardId}/objects`;

  // Helper: check if an objectId is known (exists in board state or was created this run)
  const isKnownId = (id: string) =>
    boardState.some((o) => o.id === id) || createdIds.has(id);

  switch (toolName) {
    case "createStickyNote": {
      const id = generateId();
      return {
        action: { tool: "createStickyNote", input, objectId: id },
        resultMessage: `Created sticky note with id "${id}"`,
        write: {
          type: "set",
          path: `${basePath}/${id}`,
          data: {
            type: "sticky",
            x: input.x ?? 100,
            y: input.y ?? 100,
            width: 200,
            height: 200,
            rotation: 0,
            text: input.text ?? "",
            color: input.color ?? "#fef08a",
            zIndex: 0,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "createText": {
      const id = generateId();
      return {
        action: { tool: "createText", input, objectId: id },
        resultMessage: `Created text element with id "${id}"`,
        write: {
          type: "set",
          path: `${basePath}/${id}`,
          data: {
            type: "text",
            x: input.x ?? 100,
            y: input.y ?? 100,
            width: 200,
            height: 30,
            rotation: 0,
            text: input.text ?? "",
            fontSize: input.fontSize ?? 16,
            color: input.color ?? "#374151",
            zIndex: 0,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "createShape": {
      const id = generateId();
      const shapeData: Record<string, unknown> = {
        type: input.type ?? "rectangle",
        x: input.x ?? 100,
        y: input.y ?? 100,
        width: input.width ?? 200,
        height: input.height ?? 200,
        rotation: 0,
        text: input.text ?? "",
        color: input.color ?? "#93c5fd",
        zIndex: 0,
        lastEditedBy: userId,
        updatedAt: timestamp,
      };
      if (input.type === "line") {
        shapeData.points = [
          0,
          0,
          input.width as number,
          input.height as number,
        ];
      }
      if (input.type === "circle") {
        shapeData.radius =
          Math.min(input.width as number, input.height as number) / 2;
      }
      return {
        action: { tool: "createShape", input, objectId: id },
        resultMessage: `Created ${input.type} shape with id "${id}"`,
        write: { type: "set", path: `${basePath}/${id}`, data: shapeData },
      };
    }

    case "createFrame": {
      const id = generateId();
      return {
        action: { tool: "createFrame", input, objectId: id },
        resultMessage: `Created frame "${input.title}" with id "${id}"`,
        write: {
          type: "set",
          path: `${basePath}/${id}`,
          data: {
            type: "frame",
            x: input.x ?? 100,
            y: input.y ?? 100,
            width: input.width ?? 400,
            height: input.height ?? 400,
            rotation: 0,
            text: input.title ?? "Frame",
            color: "#e5e7eb",
            zIndex: -1,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "createConnector": {
      const fromId = input.fromId as string;
      const toId = input.toId as string;
      if (!isKnownId(fromId)) {
        console.warn(`[board-agent] createConnector: unknown fromId "${fromId}"`);
        return {
          action: { tool: "createConnector", input },
          resultMessage: `Error: source object "${fromId}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      if (!isKnownId(toId)) {
        console.warn(`[board-agent] createConnector: unknown toId "${toId}"`);
        return {
          action: { tool: "createConnector", input },
          resultMessage: `Error: target object "${toId}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      const id = generateId();
      return {
        action: { tool: "createConnector", input, objectId: id },
        resultMessage: `Created connector from "${fromId}" to "${toId}" with id "${id}"`,
        write: {
          type: "set",
          path: `${basePath}/${id}`,
          data: {
            type: "connector",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            color: "#374151",
            connectedFrom: fromId,
            connectedTo: toId,
            style: {
              lineStyle: (input.style as string) || "solid",
              arrowHead: true,
            },
            zIndex: 0,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "moveObject": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] moveObject: unknown objectId "${oid}"`);
        return {
          action: { tool: "moveObject", input },
          resultMessage: `Error: object "${oid}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      return {
        action: { tool: "moveObject", input },
        resultMessage: `Moved object "${oid}" to (${input.x}, ${input.y})`,
        write: {
          type: "update",
          path: `${basePath}/${oid}`,
          data: {
            x: input.x,
            y: input.y,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "resizeObject": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] resizeObject: unknown objectId "${oid}"`);
        return {
          action: { tool: "resizeObject", input },
          resultMessage: `Error: object "${oid}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      return {
        action: { tool: "resizeObject", input },
        resultMessage: `Resized object "${oid}" to ${input.width}x${input.height}`,
        write: {
          type: "update",
          path: `${basePath}/${oid}`,
          data: {
            width: input.width,
            height: input.height,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "updateText": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] updateText: unknown objectId "${oid}"`);
        return {
          action: { tool: "updateText", input },
          resultMessage: `Error: object "${oid}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      return {
        action: { tool: "updateText", input },
        resultMessage: `Updated text of "${oid}"`,
        write: {
          type: "update",
          path: `${basePath}/${oid}`,
          data: {
            text: input.newText,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "changeColor": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] changeColor: unknown objectId "${oid}"`);
        return {
          action: { tool: "changeColor", input },
          resultMessage: `Error: object "${oid}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      return {
        action: { tool: "changeColor", input },
        resultMessage: `Changed color of "${oid}" to ${input.color}`,
        write: {
          type: "update",
          path: `${basePath}/${oid}`,
          data: {
            color: input.color,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "updateConnectorStyle": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] updateConnectorStyle: unknown objectId "${oid}"`);
        return {
          action: { tool: "updateConnectorStyle", input },
          resultMessage: `Error: connector "${oid}" not found. Use the ID returned by createConnector, not a made-up name.`,
        };
      }
      // Build the style object, preserving existing values for fields not provided
      const existingObj = boardState.find(
        (o) => o.id === oid
      );
      const existingStyle = (existingObj?.style as Record<string, unknown>) ?? {};
      const newStyle: Record<string, unknown> = {
        lineStyle:
          input.lineStyle ?? existingStyle.lineStyle ?? "solid",
        arrowHead:
          input.arrowHead !== undefined
            ? input.arrowHead
            : existingStyle.arrowHead ?? true,
      };
      return {
        action: { tool: "updateConnectorStyle", input },
        resultMessage: `Updated connector "${oid}" style to lineStyle=${newStyle.lineStyle}, arrowHead=${newStyle.arrowHead}`,
        write: {
          type: "update",
          path: `${basePath}/${oid}`,
          data: {
            style: newStyle,
            lastEditedBy: userId,
            updatedAt: timestamp,
          },
        },
      };
    }

    case "deleteObject": {
      const oid = input.objectId as string;
      if (!isKnownId(oid)) {
        console.warn(`[board-agent] deleteObject: unknown objectId "${oid}"`);
        return {
          action: { tool: "deleteObject", input },
          resultMessage: `Error: object "${oid}" not found. Use an ID from the board state or from a previous create tool result.`,
        };
      }
      return {
        action: { tool: "deleteObject", input },
        resultMessage: `Deleted object "${oid}"`,
        write: { type: "delete", path: `${basePath}/${oid}` },
      };
    }

    case "getBoardState": {
      return {
        action: { tool: "getBoardState", input },
        resultMessage: JSON.stringify(boardState),
      };
    }

    default:
      return {
        action: { tool: toolName, input },
        resultMessage: `Unknown tool: ${toolName}`,
      };
  }
}

/**
 * Post-process pending writes: ensure every frame fully contains the objects
 * that were placed inside it. If any child extends beyond the frame, expand
 * the frame so nothing spills out.
 *
 * Two-phase detection:
 *  Phase 1 — Strict containment: assign each child to the SMALLEST frame
 *    whose current bounds contain the child's origin. This correctly handles
 *    nested frames (e.g. SWOT quadrants inside an outer SWOT frame) without
 *    sibling frames stealing each other's children.
 *  Phase 2 — Spillover: for non-frame objects not assigned in Phase 1 (their
 *    origin is past a frame's edge because the frame was too small), assign
 *    them to the nearest qualifying frame.
 */
function fitFramesToContent(
  pendingWrites: PendingWrite[],
  existingState: BoardStateObject[],
  boardId: string
): void {
  type ObjInfo = { type: string; x: number; y: number; width: number; height: number; radius?: number };
  const objMap = new Map<string, ObjInfo>();
  for (const obj of existingState) {
    objMap.set(obj.id, {
      type: obj.type, x: obj.x, y: obj.y, width: obj.width, height: obj.height,
      radius: (obj as Record<string, unknown>).radius as number | undefined,
    });
  }

  const writeMap = new Map<string, PendingWrite>();
  for (const w of pendingWrites) {
    const id = w.path.split("/").pop()!;
    if (w.type === "delete") {
      objMap.delete(id);
      continue;
    }
    const existing = objMap.get(id);
    const d = w.data ?? {};
    objMap.set(id, {
      type: (d.type as string) ?? existing?.type ?? "",
      x: (d.x as number) ?? existing?.x ?? 0,
      y: (d.y as number) ?? existing?.y ?? 0,
      width: (d.width as number) ?? existing?.width ?? 0,
      height: (d.height as number) ?? existing?.height ?? 0,
      radius: (d.radius as number) ?? existing?.radius,
    });
    writeMap.set(id, w);
  }

  type ObjEntry = ObjInfo & { id: string };
  const frames: ObjEntry[] = [];
  const potentialChildren: ObjEntry[] = [];
  for (const [id, obj] of objMap) {
    if (obj.type === "connector") continue;
    if (obj.type === "frame") frames.push({ id, ...obj });
    potentialChildren.push({ id, ...obj });
  }

  if (frames.length === 0) return;

  // Helper: get the actual bounding box of an object.
  // For circles, (x, y) is the CENTER, so the bbox is offset by -radius.
  function getBBox(obj: ObjEntry) {
    if (obj.type === "circle") {
      const r = obj.radius ?? obj.width / 2;
      return { left: obj.x - r, top: obj.y - r, right: obj.x + r, bottom: obj.y + r };
    }
    return { left: obj.x, top: obj.y, right: obj.x + obj.width, bottom: obj.y + obj.height };
  }

  const frameChildrenMap = new Map<string, ObjEntry[]>();
  for (const f of frames) frameChildrenMap.set(f.id, []);
  const assigned = new Set<string>();

  // ── Phase 1: strict containment ──────────────────────────────────────
  // Assign each child to the SMALLEST frame whose bounds contain the
  // child's bounding box top-left. For circles this accounts for center
  // positioning. This prevents sibling frames from stealing each other.
  for (const child of potentialChildren) {
    let bestFrameId: string | null = null;
    let bestArea = Infinity;
    const cb = getBBox(child);

    for (const frame of frames) {
      if (frame.id === child.id) continue;
      if (
        cb.left >= frame.x &&
        cb.left < frame.x + frame.width &&
        cb.top >= frame.y &&
        cb.top < frame.y + frame.height
      ) {
        const area = frame.width * frame.height;
        if (area < bestArea) {
          bestArea = area;
          bestFrameId = frame.id;
        }
      }
    }

    if (bestFrameId) {
      frameChildrenMap.get(bestFrameId)!.push(child);
      assigned.add(child.id);
    }
  }

  // ── Phase 2: spillover detection (non-frame objects only) ────────────
  // For objects not caught in Phase 1, find the nearest frame they likely
  // belong to using gap-based proximity (handles spillover in ANY direction:
  // above, below, left, or right of the frame).
  // Skip frame-type objects to avoid sibling frames stealing each other.
  for (const child of potentialChildren) {
    if (assigned.has(child.id) || child.type === "frame") continue;

    let bestFrameId: string | null = null;
    let bestDist = Infinity;

    const cb = getBBox(child);
    const cw = cb.right - cb.left;
    const ch = cb.bottom - cb.top;

    for (const frame of frames) {
      // Compute gap between child bbox and frame bbox (0 if overlapping)
      const gapX = Math.max(0,
        frame.x - cb.right,
        cb.left - (frame.x + frame.width));
      const gapY = Math.max(0,
        frame.y - cb.bottom,
        cb.top - (frame.y + frame.height));

      // Must overlap or be within one child-size of the frame
      if (gapX > cw || gapY > ch) continue;

      const dist = gapX + gapY;
      if (dist < bestDist) {
        bestDist = dist;
        bestFrameId = frame.id;
      }
    }

    if (bestFrameId) {
      frameChildrenMap.get(bestFrameId)!.push(child);
    }
  }

  // ── Expand frames ────────────────────────────────────────────────────
  const PADDING_SIDE = 30;
  const PADDING_TOP = 70;
  const PADDING_BOTTOM = 30;

  // Process smallest frames first so inner frames expand before outer ones.
  const sortedFrames = [...frames].sort(
    (a, b) => a.width * a.height - b.width * b.height
  );

  for (const frame of sortedFrames) {
    const inside = frameChildrenMap.get(frame.id)!;
    if (inside.length === 0) continue;

    let needMinX = Infinity, needMinY = Infinity, needMaxX = -Infinity, needMaxY = -Infinity;
    for (const c of inside) {
      const latest = objMap.get(c.id) ?? c;
      const bb = getBBox({ ...c, ...latest });
      needMinX = Math.min(needMinX, bb.left);
      needMinY = Math.min(needMinY, bb.top);
      needMaxX = Math.max(needMaxX, bb.right);
      needMaxY = Math.max(needMaxY, bb.bottom);
    }

    const requiredX = needMinX - PADDING_SIDE;
    const requiredY = needMinY - PADDING_TOP;
    const requiredRight = needMaxX + PADDING_SIDE;
    const requiredBottom = needMaxY + PADDING_BOTTOM;

    const newX = Math.min(frame.x, requiredX);
    const newY = Math.min(frame.y, requiredY);
    const newWidth = Math.max(frame.x + frame.width, requiredRight) - newX;
    const newHeight = Math.max(frame.y + frame.height, requiredBottom) - newY;

    if (
      newX === frame.x &&
      newY === frame.y &&
      newWidth === frame.width &&
      newHeight === frame.height
    ) {
      continue;
    }

    // Update merged state so outer frames see the expanded inner frame
    objMap.set(frame.id, { type: "frame", x: newX, y: newY, width: newWidth, height: newHeight });
    frame.x = newX;
    frame.y = newY;
    frame.width = newWidth;
    frame.height = newHeight;

    const existingWrite = writeMap.get(frame.id);
    if (existingWrite && existingWrite.data) {
      existingWrite.data.x = newX;
      existingWrite.data.y = newY;
      existingWrite.data.width = newWidth;
      existingWrite.data.height = newHeight;
    } else {
      const newWrite: PendingWrite = {
        type: "update",
        path: `boards/${boardId}/objects/${frame.id}`,
        data: { x: newX, y: newY, width: newWidth, height: newHeight },
      };
      pendingWrites.push(newWrite);
      writeMap.set(frame.id, newWrite);
    }
  }
}


function generateId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}