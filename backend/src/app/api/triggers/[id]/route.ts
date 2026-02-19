import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getTriggerService, getTriggerScheduler } from "@/lib/services";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/triggers/[id] - Get a single trigger with recent runs
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const service = getTriggerService();
  const trigger = await service.getById(id, userId);

  if (!trigger) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(trigger);
}

// PUT /api/triggers/[id] - Update a trigger
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const service = getTriggerService();
  const result = await service.update(id, body, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.trigger) {
    getTriggerScheduler().syncTrigger(result.trigger).catch(console.error);
  }

  return NextResponse.json(result.trigger);
}

// DELETE /api/triggers/[id] - Delete a trigger
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const service = getTriggerService();
  const result = await service.delete(id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  getTriggerScheduler().unscheduleTrigger(id).catch(console.error);

  return new NextResponse(null, { status: 204 });
}
