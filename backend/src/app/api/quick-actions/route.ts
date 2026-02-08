import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getQuickActionService } from "@/lib/services";

function parseEnabledParam(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

// GET /api/quick-actions - List quick actions (optionally filtered by enabled)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const service = getQuickActionService();
  const { searchParams } = new URL(request.url);
  const enabled = parseEnabledParam(searchParams.get("enabled"));
  const actions = service.getAll(userId, enabled);
  return NextResponse.json(actions);
}

// POST /api/quick-actions - Create a new quick action
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { name, content, icon, sortOrder, enabled } = await request.json();
  const service = getQuickActionService();

  const result = service.create({ name, content, icon, sortOrder, enabled }, userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.action, { status: 201 });
}
