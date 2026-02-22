import { getItemService } from "@/lib/server/services";
import type { CreateItemData } from "@/lib/server/services";
import type { ToolCallStatus } from "@/types";

/**
 * Insert an item into the database.
 * Wraps ItemService.create for backward compatibility.
 */
export async function insertItem(
  agentId: string,
  itemData: CreateItemData
): Promise<{ id: string; sequence: number }> {
  const itemService = getItemService();
  const result = await itemService.create(agentId, itemData);

  if (result.error || !result.item) {
    throw new Error(result.error || "Failed to insert item");
  }

  return { id: result.item.id, sequence: result.item.sequence };
}

/**
 * Save a tool call to the database.
 * Wraps ItemService.createToolCall for backward compatibility.
 */
export async function saveToolCall(
  agentId: string,
  callId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  status: ToolCallStatus = "running"
): Promise<{ id: string; sequence: number }> {
  const itemService = getItemService();
  const result = await itemService.createToolCall(agentId, callId, toolName, toolArgs, status);

  if (result.error || !result.item) {
    throw new Error(result.error || "Failed to save tool call");
  }

  return { id: result.item.id, sequence: result.item.sequence };
}

/**
 * Save a tool result to the database.
 * Wraps ItemService.createToolResult for backward compatibility.
 */
export async function saveToolResult(
  agentId: string,
  callId: string,
  result?: unknown,
  error?: string
): Promise<{ id: string; sequence: number }> {
  const itemService = getItemService();
  const itemResult = await itemService.createToolResult(agentId, callId, result, error);

  if (itemResult.error || !itemResult.item) {
    throw new Error(itemResult.error || "Failed to save tool result");
  }

  return { id: itemResult.item.id, sequence: itemResult.item.sequence };
}

/**
 * Update tool call status.
 * Wraps ItemService.updateToolCallStatus for backward compatibility.
 */
export async function updateToolCallStatus(
  callId: string,
  status: ToolCallStatus
): Promise<void> {
  const itemService = getItemService();
  await itemService.updateToolCallStatus(callId, status);
}
