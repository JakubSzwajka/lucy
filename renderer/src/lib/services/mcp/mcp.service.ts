import { getMcpRepository, McpRepository } from "./mcp.repository";
import { createMcpClient, closeMcpClient, getGlobalPool, ensureServersConnected } from "@/lib/mcp";
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

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// MCP Service
// ============================================================================

/**
 * Service for MCP server business logic
 */
export class McpService {
  private repository: McpRepository;

  constructor(repository?: McpRepository) {
    this.repository = repository || getMcpRepository();
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Get all MCP servers
   */
  getAll(): McpServer[] {
    return this.repository.findAll();
  }

  /**
   * Get all enabled MCP servers
   */
  getAllEnabled(): McpServer[] {
    return this.repository.findAllEnabled();
  }

  /**
   * Get an MCP server by ID
   */
  getById(id: string): McpServer | null {
    return this.repository.findById(id);
  }

  /**
   * Create a new MCP server with validation
   */
  create(data: McpServerCreate): { server?: McpServer; error?: string } {
    const validation = this.validateCreate(data);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const server = this.repository.create(data);
    return { server };
  }

  /**
   * Update an MCP server
   */
  update(id: string, data: McpServerUpdate): { server?: McpServer; error?: string; notFound?: boolean } {
    const existing = this.repository.findById(id);
    if (!existing) {
      return { notFound: true };
    }

    const server = this.repository.update(id, data);
    return { server: server || undefined };
  }

  /**
   * Delete an MCP server
   */
  delete(id: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(id);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate MCP server creation data
   */
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

  // -------------------------------------------------------------------------
  // Connection Testing
  // -------------------------------------------------------------------------

  /**
   * Test connection to an MCP server
   */
  async testConnection(id: string): Promise<McpTestResult & { notFound?: boolean }> {
    const server = this.repository.findById(id);
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

  // -------------------------------------------------------------------------
  // Status Operations
  // -------------------------------------------------------------------------

  /**
   * Get connection status of all enabled MCP servers
   */
  async getStatus(): Promise<McpStatusResult> {
    const enabledServers = this.repository.findAllEnabled();
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
