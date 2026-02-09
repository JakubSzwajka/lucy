import { getMcpRepository, McpRepository } from "./repository";
import { createMcpClient, closeMcpClient } from "./client";
import { getGlobalPool, ensureServersConnected } from "./pool";
import type { McpServer, McpServerCreate, McpServerUpdate, McpServerStatus } from "@/types";

// ============================================================================
// MCP Service Types
// ============================================================================

export interface McpTestResult {
  success: boolean;
  tools?: string[];
  message?: string;
  error?: string;
}

export interface McpStatusResult {
  servers: McpServerStatus[];
  totalTools: number;
  connectedCount: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// MCP Service
// ============================================================================

export class McpService {
  private repository: McpRepository;

  constructor(repository?: McpRepository) {
    this.repository = repository || getMcpRepository();
  }

  async getAll(userId: string): Promise<McpServer[]> {
    return this.repository.findAll(userId);
  }

  async getAllEnabled(userId: string): Promise<McpServer[]> {
    return this.repository.findAllEnabled(userId);
  }

  async getById(id: string, userId: string): Promise<McpServer | null> {
    return this.repository.findById(id, userId);
  }

  async create(data: McpServerCreate, userId: string): Promise<{ server?: McpServer; error?: string }> {
    const validation = this.validateCreate(data);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const server = await this.repository.create(data, userId);
    return { server };
  }

  async update(id: string, data: McpServerUpdate, userId: string): Promise<{ server?: McpServer; error?: string; notFound?: boolean }> {
    const existing = await this.repository.findById(id, userId);
    if (!existing) {
      return { notFound: true };
    }

    const server = await this.repository.update(id, data, userId);
    return { server: server || undefined };
  }

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  validateCreate(data: McpServerCreate): ValidationResult {
    if (!data.name || !data.transportType) {
      return { valid: false, error: "name and transportType are required" };
    }

    if (data.transportType === "stdio" && !data.command) {
      return { valid: false, error: "command is required for stdio transport" };
    }

    if ((data.transportType === "http" || data.transportType === "sse") && !data.url) {
      return { valid: false, error: "url is required for http/sse transport" };
    }

    return { valid: true };
  }

  async testConnection(id: string, userId: string): Promise<McpTestResult & { notFound?: boolean }> {
    const server = await this.repository.findById(id, userId);
    if (!server) {
      return { success: false, notFound: true };
    }

    try {
      const wrapper = await createMcpClient(server);
      const tools = wrapper.tools.map((t) => t.name);
      await closeMcpClient(wrapper);

      return {
        success: true,
        tools,
        message: `Connected successfully. ${tools.length} tool${tools.length !== 1 ? "s" : ""} available.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async getStatus(userId: string): Promise<McpStatusResult> {
    const enabledServers = await this.repository.findAllEnabled(userId);
    const statuses = await ensureServersConnected(enabledServers);
    const pool = getGlobalPool();
    const totalTools = pool.getAllTools().length;

    return {
      servers: statuses,
      totalTools,
      connectedCount: statuses.filter((s) => s.connected).length,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: McpService | null = null;

export function getMcpService(): McpService {
  if (!instance) {
    instance = new McpService();
  }
  return instance;
}
