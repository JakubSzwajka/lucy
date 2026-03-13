import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { PromptContext, RequestSource } from "agents-runtime";

import { getRuntime } from "../runtime.js";

const chat = new Hono();

/** Extract prompt context from the request body. */
function extractContext(body: Record<string, unknown>): PromptContext {
  const source = (body.source as RequestSource) ?? "browser";
  const timezone = (body.timezone as string) ?? undefined;
  return { source, timezone };
}

chat.post("/chat", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{ message?: string; source?: RequestSource; timezone?: string }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const ctx = extractContext(body);
  const result = await runtime.sendMessage(body.message, { context: ctx });
  return c.json(result);
});

chat.get("/chat/history", async (c) => {
  const runtime = getRuntime();
  const hideToolCalls = c.req.query("hideToolCalls") === "true";
  const history = await runtime.getHistory({ hideToolCalls });

  return c.json(history);
});

/**
 * POST /api/chat/stream — Send a message and stream events via SSE.
 *
 * The response is a stream of server-sent events. Each event has a `type`
 * field and corresponding data. The stream closes after `agent_end`.
 */
chat.post("/chat/stream", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{ message?: string; source?: RequestSource; timezone?: string }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const ctx = extractContext(body);

  return streamSSE(c, async (stream) => {
    const unsubscribe = runtime.subscribe(async (event) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    try {
      await runtime.sendMessageStreaming(body.message!, ctx);
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      });
    } finally {
      unsubscribe();
    }
  });
});

export default chat;
