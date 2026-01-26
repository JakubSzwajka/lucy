import { NextResponse } from "next/server";
import { db, mcpServers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGlobalPool, ensureServersConnected } from "@/lib/mcp";
import type { McpServer } from "@/types";

// Parse JSON fields from MCP server record
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

// GET /api/mcp-servers/status - Get connection status of all enabled MCP servers
export async function GET() {
  // Fetch all enabled MCP servers
  const enabledServerRecords = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.enabled, true));

  const enabledServers = enabledServerRecords.map(parseServerRecord);

  // Ensure all enabled servers are connected
  const statuses = await ensureServersConnected(enabledServers);

  // Get total tool count
  const pool = getGlobalPool();
  const totalTools = pool.getAllTools().length;

  return NextResponse.json({
    servers: statuses,
    totalTools,
    connectedCount: statuses.filter((s) => s.connected).length,
  });
}
