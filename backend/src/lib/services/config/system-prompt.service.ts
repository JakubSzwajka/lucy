import { db } from "@/lib/db";
import { systemPrompts } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSettingsService } from "./settings.service";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

// ============================================================================
// System Prompt Service
// ============================================================================

// Seed prompts to create on first access if storage is empty
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

function parseRecord(record: typeof systemPrompts.$inferSelect): SystemPrompt {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SystemPromptService {
  private ensureSeedPrompts(userId: string): void {
    const existing = db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.userId, userId))
      .all();

    if (existing.length > 0) return;

    for (const seed of SEED_PROMPTS) {
      const now = new Date();
      db.insert(systemPrompts).values({
        id: uuidv4(),
        userId,
        name: seed.name,
        content: seed.content,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  getAll(userId: string): SystemPrompt[] {
    this.ensureSeedPrompts(userId);
    const records = db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.userId, userId))
      .orderBy(asc(systemPrompts.name))
      .all();
    return records.map(parseRecord);
  }

  getById(id: string, userId: string): SystemPrompt | null {
    this.ensureSeedPrompts(userId);
    const [record] = db
      .select()
      .from(systemPrompts)
      .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)))
      .all();
    return record ? parseRecord(record) : null;
  }

  create(data: SystemPromptCreate, userId: string): { prompt?: SystemPrompt; error?: string } {
    if (!data.name || !data.content) {
      return { error: "Name and content are required" };
    }

    this.ensureSeedPrompts(userId);

    const now = new Date();
    const id = uuidv4();

    db.insert(systemPrompts).values({
      id,
      userId,
      name: data.name,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    }).run();

    return { prompt: this.getById(id, userId)! };
  }

  update(id: string, data: SystemPromptUpdate, userId: string): { prompt?: SystemPrompt; notFound?: boolean } {
    this.ensureSeedPrompts(userId);

    const existing = this.getById(id, userId);
    if (!existing) {
      return { notFound: true };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) updateData.content = data.content;

    db.update(systemPrompts)
      .set(updateData)
      .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)))
      .run();

    return { prompt: this.getById(id, userId)! };
  }

  delete(id: string, userId: string): { success: boolean; notFound?: boolean } {
    this.ensureSeedPrompts(userId);

    const existing = this.getById(id, userId);
    if (!existing) {
      return { success: false, notFound: true };
    }

    // If this prompt is the default, clear the default setting
    const settingsService = getSettingsService();
    settingsService.clearDefaultSystemPrompt(id, userId);

    db.delete(systemPrompts).where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId))).run();

    return { success: true };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SystemPromptService | null = null;

export function getSystemPromptService(): SystemPromptService {
  if (!instance) {
    instance = new SystemPromptService();
  }
  return instance;
}
