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
import { EnvironmentContextService } from "./environment-context.service";
import { getAgentService } from "../agent";
import { getAgentConfigService } from "../agent-config";
import { getSessionService } from "../session";
import { getItemService } from "../item";
import { persistStepContent } from "./step-persistence.service";
import { startActiveObservation, propagateAttributes, updateActiveTrace } from "@langfuse/tracing";
import type { ChatContext, ChatPrepareOptions, ExecuteTurnOptions, ModelMessage, ChatFinishResult } from "./types";
import type { Agent, AgentConfigWithTools, ModelConfig } from "@/types";
import type { ToolFilter } from "@/lib/tools";
import type { ToolSource, DelegateToolSource } from "@/lib/tools/types";
import { generateDelegateTools } from "@/lib/tools/delegate";
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

    // Extract user input text for tracing
    const userInputText = (() => {
      if (!lastUserMessage) return undefined;
      if (typeof lastUserMessage.content === "string") return lastUserMessage.content;
      if (Array.isArray(lastUserMessage.parts)) {
        return (lastUserMessage.parts as Record<string, unknown>[])
          .filter((part) => part.type === "text")
          .map((part) => part.text as string)
          .join("");
      }
      return undefined;
    })();

    // Prepare chat context
    const context = await this.prepareChat(rootAgentId, userId, { modelId, thinkingEnabled });
    if (!context) {
      return { error: "Agent not found" as const, status: 404 as const };
    }

    // Convert and prepare messages
    const modelMessages = this.convertToModelMessages(chatMessages);
    const messagesWithSystem = this.prependSystemPrompt(modelMessages, context.systemPrompt);

    const hasTools = Object.keys(context.tools).length > 0;
    const agentName = context.agent.name || "assistant";

    // Stream AI response wrapped in a Langfuse agent observation for rich tracing
    return await startActiveObservation(agentName, async (span) => {
      updateActiveTrace({ name: agentName, input: userInputText });
      return await propagateAttributes({
        userId,
        sessionId,
        metadata: { agentId: rootAgentId, model: context.modelConfig.id, depth: "0" },
      }, async () => {
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
          onFinish: async ({ text }) => {
            span.update({ output: text || "completed" });
            updateActiveTrace({ output: text });
            await this.finalizeChat(rootAgentId, userId);
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: context.modelConfig.id,
            metadata: {
              sessionId,
              userId,
              agentId: rootAgentId,
              model: context.modelConfig.id,
              depth: 0,
            },
          },
        });

        span.update({ input: userInputText });
        return { stream: result };
      });
    }, { asType: "agent" });
  }

  async prepareChat(agentId: string, userId: string, options: ChatPrepareOptions = {}): Promise<ChatContext | null> {
    const { modelId, thinkingEnabled = true } = options;

    const agentService = getAgentService();
    const agent = await agentService.getById(agentId, userId);
    if (!agent) {
      return null;
    }

    // Load agent config for tool filtering and resolution
    let agentConfig: AgentConfigWithTools | null = null;
    if (agent.agentConfigId) {
      const agentConfigService = getAgentConfigService();
      agentConfig = await agentConfigService.getById(agent.agentConfigId, userId);
    }

    // Build tool filter from agent config
    let toolFilter: ToolFilter | undefined;
    if (agentConfig) {
      console.log(agentConfig.tools);
      const mcpServerIds = agentConfig.tools
        .filter(t => t.toolType === "mcp")
        .map(t => t.toolRef);
      const builtinModuleIds = agentConfig.tools
        .filter(t => t.toolType === "builtin")
        .map(t => t.toolRef);
      const delegateAgentIds = agentConfig.tools
        .filter(t => t.toolType === "delegate")
        .map(t => t.toolRef);

      toolFilter = {
        ...(mcpServerIds.length > 0 ? { allowedMcpServerIds: mcpServerIds } : {}),
        ...(builtinModuleIds.length > 0 ? { allowedBuiltinModuleIds: builtinModuleIds } : {}),
        ...(delegateAgentIds.length > 0 ? { allowedDelegateAgentIds: delegateAgentIds } : {}),
      };
    }

    const effectiveModelId = modelId || agent.model || agentConfig?.defaultModelId;
    if (!effectiveModelId) {
      throw new Error("No model ID provided");
    }
    const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
    const languageModel = getLanguageModel(modelConfig);

    let systemPrompt = await this.resolveSystemPrompt(agent, userId, agentConfig);

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
    }, toolFilter);

    // Add delegate tools if agent config has delegate entries
    if (agentConfig) {
      const delegateTools = await generateDelegateTools(agentConfig, agent.sessionId, userId, agentId);
      if (delegateTools.length > 0) {
        const { tool: aiTool } = await import("ai");
        for (const dt of delegateTools) {
          const key = `delegate__${dt.source.type === "delegate" ? dt.source.configId : "unknown"}__${dt.name}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tools as any)[key] = aiTool({
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

  async resolveSystemPrompt(agent: Agent, userId: string, agentConfig?: AgentConfigWithTools | null): Promise<string | null> {
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }

    if (agentConfig?.systemPromptOverride) {
      return agentConfig.systemPromptOverride;
    }
    if (agentConfig?.systemPromptId) {
      const systemPromptService = getSystemPromptService();
      const prompt = await systemPromptService.getById(agentConfig.systemPromptId, userId);
      if (prompt?.content) return prompt.content;
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

  async resolveToolsForAgent(agentId: string, userId: string): Promise<{ key: string; name: string; description: string; source: ToolSource }[]> {
    const agentService = getAgentService();
    const agent = await agentService.getById(agentId, userId);
    if (!agent) return [];

    let agentConfig: AgentConfigWithTools | null = null;
    if (agent.agentConfigId) {
      const agentConfigService = getAgentConfigService();
      agentConfig = await agentConfigService.getById(agent.agentConfigId, userId);
    }

    let toolFilter: ToolFilter | undefined;
    if (agentConfig) {
      const mcpServerIds = agentConfig.tools.filter(t => t.toolType === "mcp").map(t => t.toolRef);
      const builtinModuleIds = agentConfig.tools.filter(t => t.toolType === "builtin").map(t => t.toolRef);
      const delegateAgentIds = agentConfig.tools.filter(t => t.toolType === "delegate").map(t => t.toolRef);
      toolFilter = {
        ...(mcpServerIds.length > 0 ? { allowedMcpServerIds: mcpServerIds } : {}),
        ...(builtinModuleIds.length > 0 ? { allowedBuiltinModuleIds: builtinModuleIds } : {}),
        ...(delegateAgentIds.length > 0 ? { allowedDelegateAgentIds: delegateAgentIds } : {}),
      };
    }

    await initializeToolRegistry();
    const mcpProvider = getMcpProvider();
    if (mcpProvider) await mcpProvider.refreshServers();

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
        const key = `delegate__${dt.source.type === "delegate" ? (dt.source as DelegateToolSource).configId : "unknown"}__${dt.name}`;
        result.push({ key, name: dt.name, description: dt.description, source: dt.source });
      }
    }

    return result;
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
