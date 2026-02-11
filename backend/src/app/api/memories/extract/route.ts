import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getExtractionService } from "@/lib/memory/extraction.service";

// POST /api/memories/extract - Trigger extraction from a session
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json();

  if (!body.sessionId) {
    return NextResponse.json(
      { error: "Missing required field: sessionId" },
      { status: 400 }
    );
  }

  try {
    const service = getExtractionService();
    const result = await service.extract(userId, body.sessionId, {
      model: body.model,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
