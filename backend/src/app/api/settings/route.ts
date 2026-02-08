import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getSettingsService } from "@/lib/services";

// GET /api/settings - Fetch current settings
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(userId);
  return NextResponse.json(currentSettings);
}

// PATCH /api/settings - Update settings
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json();
  const settingsService = getSettingsService();

  const updated = settingsService.update({
    defaultModelId: body.defaultModelId,
    defaultSystemPromptId: body.defaultSystemPromptId,
    enabledModels: body.enabledModels,
  }, userId);

  return NextResponse.json(updated);
}
