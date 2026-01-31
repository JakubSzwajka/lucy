import {
  createMcpClient,
  closeMcpClient,
  convertToAiSdkTools,
  type McpClientWrapper,
  type SimpleTool,
} from "./client";
import type { McpServer, McpTool, McpServerStatus } from "@/types";

export type { McpServerStatus };

/**
 * Pool of MCP clients for a single session
 */
export class McpClientPool {
  private clients: Map<string, McpClientWrapper> = new Map();
  private serverConfigs: Map<string, McpServer> = new Map();

  /**
   * Connect to an MCP server
   */
  async connect(server: McpServer): Promise<McpServerStatus> {
    // Check if already connected
    if (this.clients.has(server.id)) {
      const existing = this.clients.get(server.id)!;
      return {
        serverId: server.id,
        serverName: server.name,
        connected: existing.connected,
        tools: existing.tools,
        requireApproval: server.requireApproval,
      };
    }

    try {
      const wrapper = await createMcpClient(server);
      this.clients.set(server.id, wrapper);
      this.serverConfigs.set(server.id, server);

      return {
        serverId: server.id,
        serverName: server.name,
        connected: true,
        tools: wrapper.tools,
        requireApproval: server.requireApproval,
      };
    } catch (error) {
      console.error(`Failed to connect to MCP server ${server.name}:`, error);
      return {
        serverId: server.id,
        serverName: server.name,
        connected: false,
        tools: [],
        error: error instanceof Error ? error.message : "Connection failed",
        requireApproval: server.requireApproval,
      };
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const wrapper = this.clients.get(serverId);
    if (wrapper) {
      await closeMcpClient(wrapper);
      this.clients.delete(serverId);
      this.serverConfigs.delete(serverId);
    }
  }

  /**
   * Disconnect all MCP servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(disconnectPromises);
  }

  /**
   * Get all discovered tools from connected servers
   */
  getAllTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const wrapper of this.clients.values()) {
      tools.push(...wrapper.tools);
    }
    return tools;
  }

  /**
   * Get tools formatted for AI SDK's streamText
   */
  getAiSdkTools(
    onToolCall?: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<boolean>
  ): Record<string, SimpleTool> {
    return convertToAiSdkTools(Array.from(this.clients.values()), onToolCall);
  }

  /**
   * Get a specific client wrapper
   */
  getClient(serverId: string): McpClientWrapper | undefined {
    return this.clients.get(serverId);
  }

  /**
   * Get server config by ID
   */
  getServerConfig(serverId: string): McpServer | undefined {
    return this.serverConfigs.get(serverId);
  }

  /**
   * Check if a server requires approval
   */
  requiresApproval(serverId: string): boolean {
    const config = this.serverConfigs.get(serverId);
    return config?.requireApproval ?? false;
  }

  /**
   * Get status of all connections
   */
  getStatuses(): McpServerStatus[] {
    return Array.from(this.clients.entries()).map(([id, wrapper]) => {
      const config = this.serverConfigs.get(id);
      return {
        serverId: id,
        serverName: wrapper.serverName,
        connected: wrapper.connected,
        tools: wrapper.tools,
        requireApproval: config?.requireApproval ?? false,
      };
    });
  }

  /**
   * Get list of connected server IDs
   */
  getConnectedServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if pool has any connected servers
   */
  hasConnections(): boolean {
    return this.clients.size > 0;
  }
}

// ============================================================================
// GLOBAL MCP POOL
// ============================================================================

// Single global pool for all MCP connections
const globalPool = new McpClientPool();

/**
 * Get the global MCP pool
 */
export function getGlobalPool(): McpClientPool {
  return globalPool;
}

/**
 * Ensure all enabled MCP servers are connected.
 * Call this before using tools in the chat API.
 */
export async function ensureServersConnected(
  enabledServers: McpServer[]
): Promise<McpServerStatus[]> {
  const currentConnectedIds = new Set(globalPool.getConnectedServerIds());
  const enabledIds = new Set(enabledServers.map((s) => s.id));

  // Disconnect servers that are no longer enabled
  for (const connectedId of currentConnectedIds) {
    if (!enabledIds.has(connectedId)) {
      await globalPool.disconnect(connectedId);
    }
  }

  // Connect to enabled servers (pool.connect handles already-connected case)
  const statuses = await Promise.all(
    enabledServers.map((server) => globalPool.connect(server))
  );

  return statuses;
}

/**
 * Disconnect all servers (cleanup)
 */
export async function disconnectAll(): Promise<void> {
  await globalPool.disconnectAll();
}

// Legacy function for backwards compatibility during migration
// TODO: Remove after migration is complete
export function getPoolForSession(_sessionId: string): McpClientPool {
  return globalPool;
}
