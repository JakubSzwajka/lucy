import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getIdentityService } from "@/lib/memory";

// POST /api/identity/generate - Generate new identity version from memories
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const identityService = getIdentityService();
  const identity = await identityService.generate(userId);

  return NextResponse.json(identity);
}
