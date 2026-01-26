import { NextResponse } from "next/server";
import { db, agents, items } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id] - Get agent with its items
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id));

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  const agentItems = await db
    .select()
    .from(items)
    .where(eq(items.agentId, id))
    .orderBy(asc(items.sequence));

  return NextResponse.json({
    ...agent,
    items: agentItems,
  });
}

// PATCH /api/agents/[id] - Update agent status, result, etc.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const updates = await req.json();

  const allowedFields = [
    "status",
    "waitingForCallId",
    "result",
    "error",
    "turnCount",
    "startedAt",
    "completedAt",
  ];

  const filteredUpdates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  await db
    .update(agents)
    .set(filteredUpdates)
    .where(eq(agents.id, id));

  const [updated] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id));

  return NextResponse.json(updated);
}

// DELETE /api/agents/[id] - Delete an agent (cascades to items)
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;

  await db.delete(agents).where(eq(agents.id, id));

  return new NextResponse(null, { status: 204 });
}
