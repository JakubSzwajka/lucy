import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getChatService } from "@/lib/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id: sessionId } = await params;
  const { message, model: modelId, thinkingEnabled = true } = await request.json();

  if (!message || typeof message.content !== "string") {
    return Response.json({ error: "message with content is required" }, { status: 400 });
  }

  const chatService = getChatService();
  const result = await chatService.executeTurn(sessionId, userId, message, { modelId, thinkingEnabled });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return result.stream.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
