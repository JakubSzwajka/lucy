import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getMcpService } from "@/lib/server/services";

// POST /api/mcp-servers/[id]/test - Test connection to an MCP server
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const mcpService = getMcpService();

  const result = await mcpService.testConnection(id, userId);

  if (result.notFound) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
