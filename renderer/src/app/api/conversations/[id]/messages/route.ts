import { NextResponse } from "next/server";
import { db, messages, conversations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id]/messages - Get all messages for a conversation
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  return NextResponse.json(conversationMessages);
}

// POST /api/conversations/[id]/messages - Add a message to a conversation
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { role, content, model } = await req.json();

  const newMessage = {
    id: uuidv4(),
    conversationId: id,
    role,
    content,
    model,
  };

  await db.insert(messages).values(newMessage);

  // Update conversation's updatedAt timestamp
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, id));

  // Auto-generate title from first user message if conversation has default title
  if (role === "user") {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (conversation && conversation.title === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await db
        .update(conversations)
        .set({ title })
        .where(eq(conversations.id, id));
    }
  }

  return NextResponse.json(newMessage, { status: 201 });
}
