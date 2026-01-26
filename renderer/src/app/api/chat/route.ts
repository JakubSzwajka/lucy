import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import { db, agents, items, settings, systemPrompts, sessions, NewItem } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    // Anthropic extended thinking requires sufficient maxOutputTokens
    maxOutputTokens: modelConfig.provider === "anthropic" && isThinkingActive ? 16000 : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: getProviderOptions() as any,
    onFinish: async ({ text, reasoning }) => {
      // Save reasoning as a separate item if present
      // reasoning is an array of ReasoningPart objects
      if (reasoning && reasoning.length > 0) {
        const reasoningText = reasoning.map((r) => r.text).join("\n");
        await insertItem(agentId, {
          type: "reasoning",
          reasoningContent: reasoningText,
          reasoningSummary: reasoningText.slice(0, 200) + (reasoningText.length > 200 ? "..." : ""),
        });
      }

      // Save assistant message
      await insertItem(agentId, {
        type: "message",
        role: "assistant",
        content: text,
      });

      // Update agent status and turn count
      await db
        .update(agents)
        .set({
          status: "waiting", // Waiting for next user input
          turnCount: agent.turnCount + 1,
        })
        .where(eq(agents.id, agentId));
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
