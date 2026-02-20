import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getSessionService } from "@/lib/services";
import { getItemRepository } from "@/lib/services/item/item.repository";
import type { PaginatedItemsResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id]/items?limit=20&before=<sequence>
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const sessionService = getSessionService();

  // Verify session exists and belongs to user
  const session = await sessionService.getById(id, userId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const rootAgentId = session.rootAgentId;
  if (!rootAgentId) {
    return NextResponse.json({ error: "Session has no root agent" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const beforeParam = request.nextUrl.searchParams.get("before");

  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  const before = beforeParam ? parseInt(beforeParam, 10) : undefined;

  const itemRepo = getItemRepository();
  const [items, totalCount] = await Promise.all([
    itemRepo.findByAgentIdPaginated(rootAgentId, { limit, before }),
    itemRepo.countByAgentId(rootAgentId),
  ]);

  const oldestSequence = items.length > 0 ? items[0].sequence : 0;
  const hasMore = oldestSequence > 0;

  const response: PaginatedItemsResponse = {
    items,
    totalCount,
    hasMore,
  };

  return NextResponse.json(response);
}
