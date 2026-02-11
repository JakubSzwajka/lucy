import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getExtractionService } from "@/lib/memory/extraction.service";

// POST /api/memories/extract/confirm - Save approved extraction results
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json();

  if (!body.sessionId || !body.approvedMemories || !body.approvedQuestions) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, approvedMemories, approvedQuestions" },
      { status: 400 }
    );
  }

  try {
    const service = getExtractionService();
    const result = await service.confirm(userId, {
      sessionId: body.sessionId,
      approvedMemories: body.approvedMemories,
      approvedQuestions: body.approvedQuestions,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
