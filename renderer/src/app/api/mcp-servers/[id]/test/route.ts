import { NextResponse } from "next/server";
import { getMcpService } from "@/lib/services";

// POST /api/mcp-servers/[id]/test - Test connection to an MCP server
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mcpService = getMcpService();

  const result = await mcpService.testConnection(id);

  if (result.notFound) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
