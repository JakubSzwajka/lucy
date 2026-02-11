import { NextResponse } from "next/server";
import { getSessionService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] - Get a session with its agents and items
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const sessionService = getSessionService();

  const session = sessionService.getWithAgents(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

// DELETE /api/sessions/[id] - Delete a session (cascades to agents and items)
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const sessionService = getSessionService();

  sessionService.delete(id);
  return new NextResponse(null, { status: 204 });
}

// PATCH /api/sessions/[id] - Update session (title, status)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const updates = await req.json();
  const sessionService = getSessionService();

  const result = sessionService.update(id, {
    title: updates.title,
    status: updates.status,
  });

  if (result.notFound) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(result.session);
}
