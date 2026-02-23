import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getSettingsService } from "@/lib/server/config";

// GET /api/settings - Fetch current settings
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const settingsService = getSettingsService();
  const currentSettings = await settingsService.get(userId);
  return NextResponse.json(currentSettings);
}

// PATCH /api/settings - Update settings
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json();
  const settingsService = getSettingsService();

  const updated = await settingsService.update({
    enabledModels: body.enabledModels,
    contextWindowSize: body.contextWindowSize,
  }, userId);

  return NextResponse.json(updated);
}
