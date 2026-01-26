import { NextResponse } from "next/server";
import { db, agents, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// POST /api/agents - Create a new agent (usually a child agent)
export async function POST(req: Request) {
  const body = await req.json();
  const {
    sessionId,
    parentId,
    sourceCallId,
    name,
    task,
    systemPrompt,
    model,
    config,
  } = body;

  if (!sessionId || !name) {
    return NextResponse.json(
      { error: "sessionId and name are required" },
      { status: 400 }
    );
  }

  // Verify session exists
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const agentId = uuidv4();

  await db.insert(agents).values({
    id: agentId,
    sessionId,
    parentId: parentId || null,
    sourceCallId: sourceCallId || null,
    name,
    task: task || null,
    systemPrompt: systemPrompt || null,
    model: model || null,
    config: config || null,
    status: "pending",
  });

  const [created] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId));

  return NextResponse.json(created, { status: 201 });
}
