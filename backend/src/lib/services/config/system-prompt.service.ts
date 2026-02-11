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
  async getAll(userId: string): Promise<SystemPrompt[]> {
    const records = await db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.userId, userId))
      .orderBy(asc(systemPrompts.name));
    return records.map(parseRecord);
  }

  async getById(id: string, userId: string): Promise<SystemPrompt | null> {
    const [record] = await db
      .select()
      .from(systemPrompts)
      .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)));
    return record ? parseRecord(record) : null;
  }

  async create(data: SystemPromptCreate, userId: string): Promise<{ prompt?: SystemPrompt; error?: string }> {
    if (!data.name || !data.content) {
      return { error: "Name and content are required" };
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(systemPrompts).values({
      id,
      userId,
      name: data.name,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    });

    return { prompt: (await this.getById(id, userId))! };
  }

  async update(id: string, data: SystemPromptUpdate, userId: string): Promise<{ prompt?: SystemPrompt; notFound?: boolean }> {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return { notFound: true };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) updateData.content = data.content;

    await db.update(systemPrompts)
      .set(updateData)
      .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)));

    return { prompt: (await this.getById(id, userId))! };
  }

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return { success: false, notFound: true };
    }

    // If this prompt is the default, clear the default setting
    const settingsService = getSettingsService();
    await settingsService.clearDefaultSystemPrompt(id, userId);

    await db.delete(systemPrompts).where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)));

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
