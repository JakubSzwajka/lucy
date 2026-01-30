import { NextResponse } from "next/server";
import { getAgentService } from "@/lib/services";

// POST /api/agents - Create a new agent (usually a child agent)
export async function POST(req: Request) {
  const body = await req.json();
  const agentService = getAgentService();

  const result = agentService.create({
    sessionId: body.sessionId,
    parentId: body.parentId,
    sourceCallId: body.sourceCallId,
    name: body.name,
    task: body.task,
    systemPrompt: body.systemPrompt,
    model: body.model,
    config: body.config,
  });

  if (result.notFound) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.agent, { status: 201 });
}
