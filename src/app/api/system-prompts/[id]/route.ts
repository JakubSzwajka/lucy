import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getSystemPromptService } from "@/lib/server/domain/config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/system-prompts/[id] - Get a single system prompt
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const systemPromptService = getSystemPromptService();

  const prompt = await systemPromptService.getById(id, userId);

  if (!prompt) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return NextResponse.json(prompt);
}

// PATCH /api/system-prompts/[id] - Update a system prompt
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const body = await request.json();
  const systemPromptService = getSystemPromptService();

  const result = await systemPromptService.update(id, {
    name: body.name,
    content: body.content,
  }, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result.prompt);
}

// DELETE /api/system-prompts/[id] - Delete a system prompt
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const systemPromptService = getSystemPromptService();

  const result = await systemPromptService.delete(id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
