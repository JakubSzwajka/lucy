import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getAvailableProviders } from "@/lib/ai/providers";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const providers = getAvailableProviders();
  return NextResponse.json(providers);
}
