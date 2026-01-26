import { NextResponse } from "next/server";
import { db, sessions, agents } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// GET /api/sessions - List all sessions
export async function GET() {
  const results = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.updatedAt));

  return NextResponse.json(results);
}

// POST /api/sessions - Create a new session with root agent
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { title, agentName, systemPrompt, model } = body;

  const sessionId = uuidv4();
  const agentId = uuidv4();

  // Create session
  await db.insert(sessions).values({
    id: sessionId,
    title: title || "New Chat",
    rootAgentId: agentId,
  });

  // Create root agent for the session
  await db.insert(agents).values({
    id: agentId,
    sessionId,
    name: agentName || "assistant",
    systemPrompt: systemPrompt || null,
    model: model || null,
    status: "pending",
  });

  const [created] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  return NextResponse.json(created, { status: 201 });
}
