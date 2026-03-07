import { AgentRuntime, createFileAdapters } from "agents-runtime";
import { Hono } from "hono";

import { DATA_DIR } from "../config.js";

const chat = new Hono();

const runtime = new AgentRuntime(createFileAdapters(DATA_DIR));

chat.post("/chat", async (c) => {
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
