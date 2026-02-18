import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { memorySettings, agentConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Validate reflectionAgentConfigId if provided
  if (body.reflectionAgentConfigId !== undefined && body.reflectionAgentConfigId !== null) {
    const configRows = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.id, body.reflectionAgentConfigId), eq(agentConfigs.userId, userId)))
      .limit(1);
    if (configRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid reflectionAgentConfigId: agent config not found or does not belong to user" },
        { status: 400 }
      );
    }
  }

  // Validate ranges
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
      reflectionTokenThreshold: body.reflectionTokenThreshold ?? MEMORY_SETTINGS_DEFAULTS.reflectionTokenThreshold,
      reflectionAgentConfigId: body.reflectionAgentConfigId ?? null,
    };
    const [created] = await db.insert(memorySettings).values(newRow).returning();
    return NextResponse.json(created);
  }

  // Update existing
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.autoExtract !== undefined) updates.autoExtract = body.autoExtract;
  if (body.reflectionTokenThreshold !== undefined) updates.reflectionTokenThreshold = body.reflectionTokenThreshold;
  if (body.reflectionAgentConfigId !== undefined) updates.reflectionAgentConfigId = body.reflectionAgentConfigId;

  const [updated] = await db
    .update(memorySettings)
    .set(updates)
    .where(eq(memorySettings.userId, userId))
    .returning();

  return NextResponse.json(updated);
}
