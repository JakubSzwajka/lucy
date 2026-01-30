import { db, settings, systemPrompts, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import {
  getToolRegistry,
  initializeToolRegistry,
  getMcpProvider,
  insertItem,
} from "@/lib/tools";
import { getAgentService } from "../agent";
import type { ChatContext, ChatPrepareOptions, ModelMessage, ChatFinishResult } from "./types";
import type { Agent, ModelConfig } from "@/types";

// ============================================================================
// Chat Service
// ============================================================================

/**
 * Service for chat orchestration logic
 */
export class ChatService {
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
    const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
    const languageModel = getLanguageModel(modelConfig);

    // Determine system prompt
    const systemPrompt = await this.resolveSystemPrompt(agent);

    // Calculate thinking state
    const isThinkingActive = modelConfig.supportsReasoning && thinkingEnabled;

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
   * Handle the finish of a chat stream
   */
  async onFinish(
    agentId: string,
    text: string,
    reasoning?: Array<{ text?: string }>
  ): Promise<ChatFinishResult> {
    try {
      // Save reasoning as a separate item if present
      if (reasoning && reasoning.length > 0) {
        const reasoningText = reasoning
          .filter((r) => r.text)
          .map((r) => r.text)
          .join("\n");

        if (reasoningText) {
          await insertItem(agentId, {
            type: "reasoning",
            reasoningContent: reasoningText,
            reasoningSummary: reasoningText.slice(0, 200) + (reasoningText.length > 200 ? "..." : ""),
          });
        }
      }

      // Save assistant message (only if there's text content)
      if (text) {
        await insertItem(agentId, {
          type: "message",
          role: "assistant",
          content: text,
        });
      }

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
        error: error instanceof Error ? error.message : "Failed to save chat results",
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
    db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .run();
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
