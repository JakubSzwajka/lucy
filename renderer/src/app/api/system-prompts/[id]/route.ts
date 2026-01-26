import { NextResponse } from "next/server";
import { db, systemPrompts, settings } from "@/lib/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/system-prompts/[id] - Get a single system prompt
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const [prompt] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id));

  if (!prompt) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return NextResponse.json(prompt);
}

// PATCH /api/system-prompts/[id] - Update a system prompt
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id));

  if (!existing) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  const updateData: Partial<typeof systemPrompts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.name !== undefined) {
    updateData.name = body.name;
  }

  if (body.content !== undefined) {
    updateData.content = body.content;
  }

  await db
    .update(systemPrompts)
    .set(updateData)
    .where(eq(systemPrompts.id, id));

  const [updated] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id));

  return NextResponse.json(updated);
}

// DELETE /api/system-prompts/[id] - Delete a system prompt
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id));

  if (!existing) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  // If this prompt is the default, clear the default setting
  const [currentSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, "default"));

  if (currentSettings?.defaultSystemPromptId === id) {
    await db
      .update(settings)
      .set({ defaultSystemPromptId: null, updatedAt: new Date() })
      .where(eq(settings.id, "default"));
  }

  // Delete the prompt
  await db.delete(systemPrompts).where(eq(systemPrompts.id, id));

  return new NextResponse(null, { status: 204 });
}
