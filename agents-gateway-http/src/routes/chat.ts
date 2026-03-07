import { Hono } from "hono";

import { getRuntime } from "../runtime.js";

const chat = new Hono();

chat.post("/chat", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{
    sessionId?: string;
    message?: string;
    modelId?: string;
  }>();

  if (!body.sessionId || !body.message) {
    return c.json({ error: "sessionId and message are required" }, 400);
  }

  try {
    const result = await runtime.sendMessage(body.sessionId, body.message, {
      modelId: body.modelId,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Session not found") {
      return c.json({ error: "Session not found" }, 404);
    }
    throw error;
  }
});

export default chat;
