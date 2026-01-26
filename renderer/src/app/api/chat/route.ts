import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import { db, agents, items, settings, systemPrompts, sessions, mcpServers, NewItem } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getGlobalPool, ensureServersConnected, executeToolCall } from "@/lib/mcp";
import { langfuseSpanProcessor } from "@/instrumentation";
import type { McpServer } from "@/types";

// Parse JSON fields from MCP server record
function parseServerRecord(record: typeof mcpServers.$inferSelect): McpServer {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    transportType: record.transportType,
    command: record.command,
    args: record.args ? JSON.parse(record.args) : null,
    env: record.env ? JSON.parse(record.env) : null,
    url: record.url,
    headers: record.headers ? JSON.parse(record.headers) : null,
    requireApproval: record.requireApproval,
    enabled: record.enabled,
    iconUrl: record.iconUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

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

// Get next sequence number for an agent
async function getNextSequence(agentId: string): Promise<number> {
  const [maxSeq] = await db
    .select({ max: sql<number>`MAX(${items.sequence})` })
    .from(items)
    .where(eq(items.agentId, agentId));

  return (maxSeq?.max ?? -1) + 1;
}

// Insert an item with auto-incrementing sequence
async function insertItem(agentId: string, itemData: Omit<NewItem, "id" | "agentId" | "sequence">) {
  const sequence = await getNextSequence(agentId);
  const id = uuidv4();

  await db.insert(items).values({
    id,
    agentId,
    sequence,
    ...itemData,
  } as NewItem);

  return { id, sequence };
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

  // Fetch all enabled MCP servers and ensure they're connected
  const enabledServerRecords = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.enabled, true));

  const enabledServers = enabledServerRecords.map(parseServerRecord);
  await ensureServersConnected(enabledServers);

  // Build MCP tools from global pool
  const mcpPool = getGlobalPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpTools: Record<string, any> = {};

  // Convert MCP tools to AI SDK tool format
  for (const wrapper of Array.from(mcpPool.getConnectedServerIds()).map(id => mcpPool.getClient(id)).filter(Boolean)) {
    if (!wrapper) continue;

    for (const mcpTool of wrapper.tools) {
      const toolKey = `${wrapper.serverId}__${mcpTool.name}`;
      const serverConfig = mcpPool.getServerConfig(wrapper.serverId);

      mcpTools[toolKey] = tool({
        description: mcpTool.description || `Tool: ${mcpTool.name}`,
        inputSchema: z.object({}).passthrough(),
        execute: async (args) => {
          const callId = uuidv4();
          const startTime = Date.now();

          // Save tool_call item
          await insertItem(agentId, {
            type: "tool_call",
            callId,
            toolName: mcpTool.name,
            toolArgs: args as Record<string, unknown>,
            toolStatus: "running",
          });

          try {
            // Check if approval is required (for now, we skip approval and execute directly)
            // TODO: Implement approval flow in Phase 7
            if (serverConfig?.requireApproval) {
              // For now, just log that approval would be required
              console.log(`[MCP] Tool ${mcpTool.name} requires approval (not implemented yet)`);
            }

            const result = await executeToolCall(wrapper, mcpTool.name, args as Record<string, unknown>);
            const executionTime = Date.now() - startTime;

            // Save tool_result item
            await insertItem(agentId, {
              type: "tool_result",
              callId,
              toolOutput: result.success ? JSON.stringify(result.result) : undefined,
              toolError: result.error,
            });

            // Update tool_call status
            await db
              .update(items)
              .set({ toolStatus: result.success ? "completed" : "failed" })
              .where(eq(items.callId, callId));

            console.log(`[MCP] Tool ${mcpTool.name} executed in ${executionTime}ms`);

            if (!result.success) {
              return { error: result.error };
            }
            return result.result;
          } catch (error) {
            // Save error result
            await insertItem(agentId, {
              type: "tool_result",
              callId,
              toolError: error instanceof Error ? error.message : "Unknown error",
            });

            // Update tool_call status
            await db
              .update(items)
              .set({ toolStatus: "failed" })
              .where(eq(items.callId, callId));

            return { error: error instanceof Error ? error.message : "Tool execution failed" };
          }
        },
      });
    }
  }

  const hasTools = Object.keys(mcpTools).length > 0;

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    // Include MCP tools if any are available
    tools: hasTools ? mcpTools : undefined,
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
