import { createFileAdapters } from "../adapters/index.js";
import { resolveDataDir } from "../adapters/resolve-data-dir.js";
import { OpenRouterModelProvider } from "../adapters/openrouter-model-provider.js";
import { destroyPlugins, initPlugins } from "../plugins/lifecycle.js";
import { CompactionService } from "./compaction.js";
import { prepareRuntimeContext } from "./context.js";
import {
  runNonStreamingAgent,
  runStreamingAgent,
} from "./execution.js";
import { readPromptFile } from "./prompt-file.js";
import type {
  Agent,
  AgentRuntimeOptions,
  ChatContext,
  Item,
  ModelConfig,
  ModelMessage,
  ResolvedRuntimePlugin,
  RunOptions,
  RunResult,
  RuntimeConfig,
  RuntimeDeps,
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
  private agentId: string | null = null;
  private compaction: CompactionService;
  private deps: RuntimeDeps;
  private promptContent: string | null = null;
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
      config: deps?.config ?? fileAdapters.config,
      identity: deps?.identity ?? fileAdapters.identity,
      items: deps?.items ?? fileAdapters.items,
      models: deps?.models ?? new OpenRouterModelProvider(),
    };
    this.resolvedPlugins = init.resolvedPlugins ?? [];
    this.runtimeConfig = init.config ?? {};
    this.compaction = new CompactionService(
      resolveDataDir(),
      this.runtimeConfig.compaction,
    );
  }

  async init(): Promise<void> {
    this.promptContent = readPromptFile();
    await initPlugins(this.resolvedPlugins, this.deps);
  }

  async destroy(): Promise<void> {
    await destroyPlugins(this.resolvedPlugins);
  }

  async sendMessage(
    message: string,
    options?: { modelId?: string; thinkingEnabled?: boolean },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    const agentId = await this.ensureAgent();
    await this.deps.items.createMessage(agentId, { role: "user", content: message });

    const result = await this.run(agentId, "default", [], {
      streaming: false,
      modelId: options?.modelId,
      thinkingEnabled: options?.thinkingEnabled,
    });

    if (result.streaming) throw new Error("Unexpected streaming result");

    // Run compaction after successful exchange
    try {
      const allItems = await this.deps.items.getByAgentId(agentId);
      await this.compaction.compactIfNeeded(
        allItems,
        async (modelId?: string) => {
          const resolvedId = modelId ?? options?.modelId;
          const config = resolvedId
            ? await this.deps.models.getModelConfig(resolvedId)
            : undefined;
          if (!config) {
            // Fall back to context's model
            const ctx = await this.prepareContext(agentId, "default");
            if (!ctx) throw new Error("Cannot resolve model for compaction");
            return ctx.languageModel;
          }
          return this.deps.models.getLanguageModel(config);
        },
      );
    } catch (err) {
      console.error("[runtime] compaction failed:", err);
    }

    return {
      response: result.result,
      agentId,
      reachedMaxTurns: result.reachedMaxTurns,
    };
  }

  async getHistory(): Promise<{ items: Item[]; compactionSummary: string | null }> {
    const agentId = await this.ensureAgent();
    const items = await this.deps.items.getByAgentId(agentId);
    const state = await this.compaction.getState();
    return { items, compactionSummary: state?.summary ?? null };
  }

  async getModels(): Promise<ModelConfig[]> {
    return this.deps.models.listModels();
  }

  private async ensureAgent(): Promise<string> {
    if (this.agentId) return this.agentId;

    const agentId = "agent";
    const existing = await this.deps.agents.getById(agentId);
    if (existing) {
      this.agentId = agentId;
      return agentId;
    }

    const configId = "default";
    const existingConfig = await this.deps.config.getAgentConfig(configId);
    if (!existingConfig) {
      await this.deps.config.createAgentConfig({
        id: configId,
        userId: "default",
        name: "Default Agent",
        description: null,
        defaultModelId: null,
        maxTurns: 25,
        icon: null,
        color: null,
        isDefault: true,
        tools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const agent: Agent = {
      id: agentId,
      agentConfigId: configId,
      name: "Agent",
      status: "pending",
      turnCount: 0,
      createdAt: new Date(),
    };
    await this.deps.agents.create(agent);
    this.agentId = agentId;
    return agentId;
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
      promptContent: this.promptContent,
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
    const { modelId, thinkingEnabled } = options;

    let context = await this.prepareContext(agentId, userId, { modelId, thinkingEnabled });
    if (!context) {
      throw new Error("Agent not found");
    }

    // Update agent status to running
    await this.deps.agents.update(agentId, {
      status: "running",
      startedAt: context.agent.startedAt || new Date(),
    });

    // Inject compacted summary into system prompt if available
    const compactionState = await this.compaction.getState();
    if (compactionState?.summary) {
      const compactionBlock = `\n\n<conversation-history-summary>\n${compactionState.summary}\n</conversation-history-summary>`;
      context = {
        ...context,
        systemPrompt: (context.systemPrompt ?? "") + compactionBlock,
      };
    }

    if (options.streaming) {
      return runStreamingAgent({
        agentId,
        context,
        deps: this.deps,
        messages,
        onFinish: options.onFinish,
        resolvedPlugins: this.resolvedPlugins,
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
        userId,
      });
    } finally {
      activeAbortControllers.delete(agentId);
    }
  }
}
