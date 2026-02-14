import { SessionRepository, getSessionRepository } from "./session.repository";
import { getAgentService } from "../agent/agent.service";
import { getAgentConfigService } from "../agent-config";
import type { Session, SessionCreate, SessionUpdate, SessionWithAgents } from "@/types";

// ============================================================================
// Session Service Types
// ============================================================================

export interface CreateSessionOptions extends SessionCreate {
  agentName?: string;
  systemPrompt?: string;
  model?: string;
  agentConfigId?: string;
}

export interface CreateSessionResult {
  session?: Session;
  error?: string;
}

export interface UpdateSessionResult {
  session?: Session;
  error?: string;
  notFound?: boolean;
}

// ============================================================================
// Session Service
// ============================================================================

/**
 * Service for session business logic
 */
export class SessionService {
  private repository: SessionRepository;

  constructor(repository?: SessionRepository) {
    this.repository = repository || getSessionRepository();
  }

  // -------------------------------------------------------------------------
  // Query Operations
  // -------------------------------------------------------------------------

  /**
   * Get all sessions
   */
  async getAll(userId: string): Promise<Session[]> {
    return this.repository.findAll(userId);
  }

  /**
   * Get a session by ID
   */
  async getById(id: string, userId: string): Promise<Session | null> {
    return this.repository.findById(id, userId);
  }

  /**
   * Get a session with its agent tree and items
   */
  async getWithAgents(id: string, userId: string): Promise<SessionWithAgents | null> {
    const session = await this.repository.findById(id, userId);
    if (!session) {
      return null;
    }

    // Get agent tree using AgentService
    const agentService = getAgentService();
    const agentTree = await agentService.getTreeBySessionId(id, userId);

    return {
      ...session,
      agents: agentTree,
    };
  }

  // -------------------------------------------------------------------------
  // Create Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new session with root agent
   */
  async create(userId: string, data: CreateSessionOptions = {}): Promise<CreateSessionResult> {
    let agentConfigId = data.agentConfigId;
    let agentName = data.agentName;

    // Validate explicit agentConfigId
    if (agentConfigId) {
      const config = await getAgentConfigService().getById(agentConfigId, userId);
      if (!config) {
        return { error: "Agent config not found" };
      }
      if (!agentName) {
        agentName = config.name;
      }
    } else {
      // Fall back to user's default config
      const defaultConfig = await getAgentConfigService().getDefault(userId);
      if (defaultConfig) {
        agentConfigId = defaultConfig.id;
        if (!agentName) {
          agentName = defaultConfig.name;
        }
      }
    }

    const session = await this.repository.create(
      { ...data, agentConfigId, agentName },
      userId
    );
    return { session };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update a session
   */
  async update(id: string, data: SessionUpdate, userId: string): Promise<UpdateSessionResult> {
    const session = await this.repository.update(id, data, userId);
    if (!session) {
      return { notFound: true };
    }
    return { session };
  }

  /**
   * Update session title
   */
  async updateTitle(id: string, title: string, userId: string): Promise<UpdateSessionResult> {
    const existing = await this.repository.findById(id, userId);
    if (!existing) {
      return { notFound: true };
    }
    await this.repository.updateTitle(id, title, userId);
    return { session: (await this.repository.findById(id, userId))! };
  }

  /**
   * Auto-generate title from first user message if still default
   */
  async maybeGenerateTitle(id: string, content: string, userId: string): Promise<void> {
    const session = await this.repository.findById(id, userId);
    if (session && session.title === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await this.repository.updateTitle(id, title, userId);
    }
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  /**
   * Delete a session
   */
  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Session Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Update session timestamp
   */
  async touch(id: string, userId: string): Promise<void> {
    await this.repository.touch(id, userId);
  }

  /**
   * Archive a session
   */
  async archive(id: string, userId: string): Promise<UpdateSessionResult> {
    return this.update(id, { status: "archived" }, userId);
  }

  /**
   * Reactivate an archived session
   */
  async reactivate(id: string, userId: string): Promise<UpdateSessionResult> {
    return this.update(id, { status: "active" }, userId);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!instance) {
    instance = new SessionService();
  }
  return instance;
}
