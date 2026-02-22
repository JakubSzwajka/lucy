import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getTriggerService } from "@/lib/server/triggers";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/triggers/[id]/test - Manually fire a trigger
export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const service = getTriggerService();
  const trigger = await service.getById(id, userId);

  if (!trigger) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await service.execute(id);
    return NextResponse.json({
      success: true,
      runId: result.runId,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error("Trigger execution failed:", error);
    return NextResponse.json(
      { error: "Trigger execution failed" },
      { status: 500 }
    );
  }
}
