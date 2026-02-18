import { getSystemPromptService } from "@/lib/services/config";
import { streamText, generateText, stepCountIs, ToolSet, type ModelMessage as AiModelMessage } from "ai";
import { buildProviderOptions, getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import {
  getToolRegistry,
  initializeToolRegistry,
  getMcpProvider,
} from "@/lib/tools";
import { EnvironmentContextService } from "./environment-context.service";
import { getAgentService } from "../agent";
import { getAgentConfigService } from "../agent-config";
import { getSessionService } from "../session";
import { getItemService } from "../item";
import { getSettingsService } from "../config/settings.service";
import { persistStepContent } from "./step-persistence.service";
import { startActiveObservation, propagateAttributes, updateActiveTrace } from "@langfuse/tracing";
import type { ChatContext, ChatPrepareOptions, ExecuteTurnOptions, IncomingUserMessage, ModelMessage, ChatFinishResult, RunAgentOptions, RunAgentResult } from "./types";
import type { MessageItem, Agent, AgentConfigWithTools } from "@/types";
import type { ToolFilter } from "@/lib/tools";
import type { ToolSource } from "@/lib/tools/types";
import { generateDelegateTools } from "@/lib/tools/delegate";

import { maybeAutoReflect } from "@/lib/memory/auto-reflection.service";

// ============================================================================
// Chat Service
// ============================================================================

export class ChatService {
  /**
   * Execute a full chat turn: persist user message, build history from DB, stream AI response.
   */
  async executeTurn(sessionId: string, userId: string, message: IncomingUserMessage, options: ExecuteTurnOptions = {}) {
    const { modelId, thinkingEnabled } = options;

    const sessionService = getSessionService();
    const session = await sessionService.getById(sessionId, userId);

    if (!session) {
      return { error: "Session not found" as const, status: 404 as const };
    }

    const rootAgentId = session.rootAgentId;
    if (!rootAgentId) {
      return { error: "Session has no root agent" as const, status: 400 as const };
    }

    // Persist user message (including multimodal parts if present)
    const userInputText = message.content;
    const contentPartsJson = message.parts?.length ? JSON.stringify(message.parts) : null;
    await this.persistUserMessage(rootAgentId, sessionId, userInputText, userId, contentPartsJson);

    // Build model messages from DB (authoritative source)
    const userSettings = await getSettingsService().get(userId);
    const allItems = await getItemService().getByAgentId(rootAgentId);
    const windowedItems = this.applySlidingWindow(allItems, userSettings.contextWindowSize);
    const modelMessages = this.itemsToModelMessages(windowedItems);

    const runResult = await this.runAgent(rootAgentId, userId, modelMessages, {
      sessionId,
      modelId,
      thinkingEnabled,
      streaming: true,
    });

    // runAgent with streaming: true always returns { streaming: true, stream }
    if (!runResult.streaming) {
      throw new Error("Unexpected non-streaming result");
    }

    return { stream: runResult.stream };
  }

  /**
   * Unified agent execution — streaming or non-streaming.
   * Shared logic: prepareChat, system prompt, step persistence, tracing, agent status.
   */
  async runAgent(
    agentId: string,
    userId: string,
    messages: ModelMessage[],
    options: RunAgentOptions,
  ): Promise<RunAgentResult> {
    const { sessionId, modelId, thinkingEnabled } = options;

    const context = await this.prepareChat(agentId, userId, { modelId, thinkingEnabled });
    if (!context) {
      throw new Error("Agent not found");
    }

    const messagesWithSystem = this.prependSystemPrompt(messages, context.systemPrompt);
    const hasTools = Object.keys(context.tools).length > 0;
    const agentName = context.agent.name || "assistant";

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userInputText = lastUserMsg
      ? typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content.filter(p => p.type === "text").map(p => (p as { text: string }).text).join("")
      : undefined;

    if (options.streaming) {
      // Streaming mode — returns SSE stream
      return await startActiveObservation(agentName, async (span) => {
        updateActiveTrace({ name: agentName, input: userInputText });
        return await propagateAttributes({
          userId,
          sessionId,
          metadata: { agentId, model: context.modelConfig.id, depth: "0" },
        }, async () => {
          const result = streamText({
            model: context.languageModel,
            messages: messagesWithSystem as AiModelMessage[],
            tools: hasTools ? context.tools as ToolSet : undefined,
            stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
            maxOutputTokens: context.maxOutputTokens,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            providerOptions: context.providerOptions as any,
            onStepFinish: async ({ content, reasoning }) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await persistStepContent(agentId, content as any[], reasoning);
            },
            onFinish: async ({ text }) => {
              span.update({ output: text || "completed" });
              updateActiveTrace({ output: text });
              await this.finalizeChat(agentId, userId);
              if (sessionId) {
                maybeAutoReflect(sessionId, userId, agentId).catch(() => {});
              }
            },
            experimental_telemetry: {
              isEnabled: true,
              functionId: context.modelConfig.id,
              metadata: {
                sessionId,
                userId,
                agentId,
                model: context.modelConfig.id,
                depth: 0,
              },
            },
          });

          span.update({ input: userInputText });
          return { streaming: true as const, stream: result };
        });
      }, { asType: "agent" });
    } else {
      // Non-streaming mode — generateText loop
      const maxTurns = options.maxTurns ?? 25;
      const itemService = getItemService();
      const agentService = getAgentService();

      return await startActiveObservation(agentName, async (span) => {
        return await propagateAttributes({
          userId,
          sessionId,
          metadata: { agentId, model: context.modelConfig.id },
        }, async () => {
          let reachedMaxTurns = false;

          try {
            for (let turn = 0; turn < maxTurns; turn++) {
              // Re-read items each turn to include tool results from previous turns
              const items = await itemService.getByAgentId(agentId);
              const windowedItems = this.applySlidingWindow(items);
              const turnModelMessages = this.itemsToModelMessages(windowedItems);
              const turnMessages = this.prependSystemPrompt(
                turnModelMessages,
                context.systemPrompt,
              );

              const result = await generateText({
                model: context.languageModel,
                messages: turnMessages as AiModelMessage[],
                tools: hasTools ? context.tools as ToolSet : undefined,
                maxOutputTokens: context.maxOutputTokens,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                providerOptions: context.providerOptions as any,
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: context.modelConfig.id,
                  metadata: {
                    sessionId,
                    userId,
                    agentId,
                    model: context.modelConfig.id,
                    turn,
                  },
                },
              });

              // Persist assistant text
              if (result.text) {
                await itemService.createMessage(agentId, "assistant", result.text);
              }

              // Persist tool calls and results from steps
              if (result.steps) {
                for (const step of result.steps) {
                  for (const tc of step.toolCalls) {
                    await itemService.createToolCall(
                      agentId,
                      tc.toolCallId,
                      tc.toolName,
                      tc.input as Record<string, unknown> | undefined,
                      "completed",
                    );
                  }
                  for (const tr of step.toolResults) {
                    await itemService.createToolResult(
                      agentId,
                      tr.toolCallId,
                      tr.output,
                    );
                  }
                }
              }

              await agentService.update(agentId, { turnCount: turn + 1 }, userId);

              const lastStep = result.steps?.[result.steps.length - 1];
              if (!lastStep?.toolCalls?.length) {
                break;
              }

              if (turn === maxTurns - 1) {
                reachedMaxTurns = true;
              }
            }

            // Extract final result
            const finalItems = await itemService.getByAgentId(agentId);
            const lastAssistantItem = [...finalItems].reverse().find(
              (i): i is MessageItem => i.type === "message" && i.role === "assistant",
            );
            let finalResult = lastAssistantItem?.content || "Task completed without response.";
            if (reachedMaxTurns) {
              finalResult += " [max turns reached]";
            }

            await agentService.update(agentId, {
              status: "completed",
              result: finalResult,
              completedAt: new Date(),
            }, userId);

            span.update({ output: finalResult });
            return { streaming: false as const, result: finalResult, reachedMaxTurns };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Agent execution failed";
            await agentService.update(agentId, {
              status: "failed",
              error: errorMessage,
              completedAt: new Date(),
            }, userId);
            span.update({ output: `Error: ${errorMessage}` });
            throw error;
          }
        });
      }, { asType: "agent" });
    }
  }

  private async loadAgentWithConfig(agentId: string, userId: string): Promise<{
    agent: Agent;
    agentConfig: AgentConfigWithTools | null;
    toolFilter: ToolFilter | undefined;
  } | null> {
    const agent = await getAgentService().getById(agentId, userId);
    if (!agent) return null;

    let agentConfig: AgentConfigWithTools | null = null;
    if (agent.agentConfigId) {
      agentConfig = await getAgentConfigService().getById(agent.agentConfigId, userId);
    }

    const toolFilter = agentConfig ? this.buildToolFilter(agentConfig) : undefined;
    return { agent, agentConfig, toolFilter };
  }

  private async initializeTools(): Promise<void> {
    await initializeToolRegistry();
    const mcpProvider = getMcpProvider();
    if (mcpProvider) {
      await mcpProvider.refreshServers();
    }
  }

  async prepareChat(agentId: string, userId: string, options: ChatPrepareOptions = {}): Promise<ChatContext | null> {
    const { modelId, thinkingEnabled = true } = options;

    const loaded = await this.loadAgentWithConfig(agentId, userId);
    if (!loaded) return null;
    const { agent, agentConfig, toolFilter } = loaded;

    const effectiveModelId = modelId || agent.model || agentConfig?.defaultModelId;
    if (!effectiveModelId) {
      throw new Error("No model ID provided");
    }
    const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
    const languageModel = getLanguageModel(modelConfig);

    let systemPrompt = await this.resolveSystemPrompt(agent, userId, agentConfig);

    // Inject environment context (date/time, location, etc.)
    try {
      const envService = new EnvironmentContextService();
      const envSection = envService.buildContext();
      if (envSection) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${envSection}`
          : envSection;
      }
    } catch {
      // Environment context is non-critical; don't block chat
    }

    const isThinkingActive = (modelConfig.supportsReasoning && thinkingEnabled) ?? false;

    await this.initializeTools();

    const registry = getToolRegistry();
    const tools = await registry.toAiSdkTools({
      agentId,
      sessionId: agent.sessionId,
      userId,
    }, toolFilter);

    // Add delegate tools if agent config has delegate entries
    if (agentConfig) {
      const delegateTools = await generateDelegateTools(agentConfig, agent.sessionId, userId, agentId);
      if (delegateTools.length > 0) {
        const { tool: aiTool } = await import("ai");
        for (const dt of delegateTools) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tools as any)[dt.name] = aiTool({
            description: dt.description,
            inputSchema: dt.inputSchema,
            execute: async (args: Record<string, unknown>) => {
              const context = {
                agentId,
                sessionId: agent.sessionId,
                userId,
                callId: crypto.randomUUID(),
                getState: () => undefined,
                setState: () => {},
              };
              return dt.execute(args as never, context);
            },
          });
        }
      }
    }

    await getAgentService().update(agentId, {
      status: "running",
      startedAt: agent.startedAt || new Date(),
    }, userId);

    await this.touchSession(agent.sessionId, userId);

    return {
      agent,
      languageModel,
      modelConfig,
      tools,
      providerOptions: buildProviderOptions(modelConfig, thinkingEnabled),
      maxOutputTokens: modelConfig.provider === "anthropic" && isThinkingActive ? 16000 : undefined,
      systemPrompt,
      isThinkingActive,
    };
  }

  private async resolveSystemPrompt(agent: Agent, userId: string, agentConfig?: AgentConfigWithTools | null): Promise<string | null> {
    // This method might require simplification if we want to force single prompt per agent
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }

    if (agentConfig?.systemPromptOverride) {
      // do we have it? 
      return agentConfig.systemPromptOverride;
    }
    if (agentConfig?.systemPromptId) {
      const systemPromptService = getSystemPromptService();
      const prompt = await systemPromptService.getById(agentConfig.systemPromptId, userId);
      if (prompt?.content) return prompt.content;
    }

    return null;
  }

  /**
   * Apply a sliding window based on user message count.
   * Keeps the last N user messages and everything between/after them.
   * Items outside the window stay in the DB — they're just not sent to the LLM.
   */
  private applySlidingWindow(allItems: import("@/types").Item[], maxUserMessages = 10): import("@/types").Item[] {
    // Find indices of all user messages
    const userMessageIndices: number[] = [];
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      if (item.type === "message" && item.role === "user") {
        userMessageIndices.push(i);
      }
    }

    // If within the window, send everything
    if (userMessageIndices.length <= maxUserMessages) {
      return allItems;
    }

    // Take from the Nth-from-last user message onwards
    const cutoffIndex = userMessageIndices[userMessageIndices.length - maxUserMessages];
    return allItems.slice(cutoffIndex);
  }

  /**
   * Build model messages from DB items. Only includes user/assistant message items
   * (tool calls/results are handled internally by streamText's multi-step execution).
   * Prepends ISO timestamps to each message for LLM context.
   */
  private itemsToModelMessages(allItems: import("@/types").Item[]): ModelMessage[] {
    const messages: ModelMessage[] = [];

    for (const item of allItems) {
      if (item.type !== "message") continue;
      if (item.role === "system") continue;

      const role = item.role as "user" | "assistant";
      const timestamp = item.createdAt ? `[${new Date(item.createdAt).toISOString()}] ` : "";

      // Check for multimodal content parts (stored as JSON in contentParts)
      if (item.contentParts) {
        try {
          const parts: { type: string; text?: string; url?: string; mediaType?: string }[] = JSON.parse(item.contentParts);
          const contentParts: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [];
          let addedTimestamp = false;

          for (const part of parts) {
            if (part.type === "text" && part.text) {
              const prefix = !addedTimestamp ? timestamp : "";
              contentParts.push({ type: "text", text: `${prefix}${part.text}` });
              addedTimestamp = true;
            } else if (part.type === "file" && part.url) {
              contentParts.push({ type: "image", image: new URL(part.url) });
            }
          }

          if (!addedTimestamp && timestamp) {
            contentParts.unshift({ type: "text", text: timestamp.trim() });
          }

          if (contentParts.length > 0) {
            messages.push({ role, content: contentParts });
            continue;
          }
        } catch {
          // Fall through to text-only
        }
      }

      messages.push({ role, content: `${timestamp}${item.content}` });
    }

    return messages;
  }

  private prependSystemPrompt(messages: ModelMessage[], systemPrompt: string | null): ModelMessage[] {
    if (!systemPrompt) {
      return messages;
    }

    const hasSystemMessage = messages.some((m) => m.role === "system");
    if (hasSystemMessage) {
      return messages;
    }

    return [{ role: "system", content: systemPrompt }, ...messages];
  }

  async resolveToolsForAgent(agentId: string, userId: string): Promise<{ key: string; name: string; description: string; source: ToolSource }[]> {
    const loaded = await this.loadAgentWithConfig(agentId, userId);
    if (!loaded) return [];
    const { agent, agentConfig, toolFilter } = loaded;

    await this.initializeTools();

    const registry = getToolRegistry();
    const registeredTools = await registry.getAllTools(toolFilter);

    const result: { key: string; name: string; description: string; source: ToolSource }[] = registeredTools.map(({ key, definition }) => ({
      key,
      name: definition.name,
      description: definition.description,
      source: definition.source,
    }));

    if (agentConfig) {
      const delegateTools = await generateDelegateTools(agentConfig, agent.sessionId, userId, agentId);
      for (const dt of delegateTools) {
        result.push({ key: dt.name, name: dt.name, description: dt.description, source: dt.source });
      }
    }

    return result;
  }

  private async finalizeChat(agentId: string, userId: string): Promise<ChatFinishResult> {
    try {
      const agentService = getAgentService();
      const agent = await agentService.getById(agentId, userId);
      if (agent) {
        await agentService.update(agentId, {
          status: "waiting",
          turnCount: agent.turnCount + 1,
        }, userId);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to finalize chat",
      };
    }
  }

  private buildToolFilter(agentConfig: AgentConfigWithTools): ToolFilter | undefined {
    const mcpServerIds = agentConfig.tools.filter(t => t.toolType === "mcp").map(t => t.toolRef);
    const builtinModuleIds = agentConfig.tools.filter(t => t.toolType === "builtin").map(t => t.toolRef);
    const delegateAgentIds = agentConfig.tools.filter(t => t.toolType === "delegate").map(t => t.toolRef);

    const filter: ToolFilter = {
      ...(mcpServerIds.length > 0 ? { allowedMcpServerIds: mcpServerIds } : {}),
      ...(builtinModuleIds.length > 0 ? { allowedBuiltinModuleIds: builtinModuleIds } : {}),
      ...(delegateAgentIds.length > 0 ? { allowedDelegateAgentIds: delegateAgentIds } : {}),
    };

    return Object.keys(filter).length > 0 ? filter : undefined;
  }


  private async persistUserMessage(agentId: string, sessionId: string, content: string, userId: string, contentParts?: string | null): Promise<void> {
    const itemService = getItemService();
    await itemService.createMessage(agentId, "user", content, userId, contentParts);
    await getSessionService().maybeGenerateTitle(sessionId, content, userId);
  }

  private async touchSession(sessionId: string, userId: string): Promise<void> {
    await getSessionService().touch(sessionId, userId);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!instance) {
    instance = new ChatService();
  }
  return instance;
}
