import { AgentConfigRepository, getAgentConfigRepository } from "./agent-config.repository";
import type {
  AgentConfigWithTools,
  AgentConfigCreate,
  AgentConfigUpdate,
} from "@/types";

// ============================================================================
// Agent Config Service
// ============================================================================

export class AgentConfigService {
  private repository: AgentConfigRepository;

  constructor(repository?: AgentConfigRepository) {
    this.repository = repository || getAgentConfigRepository();
  }

  // -------------------------------------------------------------------------
  // Query Operations
  // -------------------------------------------------------------------------

  async getAll(userId: string): Promise<AgentConfigWithTools[]> {
    return this.repository.findAll(userId);
  }

  async getById(id: string, userId: string): Promise<AgentConfigWithTools | null> {
    return this.repository.findById(id, userId);
  }

  async getDefault(userId: string): Promise<AgentConfigWithTools | null> {
    return this.repository.findDefault(userId);
  }

  async getByIds(ids: string[], userId: string): Promise<AgentConfigWithTools[]> {
    return this.repository.findByIds(ids, userId);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(
    data: AgentConfigCreate,
    userId: string
  ): Promise<{ config?: AgentConfigWithTools; error?: string }> {
    // Validate circular delegation
    if (data.tools) {
      const error = await this.checkCircularDelegation(data.tools, null, userId);
      if (error) return { error };
    }

    // If setting as default, unset previous
    if (data.isDefault) {
      const current = await this.repository.findDefault(userId);
      if (current) {
        await this.repository.setDefault(current.id, userId);
      }
    }

    const config = await this.repository.create(data, userId);

    if (data.isDefault) {
      await this.repository.setDefault(config.id, userId);
    }

    return { config };
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  async update(
    id: string,
    data: AgentConfigUpdate,
    userId: string
  ): Promise<{ config?: AgentConfigWithTools; error?: string; notFound?: boolean }> {
    const existing = await this.repository.findById(id, userId);
    if (!existing) return { notFound: true };

    // Validate circular delegation
    if (data.tools) {
      const error = await this.checkCircularDelegation(data.tools, id, userId);
      if (error) return { error };
    }

    // Handle default toggling
    if (data.isDefault) {
      await this.repository.setDefault(id, userId);
    }

    const config = await this.repository.update(id, data, userId);
    return { config: config ?? undefined };
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) return { success: false, notFound: true };
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Circular Delegation Check
  // -------------------------------------------------------------------------

  /**
   * Walk the delegate graph to detect cycles.
   * A delegate tool's `ref` points to another agent config ID.
   * If following delegate refs leads back to `configId`, it's circular.
   */
  private async checkCircularDelegation(
    tools: { type: string; ref: string }[],
    configId: string | null,
    userId: string
  ): Promise<string | null> {
    if (!configId) return null; // New config can't have cycles yet (nothing points to it)

    const delegateRefs = tools
      .filter((t) => t.type === "delegate")
      .map((t) => t.ref);

    if (delegateRefs.length === 0) return null;

    const visited = new Set<string>([configId]);
    const queue = [...delegateRefs];

    while (queue.length > 0) {
      const ref = queue.shift()!;

      if (visited.has(ref)) {
        return `Circular delegation detected: config "${ref}" would create a cycle`;
      }

      visited.add(ref);

      // Load the referenced config's delegate tools
      const refConfig = await this.repository.findById(ref, userId);
      if (!refConfig) continue;

      for (const tool of refConfig.tools) {
        if (tool.toolType === "delegate") {
          queue.push(tool.toolRef);
        }
      }
    }

    return null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AgentConfigService | null = null;

export function getAgentConfigService(): AgentConfigService {
  if (!instance) {
    instance = new AgentConfigService();
  }
  return instance;
}
