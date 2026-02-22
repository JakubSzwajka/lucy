import {
  createMcpClient,
  closeMcpClient,
  convertToAiSdkTools,
  type McpClientWrapper,
  type SimpleTool,
} from "./client";
import type { McpServer, McpTool, McpServerStatus } from "@/types";

export type { McpServerStatus };

export class McpClientPool {
  private clients: Map<string, McpClientWrapper> = new Map();
  private serverConfigs: Map<string, McpServer> = new Map();

  async connect(server: McpServer): Promise<McpServerStatus> {
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
      console.error(`[MCP] Failed to connect to server ${server.name}:`, error);
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

  async disconnect(serverId: string): Promise<void> {
    const wrapper = this.clients.get(serverId);
    if (wrapper) {
      await closeMcpClient(wrapper);
      this.clients.delete(serverId);
      this.serverConfigs.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(disconnectPromises);
  }

  getAllTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const wrapper of this.clients.values()) {
      tools.push(...wrapper.tools);
    }
    return tools;
  }

  getAiSdkTools(
    onToolCall?: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<boolean>
  ): Record<string, SimpleTool> {
    return convertToAiSdkTools(Array.from(this.clients.values()), onToolCall);
  }

  getClient(serverId: string): McpClientWrapper | undefined {
    return this.clients.get(serverId);
  }

  getServerConfig(serverId: string): McpServer | undefined {
    return this.serverConfigs.get(serverId);
  }

  requiresApproval(serverId: string): boolean {
    const config = this.serverConfigs.get(serverId);
    return config?.requireApproval ?? false;
  }

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

  getConnectedServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  hasConnections(): boolean {
    return this.clients.size > 0;
  }
}

// ============================================================================
// GLOBAL MCP POOL
// ============================================================================

const globalPool = new McpClientPool();

export function getGlobalPool(): McpClientPool {
  return globalPool;
}

export async function ensureServersConnected(
  enabledServers: McpServer[]
): Promise<McpServerStatus[]> {
  const currentConnectedIds = new Set(globalPool.getConnectedServerIds());
  const enabledIds = new Set(enabledServers.map((s) => s.id));

  for (const connectedId of currentConnectedIds) {
    if (!enabledIds.has(connectedId)) {
      await globalPool.disconnect(connectedId);
    }
  }

  const statuses = await Promise.all(
    enabledServers.map((server) => globalPool.connect(server))
  );

  return statuses;
}

export async function disconnectAll(): Promise<void> {
  await globalPool.disconnectAll();
}

export function getPoolForSession(_sessionId: string): McpClientPool {
  return globalPool;
}
