import { NextResponse } from "next/server";
import { db, mcpServers } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { McpServerUpdate } from "@/types";

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

// GET /api/mcp-servers/[id] - Get a single MCP server
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [server] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id));

  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  return NextResponse.json(parseServerRecord(server));
}

// PATCH /api/mcp-servers/[id] - Update an MCP server
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: McpServerUpdate = await req.json();

  const [existing] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id));

  if (!existing) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  // Build update object
  const updateData: Partial<typeof mcpServers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.transportType !== undefined) updateData.transportType = body.transportType;
  if (body.command !== undefined) updateData.command = body.command;
  if (body.args !== undefined) updateData.args = body.args ? JSON.stringify(body.args) : null;
  if (body.env !== undefined) updateData.env = body.env ? JSON.stringify(body.env) : null;
  if (body.url !== undefined) updateData.url = body.url;
  if (body.headers !== undefined) updateData.headers = body.headers ? JSON.stringify(body.headers) : null;
  if (body.requireApproval !== undefined) updateData.requireApproval = body.requireApproval;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.iconUrl !== undefined) updateData.iconUrl = body.iconUrl;

  await db
    .update(mcpServers)
    .set(updateData)
    .where(eq(mcpServers.id, id));

  const [updated] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id));

  return NextResponse.json(parseServerRecord(updated));
}

// DELETE /api/mcp-servers/[id] - Delete an MCP server
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id));

  if (!existing) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  await db.delete(mcpServers).where(eq(mcpServers.id, id));

  return NextResponse.json({ success: true });
}
