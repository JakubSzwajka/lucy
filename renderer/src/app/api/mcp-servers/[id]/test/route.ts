import { NextResponse } from "next/server";
import { db, mcpServers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createMcpClient, closeMcpClient } from "@/lib/mcp";
import type { McpServer } from "@/types";

// Parse server record to McpServer type
function parseServerRecord(record: typeof mcpServers.$inferSelect): McpServer {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    transportType: record.transportType,
    command: record.command,
    args: record.args ? JSON.parse(record.args) : null,
    env: record.env ? JSON.parse(record.env) : null,
    url: record.url,
    headers: record.headers ? JSON.parse(record.headers) : null,
    requireApproval: record.requireApproval,
    enabled: record.enabled,
    iconUrl: record.iconUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// POST /api/mcp-servers/[id]/test - Test connection to an MCP server
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch server config
  const [serverRecord] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id));

  if (!serverRecord) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const server = parseServerRecord(serverRecord);

  try {
    // Create temporary connection
    const wrapper = await createMcpClient(server);

    // Get tool names
    const tools = wrapper.tools.map((t) => t.name);

    // Close connection
    await closeMcpClient(wrapper);

    return NextResponse.json({
      success: true,
      tools,
      message: `Connected successfully. ${tools.length} tool${tools.length !== 1 ? "s" : ""} available.`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
