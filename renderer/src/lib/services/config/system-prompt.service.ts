import { db, systemPrompts, SystemPromptRecord } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSettingsService } from "./settings.service";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

// ============================================================================
// System Prompt Service
// ============================================================================

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

/**
 * Parse system prompt record
 */
function parseSystemPromptRecord(record: SystemPromptRecord): SystemPrompt {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Service for system prompt business logic
 */
export class SystemPromptService {
  /**
   * Ensure seed prompts exist
   */
  ensureSeedPrompts(): void {
    const existing = db.select().from(systemPrompts).all();

    if (existing.length === 0) {
      for (const prompt of SEED_PROMPTS) {
        db.insert(systemPrompts).values({
          id: uuidv4(),
          name: prompt.name,
          content: prompt.content,
        }).run();
      }
    }
  }

  /**
   * Get all system prompts
   */
  getAll(): SystemPrompt[] {
    this.ensureSeedPrompts();

    const records = db
      .select()
      .from(systemPrompts)
      .orderBy(asc(systemPrompts.name))
      .all();

    return records.map(parseSystemPromptRecord);
  }

  /**
   * Get a system prompt by ID
   */
  getById(id: string): SystemPrompt | null {
    const [record] = db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.id, id))
      .all();

    return record ? parseSystemPromptRecord(record) : null;
  }

  /**
   * Create a new system prompt
   */
  create(data: SystemPromptCreate): { prompt?: SystemPrompt; error?: string } {
    if (!data.name || !data.content) {
      return { error: "Name and content are required" };
    }

    const id = uuidv4();

    db.insert(systemPrompts).values({
      id,
      name: data.name,
      content: data.content,
    }).run();

    return { prompt: this.getById(id)! };
  }

  /**
   * Update a system prompt
   */
  update(id: string, data: SystemPromptUpdate): { prompt?: SystemPrompt; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { notFound: true };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    db.update(systemPrompts)
      .set(updateData)
      .where(eq(systemPrompts.id, id))
      .run();

    return { prompt: this.getById(id)! };
  }

  /**
   * Delete a system prompt
   */
  delete(id: string): { success: boolean; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, notFound: true };
    }

    // If this prompt is the default, clear the default setting
    const settingsService = getSettingsService();
    settingsService.clearDefaultSystemPrompt(id);

    // Delete the prompt
    db.delete(systemPrompts).where(eq(systemPrompts.id, id)).run();

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
