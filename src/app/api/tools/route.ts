import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getToolRegistry, initializeToolRegistry } from "@/lib/server/tools";
import { getChatService } from "@/lib/server/services/chat/chat.service";
import { getSessionService } from "@/lib/server/services/session";

/**
 * GET /api/tools
 * List registered tools. Optionally pass ?sessionId=xxx to resolve
 * session-specific tools (filtered by agent config + delegate tools).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (sessionId) {
    const sessionService = getSessionService();
    const session = await sessionService.getById(sessionId, userId);
    if (!session || !session.rootAgentId) {
      return NextResponse.json({ tools: [] });
    }

    const chatService = getChatService();
    const tools = await chatService.resolveToolsForAgent(session.rootAgentId, userId);
    return NextResponse.json({ tools });
  }

  // Fallback: return all tools unfiltered
  await initializeToolRegistry();
  const registry = getToolRegistry();
  const allTools = await registry.getAllTools();

  const tools = allTools.map(({ key, definition }) => ({
    key,
    name: definition.name,
    description: definition.description,
    source: definition.source,
  }));

  return NextResponse.json({ tools });
}
