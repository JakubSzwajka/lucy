import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/services";

// GET /api/settings - Fetch current settings
export async function GET() {
  const settingsService = getSettingsService();
  const currentSettings = settingsService.get();
  return NextResponse.json(currentSettings);
}

// PATCH /api/settings - Update settings
export async function PATCH(req: Request) {
  const body = await req.json();
  const settingsService = getSettingsService();

  const updated = settingsService.update({
    defaultModelId: body.defaultModelId,
    defaultSystemPromptId: body.defaultSystemPromptId,
    enabledModels: body.enabledModels,
  });

  return NextResponse.json(updated);
}
