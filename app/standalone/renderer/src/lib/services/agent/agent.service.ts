import { AgentRepository, getAgentRepository } from "./agent.repository";
import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  AgentStatus,
  AgentWithItems,
} from "@/types";

// ============================================================================
// Agent Service Types
// ============================================================================

export interface CreateAgentResult {
  agent?: Agent;
  error?: string;
  notFound?: boolean;
}

export interface UpdateAgentResult {
  agent?: Agent;
  error?: string;
  notFound?: boolean;
}

// ============================================================================
// Agent Service
// ============================================================================

/**
 * Service for agent business logic
 */
export class AgentService {
  private repository: AgentRepository;

  constructor(repository?: AgentRepository) {
    this.repository = repository || getAgentRepository();
  }

  // -------------------------------------------------------------------------
  // Query Operations
  // -------------------------------------------------------------------------

  /**
   * Get an agent by ID
   */
  getById(id: string): Agent | null {
    return this.repository.findById(id);
  }

  /**
   * Get an agent by ID with its items
   */
  getByIdWithItems(id: string): AgentWithItems | null {
    return this.repository.findByIdWithItems(id);
  }

  /**
   * Get all agents for a session
   */
  getBySessionId(sessionId: string): Agent[] {
    return this.repository.findBySessionId(sessionId);
  }

  /**
   * Get all agents for a session with their items
   */
  getBySessionIdWithItems(sessionId: string): AgentWithItems[] {
    return this.repository.findBySessionIdWithItems(sessionId);
  }

  /**
   * Get agent tree for a session (root agents with nested children)
   */
  getTreeBySessionId(sessionId: string): AgentWithItems[] {
    const agentsWithItems = this.repository.findBySessionIdWithItems(sessionId);
    return this.buildAgentTree(agentsWithItems);
  }

  // -------------------------------------------------------------------------
  // Create Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new agent
   */
  create(data: AgentCreate): CreateAgentResult {
    // Validate required fields
    if (!data.sessionId || !data.name) {
      return { error: "sessionId and name are required" };
    }

    // Verify session exists
    if (!this.repository.sessionExists(data.sessionId)) {
      return { notFound: true, error: "Session not found" };
    }

    const agent = this.repository.create(data);
    return { agent };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update an agent
   */
  update(id: string, data: AgentUpdate): UpdateAgentResult {
    // Filter to allowed fields
    const allowedFields: (keyof AgentUpdate)[] = [
      "status",
      "waitingForCallId",
      "result",
      "error",
      "turnCount",
      "startedAt",
      "completedAt",
    ];

    const filteredData: AgentUpdate = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        (filteredData as Record<string, unknown>)[field] = data[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return { error: "No valid fields to update" };
    }

    const agent = this.repository.update(id, filteredData);
    if (!agent) {
      return { notFound: true };
    }
    return { agent };
  }

  /**
   * Update agent status
   */
  updateStatus(id: string, status: AgentStatus): UpdateAgentResult {
    const updated = this.repository.updateStatus(id, status);
    if (!updated) {
      return { notFound: true };
    }
    return { agent: this.repository.findById(id)! };
  }

  /**
   * Mark agent as running
   */
  markRunning(id: string): UpdateAgentResult {
    return this.update(id, { status: "running", startedAt: new Date() });
  }

  /**
   * Mark agent as completed
   */
  markCompleted(id: string, result?: string): UpdateAgentResult {
    return this.update(id, {
      status: "completed",
      completedAt: new Date(),
      result,
    });
  }

  /**
   * Mark agent as failed
   */
  markFailed(id: string, error: string): UpdateAgentResult {
    return this.update(id, {
      status: "failed",
      completedAt: new Date(),
      error,
    });
  }

  /**
   * Increment turn count
   */
  incrementTurnCount(id: string): UpdateAgentResult {
    const agent = this.repository.findById(id);
    if (!agent) {
      return { notFound: true };
    }
    return this.update(id, { turnCount: agent.turnCount + 1 });
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  /**
   * Delete an agent
   */
  delete(id: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(id);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Tree Building
  // -------------------------------------------------------------------------

  /**
   * Build a tree structure from flat list of agents
   */
  private buildAgentTree(agentsWithItems: AgentWithItems[]): AgentWithItems[] {
    const rootAgents = agentsWithItems.filter((a) => !a.parentId);
    const childAgents = agentsWithItems.filter((a) => a.parentId);

    const buildTree = (agent: AgentWithItems): AgentWithItems => {
      const children = childAgents
        .filter((c) => c.parentId === agent.id)
        .map(buildTree);
      return { ...agent, children: children.length > 0 ? children : undefined };
    };

    return rootAgents.map(buildTree);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AgentService | null = null;

export function getAgentService(): AgentService {
  if (!instance) {
    instance = new AgentService();
  }
  return instance;
}
