import { NextResponse } from "next/server";
import { getAgentService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id] - Get agent with its items
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const agentService = getAgentService();

  const agent = agentService.getByIdWithItems(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

// PATCH /api/agents/[id] - Update agent status, result, etc.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const updates = await req.json();
  const agentService = getAgentService();

  const result = agentService.update(id, updates);

  if (result.notFound) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.agent);
}

// DELETE /api/agents/[id] - Delete an agent (cascades to items)
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const agentService = getAgentService();

  agentService.delete(id);
  return new NextResponse(null, { status: 204 });
}
