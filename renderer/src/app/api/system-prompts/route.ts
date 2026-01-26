import { NextResponse } from "next/server";
import { db, systemPrompts } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Seed prompts to create on first access if table is empty
const SEED_PROMPTS = [
  {
    name: "Helpful Assistant",
    content:
      "You are a helpful, harmless, and honest AI assistant. You provide clear, accurate, and thoughtful responses to help users with their questions and tasks.",
  },
  {
    name: "Code Expert",
    content:
      "You are an expert programmer and software engineer. Help users write clean, efficient code, debug issues, explain concepts, and follow best practices. Always consider security, performance, and maintainability.",
  },
  {
    name: "Writing Assistant",
    content:
      "You are a skilled writer and editor. Help users improve their writing by offering suggestions for clarity, grammar, style, and structure. Adapt your tone and advice based on the context and audience of the writing.",
  },
];

// Ensure seed prompts exist
async function ensureSeedPrompts() {
  const existing = await db.select().from(systemPrompts);

  if (existing.length === 0) {
    for (const prompt of SEED_PROMPTS) {
      await db.insert(systemPrompts).values({
        id: uuidv4(),
        name: prompt.name,
        content: prompt.content,
      });
    }
  }
}

// GET /api/system-prompts - List all system prompts
export async function GET() {
  await ensureSeedPrompts();

  const results = await db
    .select()
    .from(systemPrompts)
    .orderBy(asc(systemPrompts.name));

  return NextResponse.json(results);
}

// POST /api/system-prompts - Create a new system prompt
export async function POST(req: Request) {
  const { name, content } = await req.json();

  if (!name || !content) {
    return NextResponse.json(
      { error: "Name and content are required" },
      { status: 400 }
    );
  }

  const newPrompt = {
    id: uuidv4(),
    name,
    content,
  };

  await db.insert(systemPrompts).values(newPrompt);

  const [created] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, newPrompt.id));

  return NextResponse.json(created || newPrompt, { status: 201 });
}
