import { randomUUID } from "node:crypto";
import { createFileAdapters } from "../adapters/index.js";
import { OpenRouterModelProvider } from "../adapters/openrouter-model-provider.js";
import { prepareRuntimeContext } from "./context.js";
import {
  runNonStreamingAgent,
  runStreamingAgent,
} from "./execution.js";
import type {
  Agent,
  AgentRuntimeOptions,
  ChatContext,
  Item,
  ModelMessage,
  ResolvedRuntimePlugin,
  RunOptions,
  RunResult,
  RuntimeConfig,
  RuntimeDeps,
  Session,
  SystemPrompt,
} from "../types.js";

const activeAbortControllers = new Map<string, AbortController>();

interface AgentRuntimeInit extends AgentRuntimeOptions {
  resolvedPlugins?: ResolvedRuntimePlugin[];
}

function isConfigStoreLike(value: unknown): value is RuntimeDeps["config"] {
  return typeof value === "object"
    && value !== null
    && "getAgentConfig" in value
    && typeof value.getAgentConfig === "function";
}

function isAgentRuntimeOptions(
  value: AgentRuntimeInit | Partial<RuntimeDeps> | undefined,
): value is AgentRuntimeInit {
  if (value === undefined) {
    return false;
  }

  if ("deps" in value || "resolvedPlugins" in value) {
    return true;
  }

  return "config" in value && !isConfigStoreLike(value.config);
}

export function cancelAgent(agentId: string): boolean {
  const controller = activeAbortControllers.get(agentId);
  if (controller) {
    controller.abort();
    activeAbortControllers.delete(agentId);
    return true;
  }
  return false;
}

export class AgentRuntime {
  private deps: RuntimeDeps;
  private readonly resolvedPlugins: ResolvedRuntimePlugin[];
  private runtimeConfig: RuntimeConfig;

  constructor(options?: AgentRuntimeInit | Partial<RuntimeDeps>) {
    const init = isAgentRuntimeOptions(options)
      ? options
      : { deps: options };
    const fileAdapters = createFileAdapters();
    const deps = init.deps;
    this.deps = {
      agents: deps?.agents ?? fileAdapters.agents,
      items: deps?.items ?? fileAdapters.items,
      config: deps?.config ?? fileAdapters.config,
      models: deps?.models ?? new OpenRouterModelProvider(),
      identity: deps?.identity ?? fileAdapters.identity,
      sessions: deps?.sessions ?? fileAdapters.sessions,
    };
    this.resolvedPlugins = init.resolvedPlugins ?? [];
    this.runtimeConfig = init.config ?? {};
  }

  async createSession(options: {
    agentConfigId?: string;
    modelId?: string;
    systemPrompt?: string;
  }): Promise<{ sessionId: string; agentId: string }> {
    const sessionId = randomUUID();
    const agentId = randomUUID();

    let configId: string;

    if (options.agentConfigId) {
      configId = options.agentConfigId;
    } else {
      configId = randomUUID();

      let systemPromptId: string | null = null;
      if (options.systemPrompt) {
        const now = new Date();
        const prompt: SystemPrompt = {
          id: randomUUID(),
          name: "Session Prompt",
          content: options.systemPrompt,
          createdAt: now,
          updatedAt: now,
        };
        const created = await this.deps.config.createSystemPrompt(prompt);
        systemPromptId = created.id;
      }

      const now = new Date();
      await this.deps.config.createAgentConfig({
        id: configId,
        userId: "default",
        name: "Default Agent",
        description: null,
        systemPromptId,
        defaultModelId: options.modelId ?? null,
        maxTurns: 25,
        icon: null,
        color: null,
        isDefault: true,
        tools: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    const agent: Agent = {
      id: agentId,
      sessionId,
      agentConfigId: configId,
      name: "Agent",
      status: "pending",
      turnCount: 0,
      createdAt: new Date(),
    };
    await this.deps.agents.create(agent);

    await this.deps.sessions.create({ id: sessionId, agentId });

    return { sessionId, agentId };
  }

  async getSession(sessionId: string): Promise<{ session: Session; agent: Agent } | null> {
    const session = await this.deps.sessions.get(sessionId);
    if (!session) return null;

    const agent = await this.deps.agents.getById(session.agentId);
    if (!agent) return null;

    return { session, agent };
  }

  async listSessions(): Promise<Array<{
    id: string;
    agentId: string;
    updatedAt: string;
    agent: { status: string; turnCount: number };
  }>> {
    const sessions = await this.deps.sessions.list();
    const result: Array<{
      id: string;
      agentId: string;
      updatedAt: string;
      agent: { status: string; turnCount: number };
    }> = [];

    for (const session of sessions) {
      const agent = await this.deps.agents.getById(session.agentId);
      if (!agent) continue;

      result.push({
        id: session.id,
        agentId: session.agentId,
        updatedAt: session.updatedAt,
        agent: { status: agent.status, turnCount: agent.turnCount },
      });
    }

    return result;
  }

  async getSessionItems(sessionId: string): Promise<Item[] | null> {
    const session = await this.deps.sessions.get(sessionId);
    if (!session) return null;
    return this.deps.items.getByAgentId(session.agentId);
  }

  async sendMessage(
    sessionId: string,
    message: string,
    options?: { modelId?: string },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    const session = await this.deps.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const { agentId } = session;
    await this.deps.items.createMessage(agentId, { role: "user", content: message });

    const result = await this.run(agentId, "default", [], {
      sessionId,
      streaming: false,
      modelId: options?.modelId,
    });

    if (result.streaming) throw new Error("Unexpected streaming result");
    return {
      response: result.result,
      agentId,
      reachedMaxTurns: result.reachedMaxTurns,
    };
  }

  async prepareContext(
    agentId: string,
    userId: string,
    options: { modelId?: string; thinkingEnabled?: boolean } = {},
  ): Promise<ChatContext | null> {
    return prepareRuntimeContext({
      agentId,
      deps: this.deps,
      options,
      resolvedPlugins: this.resolvedPlugins,
      userId,
    });
  }

  async run(
    agentId: string,
    userId: string,
    messages: ModelMessage[],
    options: RunOptions,
  ): Promise<RunResult> {
    const { sessionId, modelId, thinkingEnabled } = options;

    const context = await this.prepareContext(agentId, userId, { modelId, thinkingEnabled });
    if (!context) {
      throw new Error("Agent not found");
    }

    // Update agent status to running
    await this.deps.agents.update(agentId, {
      status: "running",
      startedAt: context.agent.startedAt || new Date(),
    });

    // Touch session
    await this.deps.sessions.touch(sessionId);

    if (options.streaming) {
      return runStreamingAgent({
        agentId,
        context,
        deps: this.deps,
        messages,
        onFinish: options.onFinish,
        resolvedPlugins: this.resolvedPlugins,
        sessionId,
        userId,
      });
    }

    const abortController = new AbortController();
    activeAbortControllers.set(agentId, abortController);

    try {
      return await runNonStreamingAgent({
        abortController,
        agentId,
        context,
        deps: this.deps,
        maxTurns: options.maxTurns ?? 25,
        onFinish: options.onFinish,
        resolvedPlugins: this.resolvedPlugins,
        sessionId,
        userId,
      });
    } finally {
      activeAbortControllers.delete(agentId);
    }
  }
}
