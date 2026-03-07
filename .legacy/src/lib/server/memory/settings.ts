import { db } from "@/lib/server/db";
import { memorySettings } from "@/lib/server/db/schema";
import { eq } from "drizzle-orm";
import { MEMORY_SETTINGS_DEFAULTS, type MemorySettings } from "./types";

/**
 * Load user's memory settings from DB, falling back to defaults.
 */
export async function getMemorySettings(userId: string): Promise<MemorySettings> {
  const rows = await db
    .select()
    .from(memorySettings)
    .where(eq(memorySettings.userId, userId))
    .limit(1);

  if (rows.length > 0) {
    return rows[0] as MemorySettings;
  }

  // Return defaults as a virtual MemorySettings object
  return {
    id: "",
    userId,
    ...MEMORY_SETTINGS_DEFAULTS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
