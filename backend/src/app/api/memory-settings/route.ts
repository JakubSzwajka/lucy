import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { memorySettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { UpdateMemorySettingsInput } from "@/lib/memory/types";
import { MEMORY_SETTINGS_DEFAULTS } from "@/lib/memory/types";

// GET /api/memory-settings - Get user's memory settings (or defaults)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const rows = await db
    .select()
    .from(memorySettings)
    .where(eq(memorySettings.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    // Return defaults (no row yet)
    return NextResponse.json({
      ...MEMORY_SETTINGS_DEFAULTS,
      userId,
    });
  }

  return NextResponse.json(rows[0]);
}

// PATCH /api/memory-settings - Update settings
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = (await request.json()) as UpdateMemorySettingsInput;

  // Validate ranges
  if (body.autoSaveThreshold !== undefined) {
    if (body.autoSaveThreshold < 0 || body.autoSaveThreshold > 1) {
      return NextResponse.json({ error: "autoSaveThreshold must be 0.0-1.0" }, { status: 400 });
    }
  }
  if (body.maxContextMemories !== undefined) {
    if (body.maxContextMemories < 1 || body.maxContextMemories > 50) {
      return NextResponse.json({ error: "maxContextMemories must be 1-50" }, { status: 400 });
    }
  }
  if (body.questionsPerSession !== undefined) {
    if (body.questionsPerSession < 0 || body.questionsPerSession > 10) {
      return NextResponse.json({ error: "questionsPerSession must be 0-10" }, { status: 400 });
    }
  }
  if (body.reflectionTokenThreshold !== undefined) {
    if (body.reflectionTokenThreshold < 1000 || body.reflectionTokenThreshold > 50000) {
      return NextResponse.json({ error: "reflectionTokenThreshold must be 1000-50000" }, { status: 400 });
    }
  }

  // Check if row exists
  const existing = await db
    .select()
    .from(memorySettings)
    .where(eq(memorySettings.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Create with defaults + overrides
    const newRow = {
      id: `ms_${nanoid()}`,
      userId,
      autoExtract: body.autoExtract ?? MEMORY_SETTINGS_DEFAULTS.autoExtract,
      autoSaveThreshold: body.autoSaveThreshold ?? MEMORY_SETTINGS_DEFAULTS.autoSaveThreshold,
      defaultScope: body.defaultScope ?? MEMORY_SETTINGS_DEFAULTS.defaultScope,
      maxContextMemories: body.maxContextMemories ?? MEMORY_SETTINGS_DEFAULTS.maxContextMemories,
      questionsPerSession: body.questionsPerSession ?? MEMORY_SETTINGS_DEFAULTS.questionsPerSession,
      extractionModel: body.extractionModel ?? MEMORY_SETTINGS_DEFAULTS.extractionModel,
      reflectionTokenThreshold: body.reflectionTokenThreshold ?? MEMORY_SETTINGS_DEFAULTS.reflectionTokenThreshold,
    };
    const [created] = await db.insert(memorySettings).values(newRow).returning();
    return NextResponse.json(created);
  }

  // Update existing
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.autoExtract !== undefined) updates.autoExtract = body.autoExtract;
  if (body.autoSaveThreshold !== undefined) updates.autoSaveThreshold = body.autoSaveThreshold;
  if (body.defaultScope !== undefined) updates.defaultScope = body.defaultScope;
  if (body.maxContextMemories !== undefined) updates.maxContextMemories = body.maxContextMemories;
  if (body.questionsPerSession !== undefined) updates.questionsPerSession = body.questionsPerSession;
  if (body.extractionModel !== undefined) updates.extractionModel = body.extractionModel;
  if (body.reflectionTokenThreshold !== undefined) updates.reflectionTokenThreshold = body.reflectionTokenThreshold;

  const [updated] = await db
    .update(memorySettings)
    .set(updates)
    .where(eq(memorySettings.userId, userId))
    .returning();

  return NextResponse.json(updated);
}
