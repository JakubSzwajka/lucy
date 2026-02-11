import { NextResponse } from "next/server";
import { getPlanService } from "@/lib/services";

// GET /api/sessions/[id]/plans - Get plan for a session
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const planService = getPlanService();
  const plan = planService.getBySessionId(sessionId);

  if (!plan) {
    return NextResponse.json({ plan: null });
  }

  const progress = planService.getProgress(plan.id);

  return NextResponse.json({
    plan: {
      ...plan,
      progress,
    },
  });
}
