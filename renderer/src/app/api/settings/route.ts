import { NextResponse } from "next/server";
import { db, settings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { AVAILABLE_MODELS } from "@/lib/ai/models";

const DEFAULT_SETTINGS_ID = "default";

// Get all model IDs for default enabledModels
function getAllModelIds(): string[] {
  return AVAILABLE_MODELS.map((m) => m.id);
}

// Ensure default settings exist, create if not
async function ensureSettings(): Promise<typeof settings.$inferSelect> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.id, DEFAULT_SETTINGS_ID));

  if (existing.length === 0) {
    await db.insert(settings).values({
      id: DEFAULT_SETTINGS_ID,
      defaultModelId: "gpt-4o",
      defaultSystemPromptId: null,
      enabledModels: JSON.stringify(getAllModelIds()),
    });
    // Fetch the created record to get the auto-generated timestamps
    const [created] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, DEFAULT_SETTINGS_ID));
    return created;
  }

  return existing[0];
}

// Parse settings record for response
function parseSettings(record: typeof settings.$inferSelect) {
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

// GET /api/settings - Fetch current settings
export async function GET() {
  const record = await ensureSettings();
  return NextResponse.json(parseSettings(record));
}

// PATCH /api/settings - Update settings
export async function PATCH(req: Request) {
  const body = await req.json();

  // Ensure settings exist
  await ensureSettings();

  // Build update object
  const updateData: Partial<typeof settings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.defaultModelId !== undefined) {
    updateData.defaultModelId = body.defaultModelId;
  }

  if (body.defaultSystemPromptId !== undefined) {
    updateData.defaultSystemPromptId = body.defaultSystemPromptId;
  }

  if (body.enabledModels !== undefined) {
    updateData.enabledModels = JSON.stringify(body.enabledModels);
  }

  await db
    .update(settings)
    .set(updateData)
    .where(eq(settings.id, DEFAULT_SETTINGS_ID));

  const [updated] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, DEFAULT_SETTINGS_ID));

  return NextResponse.json(parseSettings(updated));
}
