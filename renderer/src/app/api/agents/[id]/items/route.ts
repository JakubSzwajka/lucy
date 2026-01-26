import { NextResponse } from "next/server";
import { db, agents, items, sessions, NewItem } from "@/lib/db";
import { eq, asc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/items - Get all items for an agent
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const agentItems = await db
    .select()
    .from(items)
    .where(eq(items.agentId, id))
    .orderBy(asc(items.sequence));

  return NextResponse.json(agentItems);
}

// POST /api/agents/[id]/items - Add an item to an agent's thread
export async function POST(req: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const body = await req.json();

  // Verify agent exists
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId));

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  // Get next sequence number
  const [maxSeq] = await db
    .select({ max: sql<number>`MAX(${items.sequence})` })
    .from(items)
    .where(eq(items.agentId, agentId));

  const nextSequence = (maxSeq?.max ?? -1) + 1;

  const { type } = body;

  if (!type) {
    return NextResponse.json(
      { error: "type is required" },
      { status: 400 }
    );
  }

  // Build item based on type
  const itemId = uuidv4();

  let itemData: NewItem;

  switch (type) {
    case "message":
      if (!body.role || !body.content) {
        return NextResponse.json(
          { error: "message type requires role and content" },
          { status: 400 }
        );
      }
      itemData = {
        id: itemId,
        agentId,
        sequence: nextSequence,
        type: "message",
        role: body.role,
        content: body.content,
      };
      break;

    case "tool_call":
      if (!body.callId || !body.toolName) {
        return NextResponse.json(
          { error: "tool_call type requires callId and toolName" },
          { status: 400 }
        );
      }
      itemData = {
        id: itemId,
        agentId,
        sequence: nextSequence,
        type: "tool_call",
        callId: body.callId,
        toolName: body.toolName,
        toolArgs: body.toolArgs || null,
        toolStatus: body.toolStatus || "pending",
      };
      break;

    case "tool_result":
      if (!body.callId) {
        return NextResponse.json(
          { error: "tool_result type requires callId" },
          { status: 400 }
        );
      }
      itemData = {
        id: itemId,
        agentId,
        sequence: nextSequence,
        type: "tool_result",
        callId: body.callId,
        toolOutput: body.toolOutput || null,
        toolError: body.toolError || null,
      };
      break;

    case "reasoning":
      if (!body.reasoningContent) {
        return NextResponse.json(
          { error: "reasoning type requires reasoningContent" },
          { status: 400 }
        );
      }
      itemData = {
        id: itemId,
        agentId,
        sequence: nextSequence,
        type: "reasoning",
        reasoningSummary: body.reasoningSummary || null,
        reasoningContent: body.reasoningContent,
      };
      break;

    default:
      return NextResponse.json(
        { error: `Unknown item type: ${type}` },
        { status: 400 }
      );
  }

  await db.insert(items).values(itemData);

  // Update session's updatedAt timestamp
  await db
    .update(sessions)
    .set({ updatedAt: new Date() })
    .where(eq(sessions.id, agent.sessionId));

  // Auto-generate session title from first user message if still "New Chat"
  if (type === "message" && body.role === "user") {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, agent.sessionId));

    if (session && session.title === "New Chat") {
      const content = body.content as string;
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await db
        .update(sessions)
        .set({ title })
        .where(eq(sessions.id, agent.sessionId));
    }
  }

  const [created] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId));

  return NextResponse.json(created, { status: 201 });
}
