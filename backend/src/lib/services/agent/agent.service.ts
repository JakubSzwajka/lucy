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

  async getById(id: string, userId: string): Promise<Agent | null> {
    return this.repository.findById(id, userId);
  }

  async getByIdWithItems(id: string, userId: string): Promise<AgentWithItems | null> {
    return this.repository.findByIdWithItems(id, userId);
  }

  async getBySessionId(sessionId: string, userId: string): Promise<Agent[]> {
    return this.repository.findBySessionId(sessionId, userId);
  }

  async getBySessionIdWithItems(sessionId: string, userId: string): Promise<AgentWithItems[]> {
    return this.repository.findBySessionIdWithItems(sessionId, userId);
  }

  async getTreeBySessionId(sessionId: string, userId: string): Promise<AgentWithItems[]> {
    const agentsWithItems = await this.repository.findBySessionIdWithItems(sessionId, userId);
    return this.buildAgentTree(agentsWithItems);
  }

  // -------------------------------------------------------------------------
  // Create Operations
  // -------------------------------------------------------------------------

  async create(data: AgentCreate, userId: string): Promise<CreateAgentResult> {
    if (!data.sessionId || !data.name) {
      return { error: "sessionId and name are required" };
    }

    if (!(await this.repository.sessionExists(data.sessionId, userId))) {
      return { notFound: true, error: "Session not found" };
    }

    const agent = await this.repository.create(data, userId);
    return { agent };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  async update(id: string, data: AgentUpdate, userId: string): Promise<UpdateAgentResult> {
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

    const agent = await this.repository.update(id, filteredData, userId);
    if (!agent) {
      return { notFound: true };
    }
    return { agent };
  }

  async updateStatus(id: string, status: AgentStatus, userId: string): Promise<UpdateAgentResult> {
    const updated = await this.repository.updateStatus(id, status, userId);
    if (!updated) {
      return { notFound: true };
    }
    return { agent: (await this.repository.findById(id, userId))! };
  }

  async markRunning(id: string, userId: string): Promise<UpdateAgentResult> {
    return this.update(id, { status: "running", startedAt: new Date() }, userId);
  }

  async markCompleted(id: string, userId: string, result?: string): Promise<UpdateAgentResult> {
    return this.update(id, { status: "completed", completedAt: new Date(), result }, userId);
  }

  async markFailed(id: string, error: string, userId: string): Promise<UpdateAgentResult> {
    return this.update(id, { status: "failed", completedAt: new Date(), error }, userId);
  }

  async incrementTurnCount(id: string, userId: string): Promise<UpdateAgentResult> {
    const agent = await this.repository.findById(id, userId);
    if (!agent) {
      return { notFound: true };
    }
    return this.update(id, { turnCount: agent.turnCount + 1 }, userId);
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(id, userId);
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
