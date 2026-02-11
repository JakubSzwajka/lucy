import { NextResponse } from "next/server";
import { getMcpService } from "@/lib/services";
import type { McpServerUpdate } from "@/types";

// GET /api/mcp-servers/[id] - Get a single MCP server
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mcpService = getMcpService();

  const server = mcpService.getById(id);

  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json(server);
}

// PATCH /api/mcp-servers/[id] - Update an MCP server
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: McpServerUpdate = await req.json();
  const mcpService = getMcpService();

  const result = mcpService.update(id, body);

  if (result.notFound) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json(result.server);
}

// DELETE /api/mcp-servers/[id] - Delete an MCP server
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mcpService = getMcpService();

  const result = mcpService.delete(id);

  if (result.notFound) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
