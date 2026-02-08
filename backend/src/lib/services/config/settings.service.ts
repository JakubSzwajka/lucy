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
  ensureSettings(userId: string): UserSettings {
    const settingsId = `default-${userId}`;
    const [existing] = db
      .select()
      .from(settings)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)))
      .all();

    if (!existing) {
      db.insert(settings).values({
        id: settingsId,
        userId,
        defaultModelId: "gpt-4o",
        defaultSystemPromptId: null,
        enabledModels: JSON.stringify(getAllModelIds()),
      }).run();

      const [created] = db
        .select()
        .from(settings)
        .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)))
        .all();

      return parseSettings(created);
    }

    return parseSettings(existing);
  }

  get(userId: string): UserSettings {
    return this.ensureSettings(userId);
  }

  update(data: SettingsUpdate, userId: string): UserSettings {
    this.ensureSettings(userId);

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

    db.update(settings)
      .set(updateData)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)))
      .run();

    const [updated] = db
      .select()
      .from(settings)
      .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)))
      .all();

    return parseSettings(updated);
  }

  clearDefaultSystemPrompt(promptId: string, userId: string): void {
    const currentSettings = this.get(userId);
    if (currentSettings.defaultSystemPromptId === promptId) {
      const settingsId = `default-${userId}`;
      db.update(settings)
        .set({ defaultSystemPromptId: null, updatedAt: new Date() })
        .where(and(eq(settings.id, settingsId), eq(settings.userId, userId)))
        .run();
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
