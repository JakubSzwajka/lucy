import { getChatService } from "@/lib/services";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const { messages: chatMessages, model: modelId, thinkingEnabled = true } = await req.json();

  const chatService = getChatService();
  const result = await chatService.executeTurn(sessionId, chatMessages, { modelId, thinkingEnabled });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return result.stream.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
