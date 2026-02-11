import { NextResponse } from "next/server";
import { getSystemPromptService } from "@/lib/services";

// GET /api/system-prompts - List all system prompts
export async function GET() {
  const systemPromptService = getSystemPromptService();
  const prompts = systemPromptService.getAll();
  return NextResponse.json(prompts);
}

// POST /api/system-prompts - Create a new system prompt
export async function POST(req: Request) {
  const { name, content } = await req.json();
  const systemPromptService = getSystemPromptService();

  const result = systemPromptService.create({ name, content });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.prompt, { status: 201 });
}
