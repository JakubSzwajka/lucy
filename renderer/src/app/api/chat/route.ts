import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig, DEFAULT_MODEL } from "@/lib/ai/models";
import { db, messages, settings, systemPrompts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Fetch the default system prompt content if configured
async function getSystemPrompt(): Promise<string | null> {
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

// Convert UIMessage format (with parts) to ModelMessage format (with content)
function convertToModelMessages(chatMessages: any[]) {
  return chatMessages.map((msg) => {
    // Extract text content from parts array if present
    let content = msg.content;
    if (!content && Array.isArray(msg.parts)) {
      content = msg.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("");
    }
    return {
      role: msg.role,
      content: content || "",
    };
  });
}

export async function POST(req: Request) {
  const { messages: chatMessages, model: modelId, conversationId } = await req.json();

  const modelConfig = getModelConfig(modelId) || DEFAULT_MODEL;
  const languageModel = getLanguageModel(modelConfig);

  // Convert messages to the format expected by streamText
  const modelMessages = convertToModelMessages(chatMessages);

  // Prepend system prompt if configured
  const systemPromptContent = await getSystemPrompt();
  if (systemPromptContent) {
    // Only add if there isn't already a system message
    const hasSystemMessage = modelMessages.some((m: { role: string }) => m.role === "system");
    if (!hasSystemMessage) {
      modelMessages.unshift({
        role: "system",
        content: systemPromptContent,
      });
    }
  }

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    providerOptions: modelConfig.supportsReasoning
      ? {
          openai: {
            reasoningEffort: "medium",
          },
        }
      : undefined,
    onFinish: async ({ text, reasoning }) => {
      // Save assistant message to database
      if (conversationId) {
        await db.insert(messages).values({
          id: uuidv4(),
          conversationId,
          role: "assistant",
          content: text,
          model: modelConfig.id,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
