import { NextResponse } from "next/server";
import { db, conversations } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// GET /api/conversations - List all conversations
export async function GET() {
  const results = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt));

  return NextResponse.json(results);
}

// POST /api/conversations - Create a new conversation
export async function POST(req: Request) {
  const { title } = await req.json();

  const newConversation = {
    id: uuidv4(),
    title: title || "New Chat",
  };

  await db.insert(conversations).values(newConversation);

  const [created] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, newConversation.id));

  return NextResponse.json(created || newConversation, { status: 201 });
}
