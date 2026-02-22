import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getSystemPromptService } from "@/lib/server/domain/config";

// GET /api/system-prompts - List all system prompts
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const systemPromptService = getSystemPromptService();
  const prompts = await systemPromptService.getAll(userId);
  return NextResponse.json(prompts);
}

// POST /api/system-prompts - Create a new system prompt
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { name, content } = await request.json();
  const systemPromptService = getSystemPromptService();

  const result = await systemPromptService.create({ name, content }, userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.prompt, { status: 201 });
}
