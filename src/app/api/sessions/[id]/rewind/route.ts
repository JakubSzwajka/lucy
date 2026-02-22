import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getItemService } from "@/lib/server/domain/item";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id: sessionId } = await params;
  const { itemId, newContent } = await request.json();

  if (!itemId || typeof itemId !== "string") {
    return Response.json({ error: "itemId is required" }, { status: 400 });
  }
  if (!newContent || typeof newContent !== "string") {
    return Response.json({ error: "newContent is required" }, { status: 400 });
  }

  const itemService = getItemService();
  const rewindResult = await itemService.rewindToItem(itemId, newContent, userId);

  if ("error" in rewindResult) {
    return Response.json({ error: rewindResult.error }, { status: rewindResult.status });
  }

  return Response.json({ success: true, agentId: rewindResult.agentId });
}
