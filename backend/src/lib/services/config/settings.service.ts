import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import type { SettingsRecord } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import type { UserSettings, SettingsUpdate } from "@/types";

// ============================================================================
// Settings Service
// ============================================================================

function getAllModelIds(): string[] {
  return AVAILABLE_MODELS.map((m) => m.id);
}

function parseSettings(record: SettingsRecord): UserSettings {
  return {
    id: record.id,
    defaultModelId: record.defaultModelId,
    defaultSystemPromptId: record.defaultSystemPromptId,
    enabledModels: record.enabledModels
      ? JSON.parse(record.enabledModels)
      : getAllModelIds(),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SettingsService {
  async ensureSettings(userId: string): Promise<UserSettings> {
    const settingsId = `default-${userId}`;
    const [existing] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));

    if (!existing) {
      await db.insert(settings).values({
        id: settingsId,
        userId,
        defaultModelId: "gpt-4o",
        defaultSystemPromptId: null,
        enabledModels: JSON.stringify(getAllModelIds()),
      });

      const [created] = await db
        .select()
        .from(settings)
        .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));

      return parseSettings(created);
    }

    return parseSettings(existing);
  }

  async get(userId: string): Promise<UserSettings> {
    return this.ensureSettings(userId);
  }

  async update(data: SettingsUpdate, userId: string): Promise<UserSettings> {
    await this.ensureSettings(userId);

    const settingsId = `default-${userId}`;
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.defaultModelId !== undefined) {
      updateData.defaultModelId = data.defaultModelId;
    }

    if (data.defaultSystemPromptId !== undefined) {
      updateData.defaultSystemPromptId = data.defaultSystemPromptId;
    }

    if (data.enabledModels !== undefined) {
      updateData.enabledModels = JSON.stringify(data.enabledModels);
    }

    await db.update(settings)
      .set(updateData)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));

    const [updated] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));

    return parseSettings(updated);
  }

  async clearDefaultSystemPrompt(promptId: string, userId: string): Promise<void> {
    const currentSettings = await this.get(userId);
    if (currentSettings.defaultSystemPromptId === promptId) {
      const settingsId = `default-${userId}`;
      await db.update(settings)
        .set({ defaultSystemPromptId: null, updatedAt: new Date() })
        .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)));
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!instance) {
    instance = new SettingsService();
  }
  return instance;
}
