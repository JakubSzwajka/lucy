import type { Item, ToolCallItem, ToolResultItem, ModelMessage } from "./types.js";

type ToolCallContent = { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> };
type ToolResultContent = { type: "tool-result"; toolCallId: string; toolName: string; output: { type: "text"; value: string } };

type FullModelMessage = {
  role: "user" | "assistant" | "tool";
  content: string | ToolCallContent[] | ToolResultContent[];
};

/**
 * Build model messages from items (streaming mode).
 * Only includes user/assistant message items. Tool calls/results are handled by streamText internally.
 * Prepends ISO timestamps for LLM context.
 */
export function itemsToModelMessages(allItems: Item[]): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const item of allItems) {
    if (item.type !== "message") continue;
    if (item.role === "system") continue;

    const role = item.role as "user" | "assistant";
    const timestamp = item.createdAt ? `[${new Date(item.createdAt).toISOString()}] ` : "";

    if (item.contentParts) {
      try {
        const parts: { type: string; text?: string; url?: string; mediaType?: string }[] = JSON.parse(item.contentParts);
        const contentParts: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [];
        let addedTimestamp = false;

        for (const part of parts) {
          if (part.type === "text" && part.text) {
            const prefix = !addedTimestamp ? timestamp : "";
            contentParts.push({ type: "text", text: `${prefix}${part.text}` });
            addedTimestamp = true;
          } else if (part.type === "file" && part.url) {
            contentParts.push({ type: "image", image: new URL(part.url) });
          }
        }

        if (!addedTimestamp && timestamp) {
          contentParts.unshift({ type: "text", text: timestamp.trim() });
        }

        if (contentParts.length > 0) {
          messages.push({ role, content: contentParts });
          continue;
        }
      } catch {
        // Fall through to text-only
      }
    }

    messages.push({ role, content: `${timestamp}${item.content}` });
  }

  return messages;
}

/**
 * Build full model messages including tool calls and results (non-streaming mode).
 * Groups consecutive tool_call items into assistant messages with tool-call parts,
 * and consecutive tool_result items into tool messages with tool-result parts.
 * This uses the AI SDK's CoreMessage format for generateText.
 */
export function itemsToFullModelMessages(allItems: Item[]): FullModelMessage[] {
  const messages: FullModelMessage[] = [];
  let i = 0;

  while (i < allItems.length) {
    const item = allItems[i];

    if (item.type === "message") {
      if (item.role === "system") { i++; continue; }
      const role = item.role as "user" | "assistant";
      const timestamp = item.createdAt ? `[${new Date(item.createdAt).toISOString()}] ` : "";
      messages.push({ role, content: `${timestamp}${item.content}` });
      i++;
    } else if (item.type === "tool_call") {
      const toolCallParts: Array<{ type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }> = [];
      while (i < allItems.length && allItems[i].type === "tool_call") {
        const tc = allItems[i] as ToolCallItem;
        toolCallParts.push({
          type: "tool-call",
          toolCallId: tc.callId,
          toolName: tc.toolName,
          input: tc.toolArgs ?? {},
        });
        i++;
      }
      messages.push({ role: "assistant", content: toolCallParts });
    } else if (item.type === "tool_result") {
      const toolResultParts: Array<{ type: "tool-result"; toolCallId: string; toolName: string; output: { type: "text"; value: string } }> = [];
      while (i < allItems.length && allItems[i].type === "tool_result") {
        const tr = allItems[i] as ToolResultItem;
        const matchingCall = allItems.find(
          (x): x is ToolCallItem => x.type === "tool_call" && x.callId === tr.callId
        );
        toolResultParts.push({
          type: "tool-result",
          toolCallId: tr.callId,
          toolName: matchingCall?.toolName ?? "unknown",
          output: { type: "text", value: tr.toolOutput ?? tr.toolError ?? "" },
        });
        i++;
      }
      messages.push({ role: "tool", content: toolResultParts });
    } else {
      i++;
    }
  }

  return messages;
}

/**
 * Apply sliding window based on user message count.
 * Keeps the last N user messages and everything between/after them.
 */
export function applySlidingWindow(allItems: Item[], maxUserMessages = 10): Item[] {
  const userMessageIndices: number[] = [];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.type === "message" && item.role === "user") {
      userMessageIndices.push(i);
    }
  }

  if (userMessageIndices.length <= maxUserMessages) {
    return allItems;
  }

  const cutoffIndex = userMessageIndices[userMessageIndices.length - maxUserMessages];
  return allItems.slice(cutoffIndex);
}

/**
 * Replace image parts with text placeholder for models that don't support images.
 */
export function stripImageParts(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (!Array.isArray(msg.content)) return msg;
    const filtered = msg.content.map((part) => {
      if ("image" in part && part.type === "image") {
        return { type: "text" as const, text: "[image attachment omitted — model does not support images]" };
      }
      return part;
    });
    return { ...msg, content: filtered };
  });
}

/**
 * Prepend system prompt as a system message if not already present.
 */
export function prependSystemPrompt(messages: ModelMessage[], systemPrompt: string | null): ModelMessage[] {
  if (!systemPrompt) return messages;
  const hasSystemMessage = messages.some((m) => m.role === "system");
  if (hasSystemMessage) return messages;
  return [{ role: "system", content: systemPrompt }, ...messages];
}
