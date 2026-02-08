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

  getById(id: string, userId: string): Agent | null {
    return this.repository.findById(id, userId);
  }

  getByIdWithItems(id: string, userId: string): AgentWithItems | null {
    return this.repository.findByIdWithItems(id, userId);
  }

  getBySessionId(sessionId: string, userId: string): Agent[] {
    return this.repository.findBySessionId(sessionId, userId);
  }

  getBySessionIdWithItems(sessionId: string, userId: string): AgentWithItems[] {
    return this.repository.findBySessionIdWithItems(sessionId, userId);
  }

  getTreeBySessionId(sessionId: string, userId: string): AgentWithItems[] {
    const agentsWithItems = this.repository.findBySessionIdWithItems(sessionId, userId);
    return this.buildAgentTree(agentsWithItems);
  }

  // -------------------------------------------------------------------------
  // Create Operations
  // -------------------------------------------------------------------------

  create(data: AgentCreate, userId: string): CreateAgentResult {
    if (!data.sessionId || !data.name) {
      return { error: "sessionId and name are required" };
    }

    if (!this.repository.sessionExists(data.sessionId, userId)) {
      return { notFound: true, error: "Session not found" };
    }

    const agent = this.repository.create(data, userId);
    return { agent };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  update(id: string, data: AgentUpdate, userId: string): UpdateAgentResult {
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

    const agent = this.repository.update(id, filteredData, userId);
    if (!agent) {
      return { notFound: true };
    }
    return { agent };
  }

  updateStatus(id: string, status: AgentStatus, userId: string): UpdateAgentResult {
    const updated = this.repository.updateStatus(id, status, userId);
    if (!updated) {
      return { notFound: true };
    }
    return { agent: this.repository.findById(id, userId)! };
  }

  markRunning(id: string, userId: string): UpdateAgentResult {
    return this.update(id, { status: "running", startedAt: new Date() }, userId);
  }

  markCompleted(id: string, userId: string, result?: string): UpdateAgentResult {
    return this.update(id, { status: "completed", completedAt: new Date(), result }, userId);
  }

  markFailed(id: string, error: string, userId: string): UpdateAgentResult {
    return this.update(id, { status: "failed", completedAt: new Date(), error }, userId);
  }

  incrementTurnCount(id: string, userId: string): UpdateAgentResult {
    const agent = this.repository.findById(id, userId);
    if (!agent) {
      return { notFound: true };
    }
    return this.update(id, { turnCount: agent.turnCount + 1 }, userId);
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  delete(id: string, userId: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(id, userId);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Tree Building
  // -------------------------------------------------------------------------

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
