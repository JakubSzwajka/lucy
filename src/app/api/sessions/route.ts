import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getSessionService } from "@/lib/services";

// GET /api/sessions - List all sessions
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const sessionService = getSessionService();
  const sessions = await sessionService.getAll(userId);
  return NextResponse.json(sessions);
}

// POST /api/sessions - Create a new session with root agent
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json().catch(() => ({}));
  const sessionService = getSessionService();

  const result = await sessionService.create(userId, {
    title: body.title,
    agentName: body.agentName,
    systemPrompt: body.systemPrompt,
    model: body.model,
    agentConfigId: body.agentConfigId,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.session, { status: 201 });
}
