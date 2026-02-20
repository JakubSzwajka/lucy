import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getMcpService } from "@/lib/services";
import type { McpServerCreate } from "@/types";

// GET /api/mcp-servers - List all MCP servers
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const mcpService = getMcpService();
  const servers = await mcpService.getAll(userId);
  return NextResponse.json(servers);
}

// POST /api/mcp-servers - Create a new MCP server
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body: McpServerCreate = await request.json();
  const mcpService = getMcpService();

  const result = await mcpService.create(body, userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.server, { status: 201 });
}
