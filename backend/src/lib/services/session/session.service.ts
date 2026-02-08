import { SessionRepository, getSessionRepository } from "./session.repository";
import { getAgentService } from "../agent/agent.service";
import type { Session, SessionCreate, SessionUpdate, SessionWithAgents } from "@/types";

// ============================================================================
// Session Service Types
// ============================================================================

export interface CreateSessionOptions extends SessionCreate {
  agentName?: string;
  systemPrompt?: string;
  model?: string;
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
  getAll(userId: string): Session[] {
    return this.repository.findAll(userId);
  }

  /**
   * Get a session by ID
   */
  getById(id: string, userId: string): Session | null {
    return this.repository.findById(id, userId);
  }

  /**
   * Get a session with its agent tree and items
   */
  getWithAgents(id: string, userId: string): SessionWithAgents | null {
    const session = this.repository.findById(id, userId);
    if (!session) {
      return null;
    }

    // Get agent tree using AgentService
    const agentService = getAgentService();
    const agentTree = agentService.getTreeBySessionId(id, userId);

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
  create(userId: string, data: CreateSessionOptions = {}): CreateSessionResult {
    const session = this.repository.create(data, userId);
    return { session };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update a session
   */
  update(id: string, data: SessionUpdate, userId: string): UpdateSessionResult {
    const session = this.repository.update(id, data, userId);
    if (!session) {
      return { notFound: true };
    }
    return { session };
  }

  /**
   * Update session title
   */
  updateTitle(id: string, title: string, userId: string): UpdateSessionResult {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      return { notFound: true };
    }
    this.repository.updateTitle(id, title, userId);
    return { session: this.repository.findById(id, userId)! };
  }

  /**
   * Auto-generate title from first user message if still default
   */
  maybeGenerateTitle(id: string, content: string, userId: string): void {
    const session = this.repository.findById(id, userId);
    if (session && session.title === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      this.repository.updateTitle(id, title, userId);
    }
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  /**
   * Delete a session
   */
  delete(id: string, userId: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(id, userId);
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
  touch(id: string, userId: string): void {
    this.repository.touch(id, userId);
  }

  /**
   * Archive a session
   */
  archive(id: string, userId: string): UpdateSessionResult {
    return this.update(id, { status: "archived" }, userId);
  }

  /**
   * Reactivate an archived session
   */
  reactivate(id: string, userId: string): UpdateSessionResult {
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
