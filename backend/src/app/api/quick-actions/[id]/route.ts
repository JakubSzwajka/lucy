import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getQuickActionService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/quick-actions/[id] - Get a single quick action
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const service = getQuickActionService();
  const action = service.getById(id, userId);

  if (!action) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  return NextResponse.json(action);
}

// PATCH /api/quick-actions/[id] - Update a quick action
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const body = await request.json();
  const service = getQuickActionService();

  const result = service.update(id, {
    name: body.name,
    content: body.content,
    icon: body.icon,
    sortOrder: body.sortOrder,
    enabled: body.enabled,
  }, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.action);
}

// DELETE /api/quick-actions/[id] - Delete a quick action
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const service = getQuickActionService();

  const result = service.delete(id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
