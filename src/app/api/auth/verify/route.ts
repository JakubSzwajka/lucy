import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);

  if ("error" in result) {
    return result.error;
  }

  return NextResponse.json({ user: result.user });
}
