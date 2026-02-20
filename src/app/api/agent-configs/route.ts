import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getAgentConfigService } from "@/lib/services";

// GET /api/agent-configs - List all agent configs
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const service = getAgentConfigService();
  const configs = await service.getAll(userId);
  return NextResponse.json(configs);
}

// POST /api/agent-configs - Create a new agent config
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json().catch(() => ({}));
  const service = getAgentConfigService();
  const result = await service.create(body, userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.config, { status: 201 });
}
