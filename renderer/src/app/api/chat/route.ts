import { streamText, stepCountIs, ToolSet } from "ai";
import { getChatService } from "@/lib/services";
import { persistStepContent } from "@/lib/services/chat/step-persistence.service";

export async function POST(req: Request) {
  const { messages: chatMessages, model: modelId, agentId, thinkingEnabled = true } = await req.json();

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  const chatService = getChatService();

  // Prepare chat context
  const context = await chatService.prepareChat(agentId, { modelId, thinkingEnabled });

  if (!context) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  // Convert and prepare messages
  const modelMessages = chatService.convertToModelMessages(chatMessages);
  const messagesWithSystem = chatService.prependSystemPrompt(modelMessages, context.systemPrompt);

  const hasTools = Object.keys(context.tools).length > 0;

  const result = streamText({
    model: context.languageModel,
    messages: messagesWithSystem,
    tools: hasTools ? context.tools as ToolSet : undefined,
    stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
    maxOutputTokens: context.maxOutputTokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: context.providerOptions as any,
    // Persist each step's content in correct interleaved order
    onStepFinish: async ({ content, reasoning }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await persistStepContent(agentId, content as any[], reasoning);
    },
    // Only update agent status on finish
    onFinish: async () => {
      await chatService.finalizeChat(agentId);
    },
    experimental_telemetry: {
      isEnabled: true,
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
