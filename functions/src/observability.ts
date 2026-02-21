import { Langfuse } from "langfuse";
import { config } from "./config";

/**
 * Langfuse client singleton.
 * Initialized lazily on first use so the module can be imported
 * even when keys are not yet configured (e.g. during build).
 */
let _langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse {
  if (!_langfuse) {
    if (!config.langfuse.secretKey || !config.langfuse.publicKey) {
      throw new Error(
        "Langfuse keys not configured. Run: firebase functions:config:set " +
        "langfuse.secret_key=\"...\" langfuse.public_key=\"...\""
      );
    }
    _langfuse = new Langfuse({
      secretKey: config.langfuse.secretKey,
      publicKey: config.langfuse.publicKey,
      baseUrl: config.langfuse.host,
    });
  }
  return _langfuse;
}

/** Parameters for a traced LLM call. */
export interface TracedLLMCallParams {
  /** Name of the command/action being performed (e.g. "generate-summary"). */
  name: string;
  /** The user who triggered the call. */
  userId?: string;
  /** Board context. */
  boardId?: string;
  /** The LLM model to use (e.g. "claude-sonnet-4-20250514"). */
  model: string;
  /** Messages in Anthropic format: { role, content }[]. */
  messages: Array<{ role: string; content: string }>;
  /** System prompt, if any. */
  systemPrompt?: string;
  /** Max tokens for the response. */
  maxTokens?: number;
  /** Function that performs the actual API call and returns the result. */
  callLLM: (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    maxTokens?: number;
  }) => Promise<LLMResponse>;
}

/** Shape of the response expected from the LLM call function. */
export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Wraps an LLM call with Langfuse tracing.
 *
 * Creates a trace and generation span, delegates to the provided `callLLM`
 * function, records token usage and latency, then returns the LLM response.
 *
 * Usage (when the AI agent is implemented):
 * ```ts
 * const response = await tracedLLMCall({
 *   name: "board-assistant",
 *   userId: uid,
 *   boardId,
 *   model: "claude-sonnet-4-20250514",
 *   messages: [{ role: "user", content: "Summarize this board" }],
 *   callLLM: async (params) => {
 *     const res = await anthropic.messages.create({ ... });
 *     return { content: res.content[0].text, model: res.model, usage: { ... } };
 *   },
 * });
 * ```
 */
export async function tracedLLMCall(
  params: TracedLLMCallParams
): Promise<LLMResponse> {
  const langfuse = getLangfuse();

  const trace = langfuse.trace({
    name: params.name,
    userId: params.userId,
    metadata: { boardId: params.boardId },
  });

  const generation = trace.generation({
    name: `${params.name}-generation`,
    model: params.model,
    input: {
      system: params.systemPrompt,
      messages: params.messages,
    },
    modelParameters: params.maxTokens
      ? { maxTokens: params.maxTokens }
      : undefined,
  });

  const startTime = Date.now();

  try {
    const response = await params.callLLM({
      model: params.model,
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      maxTokens: params.maxTokens,
    });

    generation.end({
      output: response.content,
      usage: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
      },
      metadata: {
        latencyMs: Date.now() - startTime,
      },
    });

    return response;
  } catch (error) {
    generation.end({
      output: null,
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        latencyMs: Date.now() - startTime,
      },
    });

    throw error;
  }
}

/**
 * Flush all pending Langfuse events.
 * Must be called before a Cloud Function returns, since the runtime
 * may terminate before background HTTP sends complete.
 */
export async function flushTraces(): Promise<void> {
  if (_langfuse) {
    await _langfuse.flushAsync();
  }
}

/**
 * Create a simple test trace to verify Langfuse connectivity.
 * Returns true if the trace was created and flushed without errors.
 */
export async function pingLangfuse(): Promise<void> {
  const langfuse = getLangfuse();

  langfuse.trace({
    name: "health-check",
    metadata: { source: "observability-check", timestamp: new Date().toISOString() },
  });

  await langfuse.flushAsync();
}
