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
  getAll(): Session[] {
    return this.repository.findAll();
  }

  /**
   * Get a session by ID
   */
  getById(id: string): Session | null {
    return this.repository.findById(id);
  }

  /**
   * Get a session with its agent tree and items
   */
  getWithAgents(id: string): SessionWithAgents | null {
    const session = this.repository.findById(id);
    if (!session) {
      return null;
    }

    // Get agent tree using AgentService
    const agentService = getAgentService();
    const agentTree = agentService.getTreeBySessionId(id);

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
  create(data: CreateSessionOptions = {}): CreateSessionResult {
    const session = this.repository.create(data);
    return { session };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update a session
   */
  update(id: string, data: SessionUpdate): UpdateSessionResult {
    const session = this.repository.update(id, data);
    if (!session) {
      return { notFound: true };
    }
    return { session };
  }

  /**
   * Update session title
   */
  updateTitle(id: string, title: string): UpdateSessionResult {
    const existing = this.repository.findById(id);
    if (!existing) {
      return { notFound: true };
    }
    this.repository.updateTitle(id, title);
    return { session: this.repository.findById(id)! };
  }

  /**
   * Auto-generate title from first user message if still default
   */
  maybeGenerateTitle(id: string, content: string): void {
    const session = this.repository.findById(id);
    if (session && session.title === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      this.repository.updateTitle(id, title);
    }
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  /**
   * Delete a session
   */
  delete(id: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(id);
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
  touch(id: string): void {
    this.repository.touch(id);
  }

  /**
   * Archive a session
   */
  archive(id: string): UpdateSessionResult {
    return this.update(id, { status: "archived" });
  }

  /**
   * Reactivate an archived session
   */
  reactivate(id: string): UpdateSessionResult {
    return this.update(id, { status: "active" });
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
