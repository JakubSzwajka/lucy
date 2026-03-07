import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getSessionService } from "@/lib/server/sessions";
import { getPlanService } from "@/lib/server/plans";

// GET /api/sessions/[id]/plans - Get plan for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id: sessionId } = await params;

  // Verify session ownership
  const sessionService = getSessionService();
  const session = await sessionService.getById(sessionId, userId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const planService = getPlanService();
  const plan = await planService.getBySessionId(sessionId, userId);

  if (!plan) {
    return NextResponse.json({ plan: null });
  }

  const progress = await planService.getProgress(plan.id, userId);

  return NextResponse.json({
    plan: {
      ...plan,
      progress,
    },
  });
}
