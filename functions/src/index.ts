import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { pingLangfuse, flushTraces } from "./observability";
import { runBoardAgent } from "./agent";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});

/**
 * Health check endpoint to verify Langfuse connectivity.
 * POST /api/observability-check
 */
export const observabilityCheck = functions.https.onRequest(
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    try {
      await pingLangfuse();
      await flushTraces();

      response.status(200).json({
        status: "ok",
        message: "Langfuse trace created and flushed successfully.",
      });
    } catch (error) {
      functions.logger.error("Observability check failed", error);

      response.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred.",
      });
    }
  }
);

/**
 * AI board agent endpoint.
 * POST — accepts { boardId, command, boardState }
 * Requires Firebase Auth token in Authorization header.
 *
 * AI commands are stateless and idempotent per request. Concurrent commands
 * from multiple users each execute independently against Firestore with no
 * shared state. Each invocation creates its own Anthropic conversation and
 * its own Firestore batch write, so two simultaneous commands never interfere.
 */
export const boardAgent = functions.https.onRequest(
  { timeoutSeconds: 120, memory: "256MiB" },
  async (request, response) => {
    // CORS
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    // Validate Firebase Auth token
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      response
        .status(401)
        .json({ error: "Missing or invalid Authorization header." });
      return;
    }

    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      response.status(401).json({ error: "Invalid auth token." });
      return;
    }

    // Validate request body
    const { boardId, command, boardState } = request.body;

    if (!boardId || !command) {
      response
        .status(400)
        .json({ error: "boardId and command are required." });
      return;
    }

    try {
      const result = await runBoardAgent({
        boardId,
        command,
        boardState: boardState || [],
        userId: uid,
      });

      response.status(200).json(result);
    } catch (error) {
      functions.logger.error("Board agent error", error);
      response.status(500).json({
        error:
          error instanceof Error ? error.message : "Agent execution failed.",
      });
    }
  });
