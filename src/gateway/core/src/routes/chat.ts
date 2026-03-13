import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { getRuntime } from "../runtime.js";

const chat = new Hono();

chat.post("/chat", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{ message?: string }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const result = await runtime.sendMessage(body.message);
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
  const body = await c.req.json<{ message?: string }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    const unsubscribe = runtime.subscribe(async (event) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    try {
      await runtime.sendMessageStreaming(body.message!);
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
