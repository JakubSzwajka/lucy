import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { fetchAvailableModels } from "@/lib/ai/models";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const models = await fetchAvailableModels();
  return NextResponse.json(models);
}
