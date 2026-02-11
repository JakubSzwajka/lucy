import { NextResponse } from "next/server";
import { getSystemPromptService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/system-prompts/[id] - Get a single system prompt
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const systemPromptService = getSystemPromptService();

  const prompt = systemPromptService.getById(id);

  if (!prompt) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return NextResponse.json(prompt);
}

// PATCH /api/system-prompts/[id] - Update a system prompt
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();
  const systemPromptService = getSystemPromptService();

  const result = systemPromptService.update(id, {
    name: body.name,
    content: body.content,
  });

  if (result.notFound) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result.prompt);
}

// DELETE /api/system-prompts/[id] - Delete a system prompt
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const systemPromptService = getSystemPromptService();

  const result = systemPromptService.delete(id);

  if (result.notFound) {
    return NextResponse.json({ error: "System prompt not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
