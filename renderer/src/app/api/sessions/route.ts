import { NextResponse } from "next/server";
import { getSessionService } from "@/lib/services";

// GET /api/sessions - List all sessions
export async function GET() {
  const sessionService = getSessionService();
  const sessions = sessionService.getAll();
  return NextResponse.json(sessions);
}

// POST /api/sessions - Create a new session with root agent
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionService = getSessionService();

  const result = sessionService.create({
    title: body.title,
    agentName: body.agentName,
    systemPrompt: body.systemPrompt,
    model: body.model,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.session, { status: 201 });
}
