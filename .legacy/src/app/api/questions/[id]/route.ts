import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getQuestionService } from "@/lib/server/memory";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { questions, questionMemoryLinks, memories } from "@/lib/server/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/questions/[id] - Get a single question with linked memories
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;

  const rows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const question = rows[0];

  // Fetch linked memories
  const links = await db
    .select({
      linkType: questionMemoryLinks.linkType,
      memoryId: questionMemoryLinks.memoryId,
      memoryContent: memories.content,
      memoryType: memories.type,
    })
    .from(questionMemoryLinks)
    .innerJoin(memories, eq(questionMemoryLinks.memoryId, memories.id))
    .where(eq(questionMemoryLinks.questionId, id));

  return NextResponse.json({ ...question, linkedMemories: links });
}

// PATCH /api/questions/[id] - Resolve a question
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const body = await request.json();

  if (!body.answer) {
    return NextResponse.json(
      { error: "Missing required field: answer" },
      { status: 400 },
    );
  }

  const questionService = getQuestionService();

  try {
    const resolved = await questionService.resolve(userId, id, {
      answer: body.answer,
      answeringMemoryId: body.answeringMemoryId,
    });
    return NextResponse.json(resolved);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve question";
    if (message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/questions/[id] - Delete a question
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const questionService = getQuestionService();

  await questionService.delete(userId, id);
  return new NextResponse(null, { status: 204 });
}
