import { AgentRuntime, createFileAdapters } from "agents-runtime";
import { Hono } from "hono";

import { DATA_DIR } from "../config.js";

const sessions = new Hono();
const runtime = new AgentRuntime(createFileAdapters(DATA_DIR));

sessions.post("/sessions", async (c) => {
  const body = await c.req.json<{
    agentConfigId?: string;
    modelId?: string;
    systemPrompt?: string;
  }>();
  const result = await runtime.createSession(body);
  return c.json(result, 201);
});

sessions.get("/sessions", async (c) => {
  const result = await runtime.listSessions();
  return c.json({ sessions: result });
});

sessions.get("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const result = await runtime.getSession(id);
  if (!result) return c.json({ error: "Session not found" }, 404);
  return c.json({
    session: { id: result.session.id, updatedAt: result.session.updatedAt },
    agent: {
      id: result.agent.id,
      status: result.agent.status,
      turnCount: result.agent.turnCount,
      ...(result.agent.result !== undefined && { result: result.agent.result }),
    },
  });
});

sessions.get("/sessions/:id/items", async (c) => {
  const id = c.req.param("id");
  const items = await runtime.getSessionItems(id);
  if (!items) return c.json({ error: "Session not found" }, 404);
  return c.json({ items });
});

export default sessions;
