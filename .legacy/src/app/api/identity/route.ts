import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getIdentityService } from "@/lib/server/memory";

// GET /api/identity - Get active identity document
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const identityService = getIdentityService();
  const identity = await identityService.getActive(userId);

  return NextResponse.json(identity);
}
