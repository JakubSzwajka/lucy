import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getTriggerService } from "@/lib/server/triggers";

type RouteContext = { params: Promise<{ id: string; runId: string }> };

// POST /api/triggers/[id]/runs/[runId]/cancel - Cancel a running trigger execution
export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id, runId } = await context.params;

  const service = getTriggerService();
  const result = await service.cancelRun(runId, id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
