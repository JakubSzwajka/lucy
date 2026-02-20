import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getSessionService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] - Get a session with its agents and items
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const sessionService = getSessionService();

  const itemsLimitParam = request.nextUrl.searchParams.get("itemsLimit");
  const itemsLimit = itemsLimitParam ? parseInt(itemsLimitParam, 10) : undefined;

  const session = await sessionService.getWithAgents(id, userId, itemsLimit);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

// DELETE /api/sessions/[id] - Delete a session (cascades to agents and items)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const sessionService = getSessionService();

  await sessionService.delete(id, userId);
  return new NextResponse(null, { status: 204 });
}

// PATCH /api/sessions/[id] - Update session (title, status)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const updates = await request.json();
  const sessionService = getSessionService();

  const result = await sessionService.update(id, {
    title: updates.title,
    status: updates.status,
    isPinned: updates.isPinned,
  }, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(result.session);
}
