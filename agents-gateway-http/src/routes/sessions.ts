import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Agent, AgentConfigWithTools, SystemPrompt } from "agents-runtime";
import { createFileAdapters } from "agents-runtime";
import { Hono } from "hono";

import { DATA_DIR } from "../config.js";

const sessions = new Hono();

sessions.post("/sessions", async (c) => {
  const body = await c.req.json<{
    agentConfigId?: string;
    modelId?: string;
    systemPrompt?: string;
  }>();

  const sessionId = randomUUID();
  const agentId = randomUUID();
  const configId = body.agentConfigId ?? randomUUID();
  const promptId = body.systemPrompt ? randomUUID() : null;

  if (!body.agentConfigId) {
    const configDir = join(DATA_DIR, "config", "agents");
    await mkdir(configDir, { recursive: true });
    const agentConfig: AgentConfigWithTools = {
      id: configId,
      userId: "default",
      name: "Default Agent",
      description: null,
      systemPromptId: promptId,
      defaultModelId: body.modelId ?? null,
      maxTurns: 25,
      icon: null,
      color: null,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tools: [],
    };
    await writeFile(join(configDir, `${configId}.json`), JSON.stringify(agentConfig, null, 2));

    if (body.systemPrompt) {
      const promptDir = join(DATA_DIR, "config", "prompts");
      await mkdir(promptDir, { recursive: true });
      const prompt: SystemPrompt = {
        id: promptId!,
        name: "Default Prompt",
        content: body.systemPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await writeFile(join(promptDir, `${promptId}.json`), JSON.stringify(prompt, null, 2));
    }
  }

  const agentDir = join(DATA_DIR, "agents");
  await mkdir(agentDir, { recursive: true });
  const agent: Agent = {
    id: agentId,
    sessionId,
    agentConfigId: configId,
    name: "Agent",
    status: "pending",
    turnCount: 0,
    createdAt: new Date(),
  };
  await writeFile(join(agentDir, `${agentId}.json`), JSON.stringify(agent, null, 2));

  const sessionDir = join(DATA_DIR, "sessions", sessionId);
  await mkdir(sessionDir, { recursive: true });
  await writeFile(
    join(sessionDir, "session.json"),
    JSON.stringify({ id: sessionId, agentId, updatedAt: new Date().toISOString() }, null, 2),
  );

  return c.json({ sessionId, agentId }, 201);
});

sessions.get("/sessions", async (c) => {
  const sessionsDir = join(DATA_DIR, "sessions");

  let entries: string[];
  try {
    entries = await readdir(sessionsDir);
  } catch {
    return c.json({ sessions: [] });
  }

  const results: { id: string; agentId: string; updatedAt: string; agent: { status: string; turnCount: number } }[] = [];

  for (const entry of entries) {
    try {
      const sessionRaw = await readFile(join(sessionsDir, entry, "session.json"), "utf-8");
      const session = JSON.parse(sessionRaw);

      const agentRaw = await readFile(join(DATA_DIR, "agents", `${session.agentId}.json`), "utf-8");
      const agent = JSON.parse(agentRaw);

      results.push({
        id: session.id,
        agentId: session.agentId,
        updatedAt: session.updatedAt,
        agent: { status: agent.status, turnCount: agent.turnCount },
      });
    } catch {
      // Skip corrupt or incomplete sessions
    }
  }

  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return c.json({ sessions: results });
});

sessions.get("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const sessionPath = join(DATA_DIR, "sessions", id, "session.json");

  try {
    const sessionRaw = await readFile(sessionPath, "utf-8");
    const session = JSON.parse(sessionRaw);

    const agentPath = join(DATA_DIR, "agents", `${session.agentId}.json`);
    const agentRaw = await readFile(agentPath, "utf-8");
    const agent = JSON.parse(agentRaw);

    return c.json({
      session: { id: session.id, updatedAt: session.updatedAt },
      agent: { id: agent.id, status: agent.status, turnCount: agent.turnCount, ...(agent.result !== undefined && { result: agent.result }) },
    });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

sessions.get("/sessions/:id/items", async (c) => {
  const id = c.req.param("id");
  const sessionPath = join(DATA_DIR, "sessions", id, "session.json");

  try {
    const sessionRaw = await readFile(sessionPath, "utf-8");
    const session = JSON.parse(sessionRaw);

    const adapters = createFileAdapters(DATA_DIR);
    const items = await adapters.items.getByAgentId(session.agentId);

    return c.json({ items });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

export default sessions;
