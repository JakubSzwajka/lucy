import { Hono } from "hono";

import { getRuntime } from "../runtime.js";

const chat = new Hono();

chat.post("/chat", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{
    message?: string;
    modelId?: string;
  }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const result = await runtime.sendMessage(body.message, {
    modelId: body.modelId,
  });
  return c.json(result);
});

chat.get("/chat/history", async (c) => {
  const runtime = getRuntime();
  const history = await runtime.getHistory();
  return c.json(history);
});

export default chat;
