import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getTriggerService } from "@/lib/services";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/triggers/[id]/runs - Paginated run history
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const service = getTriggerService();
  const result = await service.getRuns(id, userId, limit, offset);

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ runs: result.runs, total: result.total });
}
