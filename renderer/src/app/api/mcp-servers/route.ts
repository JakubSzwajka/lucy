import { NextResponse } from "next/server";
import { db, mcpServers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { McpServerCreate } from "@/types";

// Parse JSON fields from database record
function parseServerRecord(record: typeof mcpServers.$inferSelect) {
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

// GET /api/mcp-servers - List all MCP servers
export async function GET() {
  const servers = await db.select().from(mcpServers);
  return NextResponse.json(servers.map(parseServerRecord));
}

// POST /api/mcp-servers - Create a new MCP server
export async function POST(req: Request) {
  const body: McpServerCreate = await req.json();

  // Validate required fields
  if (!body.name || !body.transportType) {
    return NextResponse.json(
      { error: "name and transportType are required" },
      { status: 400 }
    );
  }

  // Validate transport-specific fields
  if (body.transportType === "stdio" && !body.command) {
    return NextResponse.json(
      { error: "command is required for stdio transport" },
      { status: 400 }
    );
  }

  if ((body.transportType === "http" || body.transportType === "sse") && !body.url) {
    return NextResponse.json(
      { error: "url is required for http/sse transport" },
      { status: 400 }
    );
  }

  const id = uuidv4();
  const now = new Date();

  await db.insert(mcpServers).values({
    id,
    name: body.name,
    description: body.description || null,
    transportType: body.transportType,
    command: body.command || null,
    args: body.args ? JSON.stringify(body.args) : null,
    env: body.env ? JSON.stringify(body.env) : null,
    url: body.url || null,
    headers: body.headers ? JSON.stringify(body.headers) : null,
    requireApproval: body.requireApproval ?? false,
    enabled: body.enabled ?? true,
    iconUrl: body.iconUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(mcpServers).where(eq(mcpServers.id, id));
  return NextResponse.json(parseServerRecord(created), { status: 201 });
}
