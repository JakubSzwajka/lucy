import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getAgentConfigService } from "@/lib/server/config";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/agent-configs/[id] - Get a single agent config
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const service = getAgentConfigService();
  const config = await service.getById(id, userId);

  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(config);
}

// PUT /api/agent-configs/[id] - Update an agent config
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const service = getAgentConfigService();
  const result = await service.update(id, body, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.config);
}

// DELETE /api/agent-configs/[id] - Delete an agent config
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;
  const { id } = await context.params;

  const service = getAgentConfigService();
  const result = await service.delete(id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
