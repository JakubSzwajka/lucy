import { db, mcpServers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Repository } from "@/lib/services/repository.types";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";
import type { McpServerRecord } from "@/lib/db/schema";

// ============================================================================
// MCP Server Repository
// ============================================================================

/**
 * Transform database record to API type by parsing JSON fields
 */
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

/**
 * Repository for MCP server data access
 */
export class McpRepository implements Repository<McpServer, McpServerCreate, McpServerUpdate> {
  /**
   * Find an MCP server by ID
   */
  findById(id: string): McpServer | null {
    const [record] = db.select().from(mcpServers).where(eq(mcpServers.id, id)).all();
    return record ? parseServerRecord(record) : null;
  }

  /**
   * Find all MCP servers
   */
  findAll(): McpServer[] {
    const records = db.select().from(mcpServers).all();
    return records.map(parseServerRecord);
  }

  /**
   * Find all enabled MCP servers
   */
  findAllEnabled(): McpServer[] {
    const records = db.select().from(mcpServers).where(eq(mcpServers.enabled, true)).all();
    return records.map(parseServerRecord);
  }

  /**
   * Create a new MCP server
   */
  create(data: McpServerCreate): McpServer {
    const id = uuidv4();
    const now = new Date();

    db.insert(mcpServers).values({
      id,
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
    }).run();

    return this.findById(id)!;
  }

  /**
   * Update an MCP server
   */
  update(id: string, data: McpServerUpdate): McpServer | null {
    const existing = this.findById(id);
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

    db.update(mcpServers).set(updateData).where(eq(mcpServers.id, id)).run();

    return this.findById(id);
  }

  /**
   * Delete an MCP server
   */
  delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) {
      return false;
    }

    db.delete(mcpServers).where(eq(mcpServers.id, id)).run();
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
