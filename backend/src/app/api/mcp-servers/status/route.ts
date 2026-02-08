import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getMcpService } from "@/lib/services";

// GET /api/mcp-servers/status - Get connection status of all enabled MCP servers
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const mcpService = getMcpService();
  const status = await mcpService.getStatus(userId);
  return NextResponse.json(status);
}
