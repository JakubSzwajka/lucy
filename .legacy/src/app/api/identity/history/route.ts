import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getIdentityService } from "@/lib/server/memory";

// GET /api/identity/history - List all identity document versions
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const identityService = getIdentityService();
  const versions = await identityService.listVersions(userId);

  return NextResponse.json(versions);
}
