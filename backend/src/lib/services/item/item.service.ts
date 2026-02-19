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

  async getByAgentId(agentId: string): Promise<Item[]> {
    return this.repository.findByAgentId(agentId);
  }

  async getById(id: string): Promise<Item | null> {
    return this.repository.findById(id);
  }

  async getByCallId(callId: string): Promise<Item | null> {
    return this.repository.findByCallId(callId);
  }

  async create(agentId: string, data: CreateItemData, userId?: string): Promise<CreateItemResult> {
    if (userId) {
      const agentCheck = await this.repository.agentExists(agentId, userId);
      if (!agentCheck.exists) {
        return { notFound: true };
      }
    }

    const validation = this.validateCreate(data);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const item = await this.repository.create(agentId, data);

    // Update session timestamp
    if (userId) {
      const agentCheck = await this.repository.agentExists(agentId, userId);
      if (agentCheck.sessionId) {
        await this.repository.updateSessionTimestamp(agentCheck.sessionId);

        if (data.type === "message" && data.role === "user") {
          await this.maybeUpdateSessionTitle(agentCheck.sessionId, data.content);
        }
      }
    }

    return { item };
  }

  async createMessage(
    agentId: string,
    role: "user" | "assistant" | "system",
    content: string,
    userId?: string,
    contentParts?: string | null,
  ): Promise<CreateItemResult> {
    return this.create(agentId, { type: "message", role, content, contentParts }, userId);
  }

  async createToolCall(
    agentId: string,
    callId: string,
    toolName: string,
    toolArgs?: Record<string, unknown> | null,
    status: ToolCallStatus = "running"
  ): Promise<CreateItemResult> {
    return this.create(agentId, {
      type: "tool_call",
      callId,
      toolName,
      toolArgs,
      toolStatus: status,
    });
  }

  async createToolResult(
    agentId: string,
    callId: string,
    output?: unknown,
    error?: string
  ): Promise<CreateItemResult> {
    return this.create(agentId, {
      type: "tool_result",
      callId,
      toolOutput: output !== undefined ? JSON.stringify(output) : null,
      toolError: error || null,
    });
  }

  async createReasoning(
    agentId: string,
    content: string,
    summary?: string
  ): Promise<CreateItemResult> {
    return this.create(agentId, {
      type: "reasoning",
      reasoningContent: content,
      reasoningSummary: summary || null,
    });
  }

  async rewindToItem(
    itemId: string,
    newContent: string,
    userId: string
  ): Promise<{ item: Item; agentId: string; sessionId: string } | { error: string; status: number }> {
    const item = await this.repository.findById(itemId);
    if (!item) {
      return { error: "Item not found", status: 404 };
    }
    if (item.type !== "message" || (item as import("@/types").MessageItem).role !== "user") {
      return { error: "Can only rewind to a user message", status: 400 };
    }

    const agentCheck = await this.repository.agentExists(item.agentId, userId);
    if (!agentCheck.exists) {
      return { error: "Unauthorized", status: 403 };
    }

    await this.repository.deleteAfterSequence(item.agentId, item.sequence);
    await this.repository.updateItemContent(itemId, newContent);

    const updated = await this.repository.findById(itemId);
    return { item: updated!, agentId: item.agentId, sessionId: agentCheck.sessionId! };
  }

  async updateToolCallStatus(callId: string, status: ToolCallStatus): Promise<boolean> {
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

  private async maybeUpdateSessionTitle(sessionId: string, content: string): Promise<void> {
    const currentTitle = await this.repository.getSessionTitle(sessionId);
    if (currentTitle === "New Chat") {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await this.repository.updateSessionTitle(sessionId, title);
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
