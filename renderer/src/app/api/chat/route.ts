import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import { db, agents, settings, systemPrompts, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { langfuseSpanProcessor } from "@/instrumentation";
import {
  getToolRegistry,
  initializeToolRegistry,
  getMcpProvider,
  insertItem,
} from "@/lib/tools";

// Fetch the default system prompt content if configured
async function getDefaultSystemPrompt(): Promise<string | null> {
  try {
    const [currentSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, "default"));

    if (!currentSettings?.defaultSystemPromptId) {
      return null;
    }

    const [prompt] = await db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.id, currentSettings.defaultSystemPromptId));

    return prompt?.content || null;
  } catch {
    return null;
  }
}

// Convert UIMessage format (with parts) to simple messages
function convertToModelMessages(chatMessages: unknown[]): Array<{ role: "user" | "assistant" | "system"; content: string }> {
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

export async function POST(req: Request) {
  const { messages: chatMessages, model: modelId, agentId, thinkingEnabled = true } = await req.json();

  if (!agentId) {
    return new Response(JSON.stringify({ error: "agentId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get agent and verify it exists
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId));

  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use model from request, agent config, or default
  const effectiveModelId = modelId || agent.model;
  const modelConfig = getModelConfig(effectiveModelId) || DEFAULT_MODEL;
  const languageModel = getLanguageModel(modelConfig);

  // Convert messages to the format expected by streamText
  const modelMessages = convertToModelMessages(chatMessages);

  // Determine system prompt: agent-specific > default > none
  let systemPromptContent = agent.systemPrompt;
  if (!systemPromptContent) {
    systemPromptContent = await getDefaultSystemPrompt();
  }

  if (systemPromptContent) {
    const hasSystemMessage = modelMessages.some((m) => m.role === "system");
    if (!hasSystemMessage) {
      modelMessages.unshift({
        role: "system",
        content: systemPromptContent,
      });
    }
  }

  // Update agent status to running
  await db
    .update(agents)
    .set({
      status: "running",
      startedAt: agent.startedAt || new Date(),
    })
    .where(eq(agents.id, agentId));

  // Update session timestamp
  await db
    .update(sessions)
    .set({ updatedAt: new Date() })
    .where(eq(sessions.id, agent.sessionId));

  // Build provider-specific options for reasoning/thinking
  const getProviderOptions = () => {
    // Skip if model doesn't support reasoning or thinking is disabled
    if (!modelConfig.supportsReasoning || !thinkingEnabled) return undefined;

    if (modelConfig.provider === "openai") {
      return {
        openai: {
          reasoningEffort: "medium" as const,
        },
      } as const;
    }

    if (modelConfig.provider === "anthropic") {
      return {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000, // Allow up to 10k tokens for thinking
          },
        },
      } as const;
    }

    return undefined;
  };

  // Determine if thinking is active for this request
  const isThinkingActive = modelConfig.supportsReasoning && thinkingEnabled;

  // Initialize tool registry and refresh MCP servers
  await initializeToolRegistry();
  const mcpProvider = getMcpProvider();
  if (mcpProvider) {
    await mcpProvider.refreshServers();
  }

  // Get all tools from the registry (MCP + builtin + any registered)
  const registry = getToolRegistry();
  const tools = await registry.toAiSdkTools({
    agentId,
    sessionId: agent.sessionId,
    // TODO: Add createChildAgent callback when implementing agent spawning
  });

  const hasTools = Object.keys(tools).length > 0;

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    // Include tools from registry (MCP + builtin)
    tools: hasTools ? tools : undefined,
    // Allow multi-step tool use (default is 1 step, increase if tools are available)
    stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
    // Anthropic extended thinking requires sufficient maxOutputTokens
    maxOutputTokens: modelConfig.provider === "anthropic" && isThinkingActive ? 16000 : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: getProviderOptions() as any,
    // Enable Langfuse telemetry for LLM observability
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        agentId,
        sessionId: agent.sessionId,
        modelId: effectiveModelId,
        provider: modelConfig.provider,
        thinkingEnabled,
        hasTools,
      },
    },
    onFinish: async ({ text, reasoning }) => {
      // Save reasoning as a separate item if present
      if (reasoning && reasoning.length > 0) {
        // Extract text from reasoning parts (type can be "reasoning" or "text")
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
      await db
        .update(agents)
        .set({
          status: "waiting", // Waiting for next user input
          turnCount: agent.turnCount + 1,
        })
        .where(eq(agents.id, agentId));

      // Flush Langfuse traces to ensure they're sent
      if (langfuseSpanProcessor) {
        await langfuseSpanProcessor.forceFlush();
      }
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
