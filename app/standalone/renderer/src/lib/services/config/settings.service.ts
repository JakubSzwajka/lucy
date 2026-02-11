import { db, settings, SettingsRecord } from "@/lib/db";
import { eq } from "drizzle-orm";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import type { UserSettings, SettingsUpdate } from "@/types";

// ============================================================================
// Settings Service
// ============================================================================

const DEFAULT_SETTINGS_ID = "default";

/**
 * Get all model IDs for default enabledModels
 */
function getAllModelIds(): string[] {
  return AVAILABLE_MODELS.map((m) => m.id);
}

/**
 * Parse settings record for response
 */
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

/**
 * Service for settings business logic
 */
export class SettingsService {
  /**
   * Ensure default settings exist, create if not
   */
  ensureSettings(): UserSettings {
    const [existing] = db
      .select()
      .from(settings)
      .where(eq(settings.id, DEFAULT_SETTINGS_ID))
      .all();

    if (!existing) {
      db.insert(settings).values({
        id: DEFAULT_SETTINGS_ID,
        defaultModelId: "gpt-4o",
        defaultSystemPromptId: null,
        enabledModels: JSON.stringify(getAllModelIds()),
      }).run();

      const [created] = db
        .select()
        .from(settings)
        .where(eq(settings.id, DEFAULT_SETTINGS_ID))
        .all();

      return parseSettings(created);
    }

    return parseSettings(existing);
  }

  /**
   * Get current settings
   */
  get(): UserSettings {
    return this.ensureSettings();
  }

  /**
   * Update settings
   */
  update(data: SettingsUpdate): UserSettings {
    // Ensure settings exist
    this.ensureSettings();

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
      .where(eq(settings.id, DEFAULT_SETTINGS_ID))
      .run();

    const [updated] = db
      .select()
      .from(settings)
      .where(eq(settings.id, DEFAULT_SETTINGS_ID))
      .all();

    return parseSettings(updated);
  }

  /**
   * Clear default system prompt (used when deleting a prompt)
   */
  clearDefaultSystemPrompt(promptId: string): void {
    const currentSettings = this.get();
    if (currentSettings.defaultSystemPromptId === promptId) {
      db.update(settings)
        .set({ defaultSystemPromptId: null, updatedAt: new Date() })
        .where(eq(settings.id, DEFAULT_SETTINGS_ID))
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
