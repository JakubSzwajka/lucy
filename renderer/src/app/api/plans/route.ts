import { NextResponse } from "next/server";
import { getPlanService } from "@/lib/services";

// GET /api/plans?sessionId=xxx - Get plan for a session
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

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
