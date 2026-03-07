import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { AgentRuntime, createFileAdapters } from "agents-runtime";
import { Hono } from "hono";

import { DATA_DIR } from "../config.js";

const chat = new Hono();

chat.post("/chat", async (c) => {
  const body = await c.req.json<{
    sessionId?: string;
    message?: string;
    modelId?: string;
  }>();

  if (!body.sessionId || !body.message) {
    return c.json({ error: "sessionId and message are required" }, 400);
  }

  const sessionPath = join(DATA_DIR, "sessions", body.sessionId, "session.json");

  let session: { id: string; agentId: string };
  try {
    const raw = await readFile(sessionPath, "utf-8");
    session = JSON.parse(raw);
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }

  const { agentId } = session;
  const adapters = createFileAdapters(DATA_DIR);

  await adapters.items.createMessage(agentId, {
    agentId,
    role: "user",
    content: body.message,
  });

  const runtime = new AgentRuntime(adapters);

  const result = await runtime.run(agentId, "default", [], {
    sessionId: body.sessionId,
    streaming: false,
    modelId: body.modelId,
  });

  if (result.streaming) {
    return c.json({ error: "Unexpected streaming result" }, 500);
  }

  return c.json({
    response: result.result,
    agentId,
    reachedMaxTurns: result.reachedMaxTurns,
  });
});

export default chat;
