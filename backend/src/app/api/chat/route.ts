import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getChatService } from "@/lib/services";

// Generic chat endpoint that accepts sessionId in body
// This is needed because useChat transport doesn't properly switch URLs
// when sessionId changes - see: https://github.com/vercel/ai/issues/7819
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { sessionId, message, model: modelId, thinkingEnabled = true } = await request.json();

  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

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
