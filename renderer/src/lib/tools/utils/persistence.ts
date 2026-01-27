import { db, items, NewItem } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Get next sequence number for an agent
async function getNextSequence(agentId: string): Promise<number> {
  const [maxSeq] = await db
    .select({ max: sql<number>`MAX(${items.sequence})` })
    .from(items)
    .where(eq(items.agentId, agentId));

  return (maxSeq?.max ?? -1) + 1;
}

// Insert an item with auto-incrementing sequence
export async function insertItem(
  agentId: string,
  itemData: Omit<NewItem, "id" | "agentId" | "sequence">
): Promise<{ id: string; sequence: number }> {
  const sequence = await getNextSequence(agentId);
  const id = uuidv4();

  await db.insert(items).values({
    id,
    agentId,
    sequence,
    ...itemData,
  } as NewItem);

  return { id, sequence };
}

// Save a tool call to the database
export async function saveToolCall(
  agentId: string,
  callId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  status: "pending" | "pending_approval" | "running" | "completed" | "failed" = "running"
): Promise<{ id: string; sequence: number }> {
  return insertItem(agentId, {
    type: "tool_call",
    callId,
    toolName,
    toolArgs,
    toolStatus: status,
  });
}

// Save a tool result to the database
export async function saveToolResult(
  agentId: string,
  callId: string,
  result?: unknown,
  error?: string
): Promise<{ id: string; sequence: number }> {
  return insertItem(agentId, {
    type: "tool_result",
    callId,
    toolOutput: result !== undefined ? JSON.stringify(result) : undefined,
    toolError: error,
  });
}

// Update tool call status
export async function updateToolCallStatus(
  callId: string,
  status: "pending" | "pending_approval" | "running" | "completed" | "failed"
): Promise<void> {
  await db
    .update(items)
    .set({ toolStatus: status })
    .where(eq(items.callId, callId));
}
