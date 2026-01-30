import { NextResponse } from "next/server";
import { getMcpService } from "@/lib/services";

// GET /api/mcp-servers/status - Get connection status of all enabled MCP servers
export async function GET() {
  const mcpService = getMcpService();
  const status = await mcpService.getStatus();
  return NextResponse.json(status);
}
