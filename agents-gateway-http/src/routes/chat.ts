import { Hono } from "hono";

import { getGatewayConfig } from "../gateway-config.js";
import { getRuntime } from "../runtime.js";

const chat = new Hono();

chat.post("/chat", async (c) => {
  const runtime = getRuntime();
  const body = await c.req.json<{
    message?: string;
    modelId?: string;
    thinkingEnabled?: boolean;
  }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const result = await runtime.sendMessage(body.message, {
    modelId: body.modelId,
    thinkingEnabled: body.thinkingEnabled,
  });
  return c.json(result);
});

chat.get("/chat/history", async (c) => {
  const runtime = getRuntime();
  const history = await runtime.getHistory();
  return c.json(history);
});

chat.get("/models", async (c) => {
  const runtime = getRuntime();
  const allModels = await runtime.getModels();
  const config = getGatewayConfig();
  const allowedPatterns = (config?.allowedModels ?? []) as string[];

  const models = allowedPatterns.length > 0
    ? allModels.filter((m: { id: string }) => matchesAny(m.id, allowedPatterns))
    : allModels;

  return c.json({ models });
});

function matchesAny(id: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/*")) {
      return id.startsWith(pattern.slice(0, -1));
    }
    return id === pattern;
  });
}

export default chat;
