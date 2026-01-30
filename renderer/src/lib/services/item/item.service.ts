import {
  ItemRepository,
  getItemRepository,
  CreateItemData,
  CreateMessageData,
  CreateToolCallData,
  CreateToolResultData,
  CreateReasoningData,
} from "./item.repository";
import type { Item, ToolCallStatus } from "@/types";

// ============================================================================
// Item Service Types
// ============================================================================

export interface CreateItemResult {
  item?: Item;
  error?: string;
  notFound?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Item Service
// ============================================================================

/**
 * Service for item business logic
 */
export class ItemService {
  private repository: ItemRepository;

  constructor(repository?: ItemRepository) {
    this.repository = repository || getItemRepository();
  }

  // -------------------------------------------------------------------------
  // Query Operations
  // -------------------------------------------------------------------------

  /**
   * Get all items for an agent
   */
  getByAgentId(agentId: string): Item[] {
    return this.repository.findByAgentId(agentId);
  }

  /**
   * Get an item by ID
   */
  getById(id: string): Item | null {
    return this.repository.findById(id);
  }

  /**
   * Get item by call ID
   */
  getByCallId(callId: string): Item | null {
    return this.repository.findByCallId(callId);
  }

  // -------------------------------------------------------------------------
  // Create Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new item with validation
   */
  create(agentId: string, data: CreateItemData): CreateItemResult {
    // Check agent exists
    const agentCheck = this.repository.agentExists(agentId);
    if (!agentCheck.exists) {
      return { notFound: true };
    }

    // Validate item data
    const validation = this.validateCreate(data);
    if (!validation.valid) {
      return { error: validation.error };
    }

    // Create item
    const item = this.repository.create(agentId, data);

    // Update session timestamp
    if (agentCheck.sessionId) {
      this.repository.updateSessionTimestamp(agentCheck.sessionId);

      // Auto-generate session title from first user message if still "New Chat"
      if (data.type === "message" && data.role === "user") {
        this.maybeUpdateSessionTitle(agentCheck.sessionId, data.content);
      }
    }

    return { item };
  }

  /**
   * Create a message item
   */
  createMessage(
    agentId: string,
    role: "user" | "assistant" | "system",
    content: string
  ): CreateItemResult {
    return this.create(agentId, { type: "message", role, content });
  }

  /**
   * Create a tool call item
   */
  createToolCall(
    agentId: string,
    callId: string,
    toolName: string,
    toolArgs?: Record<string, unknown> | null,
    status: ToolCallStatus = "running"
  ): CreateItemResult {
    return this.create(agentId, {
      type: "tool_call",
      callId,
      toolName,
      toolArgs,
      toolStatus: status,
    });
  }

  /**
   * Create a tool result item
   */
  createToolResult(
    agentId: string,
    callId: string,
    output?: unknown,
    error?: string
  ): CreateItemResult {
    return this.create(agentId, {
      type: "tool_result",
      callId,
      toolOutput: output !== undefined ? JSON.stringify(output) : null,
      toolError: error || null,
    });
  }

  /**
   * Create a reasoning item
   */
  createReasoning(
    agentId: string,
    content: string,
    summary?: string
  ): CreateItemResult {
    return this.create(agentId, {
      type: "reasoning",
      reasoningContent: content,
      reasoningSummary: summary || null,
    });
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update tool call status
   */
  updateToolCallStatus(callId: string, status: ToolCallStatus): boolean {
    return this.repository.updateToolCallStatus(callId, status);
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate item creation data
   */
  validateCreate(data: CreateItemData): ValidationResult {
    switch (data.type) {
      case "message":
        return this.validateMessage(data);
      case "tool_call":
        return this.validateToolCall(data);
      case "tool_result":
        return this.validateToolResult(data);
      case "reasoning":
        return this.validateReasoning(data);
      default:
        return { valid: false, error: `Unknown item type: ${(data as CreateItemData).type}` };
    }
  }

  private validateMessage(data: CreateMessageData): ValidationResult {
    if (!data.role || !data.content) {
      return { valid: false, error: "message type requires role and content" };
    }
    if (!["user", "assistant", "system"].includes(data.role)) {
      return { valid: false, error: "invalid role for message type" };
    }
    return { valid: true };
  }

  private validateToolCall(data: CreateToolCallData): ValidationResult {
    if (!data.callId || !data.toolName) {
      return { valid: false, error: "tool_call type requires callId and toolName" };
    }
    return { valid: true };
  }

  private validateToolResult(data: CreateToolResultData): ValidationResult {
    if (!data.callId) {
      return { valid: false, error: "tool_result type requires callId" };
    }
    return { valid: true };
  }

  private validateReasoning(data: CreateReasoningData): ValidationResult {
    if (!data.reasoningContent) {
      return { valid: false, error: "reasoning type requires reasoningContent" };
    }
    return { valid: true };
  }

  // -------------------------------------------------------------------------
  // Session Title Generation
  // -------------------------------------------------------------------------

  /**
   * Update session title if it's still the default "New Chat"
   */
  private maybeUpdateSessionTitle(sessionId: string, content: string): void {
    const currentTitle = this.repository.getSessionTitle(sessionId);
    if (currentTitle === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      this.repository.updateSessionTitle(sessionId, title);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ItemService | null = null;

export function getItemService(): ItemService {
  if (!instance) {
    instance = new ItemService();
  }
  return instance;
}
