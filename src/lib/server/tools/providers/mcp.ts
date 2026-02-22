import { jsonSchema } from "ai";
import type { ToolProvider, ToolDefinition, ToolExecutionContext } from "../types";
import {
  getGlobalPool,
  ensureServersConnected,
  executeToolCall,
  type McpClientWrapper,
} from "@/lib/server/integrations/mcp";
import { db } from "@/lib/server/db";
import { mcpServers } from "@/lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { McpServer } from "@/types";

// ============================================================================
// MCP Tool Provider
// ============================================================================

export class McpToolProvider implements ToolProvider {
  readonly name = "mcp";

  private enabledServers: McpServer[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    await this.refreshServers();
    this.initialized = true;
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized && this.enabledServers.length > 0;
  }

  async getTools(filter?: { allowedServerIds?: string[] }): Promise<ToolDefinition[]> {
    // Ensure servers are connected
    if (!this.initialized) {
      await this.initialize();
    }

    const pool = getGlobalPool();
    const tools: ToolDefinition[] = [];

    for (const serverId of pool.getConnectedServerIds()) {
      // Skip servers not in the allowed list when filter is provided
      if (filter?.allowedServerIds && !filter.allowedServerIds.includes(serverId)) {
        continue;
      }

      const wrapper = pool.getClient(serverId);
      if (!wrapper) continue;

      const serverConfig = pool.getServerConfig(serverId);

      for (const mcpTool of wrapper.tools) {
        tools.push(this.createToolDefinition(wrapper, mcpTool, serverConfig));
      }
    }

    return tools;
  }

  async dispose(): Promise<void> {
    // Pool cleanup is handled by the pool itself
    this.enabledServers = [];
    this.initialized = false;
  }

  // -------------------------------------------------------------------------
  // Server Management
  // -------------------------------------------------------------------------

  async refreshServers(): Promise<void> {
    // Fetch enabled MCP servers from database
    const enabledServerRecords = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.enabled, true));

    this.enabledServers = enabledServerRecords.map(parseServerRecord);

    // Ensure all enabled servers are connected
    await ensureServersConnected(this.enabledServers);
  }

  // -------------------------------------------------------------------------
  // Tool Definition Creation
  // -------------------------------------------------------------------------

  private createToolDefinition(
    wrapper: McpClientWrapper,
    mcpTool: { name: string; description?: string; inputSchema?: Record<string, unknown> },
    serverConfig?: McpServer
  ): ToolDefinition {
    // Convert MCP's JSON Schema to AI SDK compatible schema
    // Default to empty object schema if not provided
    const mcpJsonSchema = mcpTool.inputSchema || { type: "object", properties: {} };

    return {
      name: mcpTool.name,
      description: mcpTool.description || `Tool: ${mcpTool.name}`,
      inputSchema: jsonSchema(mcpJsonSchema),
      source: {
        type: "mcp",
        serverId: wrapper.serverId,
        serverName: wrapper.serverName,
      },
      requiresApproval: serverConfig?.requireApproval ?? false,
      execute: async (args: Record<string, unknown>, _context: ToolExecutionContext) => {
        const result = await executeToolCall(wrapper, mcpTool.name, args);

        if (!result.success) {
          throw new Error(result.error || "Tool execution failed");
        }

        return result.result;
      },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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
