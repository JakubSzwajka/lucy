import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getTriggerService } from "@/lib/server/triggers";

// GET /api/triggers - List all triggers
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const service = getTriggerService();
  const triggers = await service.getAll(userId);
  return NextResponse.json(triggers);
}

// POST /api/triggers - Create a new trigger
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json().catch(() => ({}));
  const service = getTriggerService();
  const result = await service.create(body, userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.trigger, { status: 201 });
}
