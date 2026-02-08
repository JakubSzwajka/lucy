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

export class ItemService {
  private repository: ItemRepository;

  constructor(repository?: ItemRepository) {
    this.repository = repository || getItemRepository();
  }

  getByAgentId(agentId: string): Item[] {
    return this.repository.findByAgentId(agentId);
  }

  getById(id: string): Item | null {
    return this.repository.findById(id);
  }

  getByCallId(callId: string): Item | null {
    return this.repository.findByCallId(callId);
  }

  create(agentId: string, data: CreateItemData, userId?: string): CreateItemResult {
    if (userId) {
      const agentCheck = this.repository.agentExists(agentId, userId);
      if (!agentCheck.exists) {
        return { notFound: true };
      }
    }

    const validation = this.validateCreate(data);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const item = this.repository.create(agentId, data);

    // Update session timestamp
    if (userId) {
      const agentCheck = this.repository.agentExists(agentId, userId);
      if (agentCheck.sessionId) {
        this.repository.updateSessionTimestamp(agentCheck.sessionId);

        if (data.type === "message" && data.role === "user") {
          this.maybeUpdateSessionTitle(agentCheck.sessionId, data.content);
        }
      }
    }

    return { item };
  }

  createMessage(
    agentId: string,
    role: "user" | "assistant" | "system",
    content: string,
    userId?: string
  ): CreateItemResult {
    return this.create(agentId, { type: "message", role, content }, userId);
  }

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

  updateToolCallStatus(callId: string, status: ToolCallStatus): boolean {
    return this.repository.updateToolCallStatus(callId, status);
  }

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
