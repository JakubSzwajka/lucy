import { db } from "@/lib/db";
import { mcpServers } from "@/lib/db/schema";
import type { McpServerRecord } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Repository } from "@/lib/services/repository.types";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";

// ============================================================================
// MCP Server Repository
// ============================================================================

function parseServerRecord(record: McpServerRecord): McpServer {
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

export class McpRepository implements Repository<McpServer, McpServerCreate, McpServerUpdate> {
  async findById(id: string, userId: string): Promise<McpServer | null> {
    const [record] = await db.select().from(mcpServers).where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
    return record ? parseServerRecord(record) : null;
  }

  async findAll(userId: string): Promise<McpServer[]> {
    const records = await db.select().from(mcpServers).where(eq(mcpServers.userId, userId));
    return records.map(parseServerRecord);
  }

  async findAllEnabled(userId: string): Promise<McpServer[]> {
    const records = await db.select().from(mcpServers).where(and(eq(mcpServers.enabled, true), eq(mcpServers.userId, userId)));
    return records.map(parseServerRecord);
  }

  async create(data: McpServerCreate, userId: string): Promise<McpServer> {
    const id = nanoid();
    const now = new Date();

    await db.insert(mcpServers).values({
      id,
      userId,
      name: data.name,
      description: data.description || null,
      transportType: data.transportType,
      command: data.command || null,
      args: data.args ? JSON.stringify(data.args) : null,
      env: data.env ? JSON.stringify(data.env) : null,
      url: data.url || null,
      headers: data.headers ? JSON.stringify(data.headers) : null,
      requireApproval: data.requireApproval ?? false,
      enabled: data.enabled ?? true,
      iconUrl: data.iconUrl || null,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.findById(id, userId))!;
  }

  async update(id: string, data: McpServerUpdate, userId: string): Promise<McpServer | null> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.transportType !== undefined) updateData.transportType = data.transportType;
    if (data.command !== undefined) updateData.command = data.command;
    if (data.args !== undefined) updateData.args = data.args ? JSON.stringify(data.args) : null;
    if (data.env !== undefined) updateData.env = data.env ? JSON.stringify(data.env) : null;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.headers !== undefined) updateData.headers = data.headers ? JSON.stringify(data.headers) : null;
    if (data.requireApproval !== undefined) updateData.requireApproval = data.requireApproval;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.iconUrl !== undefined) updateData.iconUrl = data.iconUrl;

    await db.update(mcpServers).set(updateData).where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return false;
    }

    await db.delete(mcpServers).where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: McpRepository | null = null;

export function getMcpRepository(): McpRepository {
  if (!instance) {
    instance = new McpRepository();
  }
  return instance;
}
