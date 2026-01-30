import { NextResponse } from "next/server";
import { getMcpService } from "@/lib/services";
import type { McpServerCreate } from "@/types";

// GET /api/mcp-servers - List all MCP servers
export async function GET() {
  const mcpService = getMcpService();
  const servers = mcpService.getAll();
  return NextResponse.json(servers);
}

// POST /api/mcp-servers - Create a new MCP server
export async function POST(req: Request) {
  const body: McpServerCreate = await req.json();
  const mcpService = getMcpService();

  const result = mcpService.create(body);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.server, { status: 201 });
}
