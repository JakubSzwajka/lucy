import { streamText, generateText, type CoreMessage, type ToolSet } from "ai";
import type { LanguageModelV1ProviderMetadata } from "@ai-sdk/provider";
import type { RuntimeDeps, ChatContext, Agent, AgentConfigWithTools, RunOptions, RunResult, ModelMessage, MessageItem } from "./types.js";
import { EnvironmentContextService } from "./environment-context.js";
import { createFileAdapters } from "./adapters/index.js";
import { OpenRouterModelProvider } from "./adapters/openrouter-model-provider.js";
import { itemsToFullModelMessages, applySlidingWindow, stripImageParts, prependSystemPrompt } from "./messages.js";
import { persistStepContent, type ContentPart } from "./step-persistence.js";

/**
 * Runtime shape of tool results from the AI SDK's StepResult.
 * The SDK types resolve to `never` when tools are dynamically provided
 * (typed as ToolSet / Record<string, unknown>), but at runtime these
 * objects always carry these fields.
 */
interface RuntimeToolResult {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
}

const activeAbortControllers = new Map<string, AbortController>();

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

  constructor(deps?: Partial<RuntimeDeps>) {
    const fileAdapters = createFileAdapters();
    this.deps = {
      agents: deps?.agents ?? fileAdapters.agents,
      items: deps?.items ?? fileAdapters.items,
      config: deps?.config ?? fileAdapters.config,
      models: deps?.models ?? new OpenRouterModelProvider(),
      identity: deps?.identity ?? fileAdapters.identity,
      sessions: deps?.sessions ?? fileAdapters.sessions,
    };
  }

  async prepareContext(
    agentId: string,
    userId: string,
    options: { modelId?: string; thinkingEnabled?: boolean } = {},
  ): Promise<ChatContext | null> {
    const { modelId, thinkingEnabled = true } = options;

    const agent = await this.deps.agents.getById(agentId);
    if (!agent) return null;

    let agentConfig: AgentConfigWithTools | null = null;
    if (agent.agentConfigId) {
      agentConfig = await this.deps.config.getAgentConfig(agent.agentConfigId);
    }

    const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "anthropic/claude-sonnet-4.6";
    const effectiveModelId = modelId || agent.model || agentConfig?.defaultModelId || DEFAULT_MODEL;

    const modelConfig = await this.deps.models.getModelConfig(effectiveModelId);
    if (!modelConfig) {
      throw new Error(`Unknown model: ${effectiveModelId}`);
    }

    const languageModel = this.deps.models.getLanguageModel(modelConfig);

    let systemPrompt = await this.resolveSystemPrompt(agent, agentConfig);

    // Inject environment context
    try {
      const envService = new EnvironmentContextService();
      const envSection = envService.buildContext();
      if (envSection) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${envSection}`
          : envSection;
      }
    } catch {
      // Non-critical
    }

    // Inject identity context
    try {
      const identity = await this.deps.identity.getActive(userId);
      if (identity?.content) {
        const c = identity.content;
        const parts: string[] = [];
        if (c.values?.length) parts.push(`Values: ${c.values.join("; ")}`);
        if (c.capabilities?.length) parts.push(`Capabilities: ${c.capabilities.join("; ")}`);
        if (c.keyRelationships?.length)
          parts.push(
            `Key relationships: ${c.keyRelationships.map((r) => `${r.name} (${r.nature})`).join("; ")}`,
          );
        if (c.growthNarrative) parts.push(`Growth narrative: ${c.growthNarrative}`);
        if (parts.length > 0) {
          const identitySection = `## User Identity\n${parts.join("\n")}`;
          systemPrompt = systemPrompt
            ? `${systemPrompt}\n\n${identitySection}`
            : identitySection;
        }
      }
    } catch {
      // Non-critical
    }

    const isThinkingActive = (modelConfig.supportsReasoning && thinkingEnabled) ?? false;

    return {
      agent,
      languageModel,
      modelConfig,
      tools: {},
      providerOptions: this.deps.models.buildProviderOptions(modelConfig, thinkingEnabled),
      maxOutputTokens: undefined,
      systemPrompt,
      isThinkingActive,
    };
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

    // Strip image parts if model doesn't support them
    const sanitizedMessages = context.modelConfig.supportsImages === false
      ? stripImageParts(messages)
      : messages;

    const messagesWithSystem = prependSystemPrompt(sanitizedMessages, context.systemPrompt);
    const hasTools = Object.keys(context.tools).length > 0;

    if (options.streaming) {
      // Streaming mode
      const result = streamText({
        model: context.languageModel,
        messages: messagesWithSystem as CoreMessage[],
        tools: hasTools ? context.tools as ToolSet : undefined,
        maxSteps: hasTools ? 10 : 1,
        maxTokens: context.maxOutputTokens,
        providerOptions: context.providerOptions as LanguageModelV1ProviderMetadata,
        onStepFinish: async (stepResult) => {
          const contentParts: ContentPart[] = [];
          if (stepResult.reasoning) {
            contentParts.push({ type: "reasoning", text: stepResult.reasoning });
          }
          if (stepResult.text) {
            contentParts.push({ type: "text", text: stepResult.text });
          }
          for (const tc of stepResult.toolCalls) {
            contentParts.push({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: (tc.args ?? {}) as Record<string, unknown>,
            });
          }
          for (const tr of stepResult.toolResults as RuntimeToolResult[]) {
            contentParts.push({
              type: "tool-result",
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              output: tr.result,
            });
          }
          if (contentParts.length > 0) {
            await persistStepContent(this.deps.items, agentId, contentParts);
          }
        },
        onFinish: async () => {
          await this.deps.agents.update(agentId, {
            status: "waiting",
            completedAt: new Date(),
          });
          if (options.onFinish) {
            await options.onFinish();
          }
        },
      });

      return { streaming: true as const, stream: result };
    } else {
      // Non-streaming mode — generateText loop
      const maxTurns = options.maxTurns ?? 25;

      const abortController = new AbortController();
      activeAbortControllers.set(agentId, abortController);

      let reachedMaxTurns = false;

      try {
        for (let turn = 0; turn < maxTurns; turn++) {
          if (abortController.signal.aborted) break;

          // Re-read items each turn
          const items = await this.deps.items.getByAgentId(agentId);
          const windowedItems = applySlidingWindow(items);
          const turnModelMessages = itemsToFullModelMessages(windowedItems);

          const turnMessages: CoreMessage[] = context.systemPrompt
            ? [{ role: "system", content: context.systemPrompt } as CoreMessage, ...turnModelMessages as CoreMessage[]]
            : turnModelMessages as CoreMessage[];

          const result = await generateText({
            model: context.languageModel,
            messages: turnMessages,
            tools: hasTools ? context.tools as ToolSet : undefined,
            maxTokens: context.maxOutputTokens,
            abortSignal: abortController.signal,
            providerOptions: context.providerOptions as LanguageModelV1ProviderMetadata,
          });

          // Persist assistant text
          if (result.text) {
            await this.deps.items.createMessage(agentId, { role: "assistant", content: result.text });
          }

          // Persist tool calls and results from steps
          if (result.steps) {
            for (const step of result.steps) {
              for (const tc of step.toolCalls) {
                await this.deps.items.createToolCall(agentId, {
                  callId: tc.toolCallId,
                  toolName: tc.toolName,
                  toolArgs: (tc.args as Record<string, unknown> | undefined) ?? null,
                  toolStatus: "completed",
                });
              }
              for (const tr of step.toolResults as RuntimeToolResult[]) {
                await this.deps.items.createToolResult(agentId, {
                  callId: tr.toolCallId,
                  toolOutput: typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result),
                });
              }
            }
          }

          await this.deps.agents.update(agentId, { turnCount: turn + 1 });

          const lastStep = result.steps?.[result.steps.length - 1];
          if (!lastStep?.toolCalls?.length) break;

          if (turn === maxTurns - 1) reachedMaxTurns = true;
        }

        const wasCancelled = abortController.signal.aborted;
        const finalItems = await this.deps.items.getByAgentId(agentId);
        const lastAssistantItem = [...finalItems].reverse().find(
          (i): i is MessageItem => i.type === "message" && i.role === "assistant",
        );
        let finalResult = lastAssistantItem?.content || "Task completed without response.";
        if (wasCancelled) finalResult += " [cancelled]";
        else if (reachedMaxTurns) finalResult += " [max turns reached]";

        await this.deps.agents.update(agentId, {
          status: wasCancelled ? "cancelled" : "completed",
          result: finalResult,
          completedAt: new Date(),
        });

        activeAbortControllers.delete(agentId);

        if (options.onFinish) await options.onFinish();
        return { streaming: false as const, result: finalResult, reachedMaxTurns };
      } catch (error) {
        activeAbortControllers.delete(agentId);

        if (abortController.signal.aborted) {
          const cancelResult = "Execution cancelled by user";
          await this.deps.agents.update(agentId, {
            status: "cancelled",
            result: cancelResult,
            completedAt: new Date(),
          });
          return { streaming: false as const, result: cancelResult, reachedMaxTurns: false };
        }

        const errorMessage = error instanceof Error ? error.message : "Agent execution failed";
        await this.deps.agents.update(agentId, {
          status: "failed",
          error: errorMessage,
          completedAt: new Date(),
        });
        throw error;
      }
    }
  }

  private async resolveSystemPrompt(
    agent: Agent,
    agentConfig: AgentConfigWithTools | null,
  ): Promise<string | null> {
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }
    if (agentConfig?.systemPromptId) {
      const prompt = await this.deps.config.getSystemPrompt(agentConfig.systemPromptId);
      if (prompt?.content) return prompt.content;
    }
    return null;
  }
}
