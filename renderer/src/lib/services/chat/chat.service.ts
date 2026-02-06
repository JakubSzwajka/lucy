import { db, settings, systemPrompts } from "@/lib/db";
import { eq } from "drizzle-orm";
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

// ============================================================================
// Chat Service
// ============================================================================

/**
 * Service for chat orchestration logic
 */
export class ChatService {
  // -------------------------------------------------------------------------
  // Turn Execution
  // -------------------------------------------------------------------------

  /**
   * Execute a full chat turn: persist user message, prepare context, stream AI response.
   * Returns the streamText result for the caller to convert into an HTTP response.
   */
  async executeTurn(sessionId: string, chatMessages: unknown[], options: ExecuteTurnOptions = {}) {
    const { modelId, thinkingEnabled } = options;

    // 1. Resolve session and root agent
    const sessionService = getSessionService();
    const session = sessionService.getById(sessionId);

    if (!session) {
      return { error: "Session not found" as const, status: 404 as const };
    }

    const rootAgentId = session.rootAgentId;
    if (!rootAgentId) {
      return { error: "Session has no root agent" as const, status: 400 as const };
    }

    // 2. Persist latest user message
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
      itemService.createMessage(rootAgentId, "user", content);
      sessionService.maybeGenerateTitle(sessionId, content);
    }

    // 3. Prepare chat context
    const context = await this.prepareChat(rootAgentId, { modelId, thinkingEnabled });
    if (!context) {
      return { error: "Agent not found" as const, status: 404 as const };
    }

    // 4. Convert and prepare messages
    const modelMessages = this.convertToModelMessages(chatMessages);
    const messagesWithSystem = this.prependSystemPrompt(modelMessages, context.systemPrompt);

    const hasTools = Object.keys(context.tools).length > 0;

    // 5. Stream AI response
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
        await this.finalizeChat(rootAgentId);
      },
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    return { stream: result };
  }

  // -------------------------------------------------------------------------
  // Chat Preparation
  // -------------------------------------------------------------------------

  /**
   * Prepare a chat context for streaming
   */
  async prepareChat(agentId: string, options: ChatPrepareOptions = {}): Promise<ChatContext | null> {
    const { modelId, thinkingEnabled = true } = options;

    // Get agent
    const agentService = getAgentService();
    const agent = agentService.getById(agentId);
    if (!agent) {
      return null;
    }

    // Determine model config
    const effectiveModelId = modelId || agent.model;
    if (!effectiveModelId) {
      throw new Error("No model ID provided");
    }
    const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
    const languageModel = getLanguageModel(modelConfig);

    // Determine system prompt
    const systemPrompt = await this.resolveSystemPrompt(agent);

    // Calculate thinking state
    const isThinkingActive = (modelConfig.supportsReasoning && thinkingEnabled) ?? false;

    // Initialize tools
    await initializeToolRegistry();
    const mcpProvider = getMcpProvider();
    if (mcpProvider) {
      await mcpProvider.refreshServers();
    }

    const registry = getToolRegistry();
    const tools = await registry.toAiSdkTools({
      agentId,
      sessionId: agent.sessionId,
    });

    // Update agent status
    agentService.update(agentId, {
      status: "running",
      startedAt: agent.startedAt || new Date(),
    });

    // Update session timestamp
    this.touchSession(agent.sessionId);

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

  // -------------------------------------------------------------------------
  // System Prompt Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve the system prompt for an agent
   * Priority: agent-specific > default from settings > none
   */
  async resolveSystemPrompt(agent: Agent): Promise<string | null> {
    // Use agent-specific system prompt if set
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }

    // Fall back to default system prompt from settings
    return this.getDefaultSystemPrompt();
  }

  /**
   * Get the default system prompt from settings
   */
  async getDefaultSystemPrompt(): Promise<string | null> {
    try {
      const [currentSettings] = db
        .select()
        .from(settings)
        .where(eq(settings.id, "default"))
        .all();

      if (!currentSettings?.defaultSystemPromptId) {
        return null;
      }

      const [prompt] = db
        .select()
        .from(systemPrompts)
        .where(eq(systemPrompts.id, currentSettings.defaultSystemPromptId))
        .all();

      return prompt?.content || null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Message Conversion
  // -------------------------------------------------------------------------

  /**
   * Convert UIMessage format (with parts) to simple messages for streamText
   */
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

  /**
   * Prepend system prompt to messages if not already present
   */
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

  // -------------------------------------------------------------------------
  // Provider Options
  // -------------------------------------------------------------------------

  /**
   * Build provider-specific options for reasoning/thinking
   */
  buildProviderOptions(modelConfig: ModelConfig, thinkingEnabled: boolean): unknown {
    // Skip if model doesn't support reasoning or thinking is disabled
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

  // -------------------------------------------------------------------------
  // Finish Handling
  // -------------------------------------------------------------------------

  /**
   * Finalize a chat stream by updating agent status.
   */
  async finalizeChat(agentId: string): Promise<ChatFinishResult> {
    try {
      // Update agent status and turn count
      const agentService = getAgentService();
      const agent = agentService.getById(agentId);
      if (agent) {
        agentService.update(agentId, {
          status: "waiting",
          turnCount: agent.turnCount + 1,
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to finalize chat",
      };
    }
  }

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  /**
   * Update session timestamp
   */
  private touchSession(sessionId: string): void {
    getSessionService().touch(sessionId);
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
