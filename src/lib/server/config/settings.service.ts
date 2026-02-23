import { db } from "@/lib/server/db";
import { settings } from "@/lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { UserSettings, SettingsUpdate } from "@/types";

// ============================================================================
// Settings Service
// ============================================================================

function parseSettings(record: typeof settings.$inferSelect): UserSettings {
  return {
    id: record.id,
    enabledModels: record.enabledModels
      ? JSON.parse(record.enabledModels)
      : [],
    contextWindowSize: record.contextWindowSize ?? 10,
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
        enabledModels: JSON.stringify([]),
      }).onConflictDoNothing();

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

    if (data.enabledModels !== undefined) {
      updateData.enabledModels = JSON.stringify(data.enabledModels);
    }

    if (data.contextWindowSize !== undefined) {
      updateData.contextWindowSize = data.contextWindowSize;
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
