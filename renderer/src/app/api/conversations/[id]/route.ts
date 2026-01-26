import { NextResponse } from "next/server";
import { db, conversations, messages } from "@/lib/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id] - Get a single conversation with messages
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  return NextResponse.json({
    ...conversation,
    messages: conversationMessages,
  });
}

// DELETE /api/conversations/[id] - Delete a conversation
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;

  await db.delete(conversations).where(eq(conversations.id, id));

  return new NextResponse(null, { status: 204 });
}

// PATCH /api/conversations/[id] - Update conversation (e.g., title)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const { title } = await req.json();

  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id));

  const [updated] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  return NextResponse.json(updated);
}
