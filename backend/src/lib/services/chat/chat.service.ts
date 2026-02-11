import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { getSystemPromptService } from "@/lib/services/config";
import { eq, and } from "drizzle-orm";
import { streamText, stepCountIs, ToolSet } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import {
  getToolRegistry,
  initializeToolRegistry,
  getMcpProvider,
} from "@/lib/tools";
import { getAgentService } from "../agent";
import { getSessionService } from "../session";
import { getItemService } from "../item";
import { persistStepContent } from "./step-persistence.service";
import type { ChatContext, ChatPrepareOptions, ExecuteTurnOptions, ModelMessage, ChatFinishResult } from "./types";
import type { Agent, ModelConfig } from "@/types";
import { getContextRetrievalService } from "@/lib/memory/context-retrieval.service";

// ============================================================================
// Chat Service
// ============================================================================

export class ChatService {
  /**
   * Execute a full chat turn: persist user message, prepare context, stream AI response.
   */
  async executeTurn(sessionId: string, userId: string, chatMessages: unknown[], options: ExecuteTurnOptions = {}) {
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

    // Persist latest user message
    const lastUserMessage = (chatMessages as Record<string, unknown>[])
      .filter((m) => m.role === "user")
      .pop();

    if (lastUserMessage) {
      const itemService = getItemService();
      let content = typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : undefined;

      if (!content && Array.isArray(lastUserMessage.parts)) {
        content = (lastUserMessage.parts as Record<string, unknown>[])
          .filter((part) => part.type === "text")
          .map((part) => part.text as string)
          .join("");
      }

      content = content || "";
      await itemService.createMessage(rootAgentId, "user", content, userId);
      await sessionService.maybeGenerateTitle(sessionId, content, userId);
    }

    // Prepare chat context
    const context = await this.prepareChat(rootAgentId, userId, { modelId, thinkingEnabled });
    if (!context) {
      return { error: "Agent not found" as const, status: 404 as const };
    }

    // Convert and prepare messages
    const modelMessages = this.convertToModelMessages(chatMessages);
    const messagesWithSystem = this.prependSystemPrompt(modelMessages, context.systemPrompt);

    const hasTools = Object.keys(context.tools).length > 0;

    // Stream AI response
    const result = streamText({
      model: context.languageModel,
      messages: messagesWithSystem,
      tools: hasTools ? context.tools as ToolSet : undefined,
      stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
      maxOutputTokens: context.maxOutputTokens,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      providerOptions: context.providerOptions as any,
      onStepFinish: async ({ content, reasoning }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await persistStepContent(rootAgentId, content as any[], reasoning);
      },
      onFinish: async () => {
        await this.finalizeChat(rootAgentId, userId);
      },
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    return { stream: result };
  }

  async prepareChat(agentId: string, userId: string, options: ChatPrepareOptions = {}): Promise<ChatContext | null> {
    const { modelId, thinkingEnabled = true } = options;

    const agentService = getAgentService();
    const agent = await agentService.getById(agentId, userId);
    if (!agent) {
      return null;
    }

    const effectiveModelId = modelId || agent.model;
    if (!effectiveModelId) {
      throw new Error("No model ID provided");
    }
    const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
    const languageModel = getLanguageModel(modelConfig);

    let systemPrompt = await this.resolveSystemPrompt(agent, userId);

    // Inject memory context after system prompt
    try {
      const contextService = getContextRetrievalService();
      const contextResult = await contextService.getRelevantMemories(userId, agent.sessionId);
      const memorySection = contextService.formatMemoryContext(contextResult);
      if (memorySection) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${memorySection}`
          : memorySection;
      }
    } catch {
      // Memory injection is non-critical; don't block chat
    }

    const isThinkingActive = (modelConfig.supportsReasoning && thinkingEnabled) ?? false;

    await initializeToolRegistry();
    const mcpProvider = getMcpProvider();
    if (mcpProvider) {
      await mcpProvider.refreshServers();
    }

    const registry = getToolRegistry();
    const tools = await registry.toAiSdkTools({
      agentId,
      sessionId: agent.sessionId,
      userId,
    });

    await agentService.update(agentId, {
      status: "running",
      startedAt: agent.startedAt || new Date(),
    }, userId);

    await this.touchSession(agent.sessionId, userId);

    return {
      agent,
      languageModel,
      modelConfig,
      tools,
      providerOptions: this.buildProviderOptions(modelConfig, thinkingEnabled),
      maxOutputTokens: modelConfig.provider === "anthropic" && isThinkingActive ? 16000 : undefined,
      systemPrompt,
      isThinkingActive,
    };
  }

  async resolveSystemPrompt(agent: Agent, userId: string): Promise<string | null> {
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }

    return this.getDefaultSystemPrompt(userId);
  }

  async getDefaultSystemPrompt(userId: string): Promise<string | null> {
    try {
      const settingsId = `default-${userId}`;
      const [currentSettings] = await db
        .select()
        .from(settings)
        .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));

      if (!currentSettings?.defaultSystemPromptId) {
        return null;
      }

      const systemPromptService = getSystemPromptService();
      const prompt = await systemPromptService.getById(currentSettings.defaultSystemPromptId, userId);

      return prompt?.content || null;
    } catch {
      return null;
    }
  }

  convertToModelMessages(chatMessages: unknown[]): ModelMessage[] {
    return (chatMessages as Record<string, unknown>[]).map((msg) => {
      let content = msg.content as string | undefined;
      if (!content && Array.isArray(msg.parts)) {
        content = (msg.parts as Record<string, unknown>[])
          .filter((part) => part.type === "text")
          .map((part) => part.text as string)
          .join("");
      }
      return {
        role: msg.role as "user" | "assistant" | "system",
        content: content || "",
      };
    });
  }

  prependSystemPrompt(messages: ModelMessage[], systemPrompt: string | null): ModelMessage[] {
    if (!systemPrompt) {
      return messages;
    }

    const hasSystemMessage = messages.some((m) => m.role === "system");
    if (hasSystemMessage) {
      return messages;
    }

    return [{ role: "system", content: systemPrompt }, ...messages];
  }

  buildProviderOptions(modelConfig: ModelConfig, thinkingEnabled: boolean): unknown {
    if (!modelConfig.supportsReasoning || !thinkingEnabled) {
      return undefined;
    }

    if (modelConfig.provider === "openai") {
      return {
        openai: {
          reasoningEffort: "medium" as const,
        },
      };
    }

    if (modelConfig.provider === "anthropic") {
      return {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000,
          },
        },
      };
    }

    return undefined;
  }

  async finalizeChat(agentId: string, userId: string): Promise<ChatFinishResult> {
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
