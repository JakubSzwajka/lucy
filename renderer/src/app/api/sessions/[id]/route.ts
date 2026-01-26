import { NextResponse } from "next/server";
import { db, sessions, agents, items } from "@/lib/db";
import { eq, asc, isNull } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] - Get a session with its agents and items
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // Get all agents for this session
  const sessionAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.sessionId, id))
    .orderBy(asc(agents.createdAt));

  // Get all items for all agents in this session
  const agentIds = sessionAgents.map((a) => a.id);
  const allItems = agentIds.length > 0
    ? await db
        .select()
        .from(items)
        .where(
          // Get items for any agent in this session
          eq(items.agentId, sessionAgents[0]?.id) // Will be replaced with proper IN query
        )
        .orderBy(asc(items.sequence))
    : [];

  // For now, get items for each agent individually (simpler than building IN clause)
  const agentsWithItems = await Promise.all(
    sessionAgents.map(async (agent) => {
      const agentItems = await db
        .select()
        .from(items)
        .where(eq(items.agentId, agent.id))
        .orderBy(asc(items.sequence));

      return {
        ...agent,
        items: agentItems,
      };
    })
  );

  // Build agent tree (root agents and their children)
  const rootAgents = agentsWithItems.filter((a) => !a.parentId);
  const childAgents = agentsWithItems.filter((a) => a.parentId);

  function buildTree(agent: typeof agentsWithItems[0]): typeof agentsWithItems[0] & { children: typeof agentsWithItems } {
    const children = childAgents
      .filter((c) => c.parentId === agent.id)
      .map(buildTree);
    return { ...agent, children };
  }

  const agentTree = rootAgents.map(buildTree);

  return NextResponse.json({
    ...session,
    agents: agentTree,
  });
}

// DELETE /api/sessions/[id] - Delete a session (cascades to agents and items)
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;

  await db.delete(sessions).where(eq(sessions.id, id));

  return new NextResponse(null, { status: 204 });
}

// PATCH /api/sessions/[id] - Update session (title, status)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const updates = await req.json();

  const allowedFields = ["title", "status"];
  const filteredUpdates: Record<string, unknown> = { updatedAt: new Date() };

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }

  await db
    .update(sessions)
    .set(filteredUpdates)
    .where(eq(sessions.id, id));

  const [updated] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));

  return NextResponse.json(updated);
}
