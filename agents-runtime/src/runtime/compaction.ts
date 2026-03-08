import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateText, type LanguageModel } from "ai";
import type { Item, MessageItem } from "../types.js";

export interface CompactionConfig {
  windowSize?: number;
  summarizationModel?: string;
}

export interface CompactionState {
  summary: string;
  compactedUpToSequence: number;
  updatedAt: string;
}

const COMPACTION_PROMPT = `You are a conversation summarizer. Given the following conversation history, produce a concise summary that captures:
- Key topics discussed
- Important decisions or conclusions
- Any pending questions or action items
- Relevant context needed for continuing the conversation

Be concise but preserve important details. Write in third person ("The user asked about...", "The assistant explained...").

Conversation to summarize:`;

export class CompactionService {
  private filePath: string;

  constructor(
    private dataDir: string,
    private config: CompactionConfig = {},
  ) {
    this.filePath = join(dataDir, "compaction.json");
  }

  get windowSize(): number {
    return this.config.windowSize ?? 50;
  }

  async getState(): Promise<CompactionState | null> {
    try {
      const data = await readFile(this.filePath, "utf-8");
      return JSON.parse(data) as CompactionState;
    } catch {
      return null;
    }
  }

  async compactIfNeeded(
    items: Item[],
    getLanguageModel: (modelId?: string) => Promise<LanguageModel>,
  ): Promise<void> {
    const userMessages = items.filter(
      (i) => i.type === "message" && i.role === "user",
    );

    if (userMessages.length <= this.windowSize) {
      return;
    }

    const existingState = await this.getState();
    const compactedUpTo = existingState?.compactedUpToSequence ?? 0;

    // Find the cutoff: keep the last windowSize user messages
    const cutoffUserMsg = userMessages[userMessages.length - this.windowSize];
    const cutoffSequence = cutoffUserMsg.sequence;

    // Items to compact: everything before the cutoff that hasn't been compacted yet
    const itemsToCompact = items.filter(
      (i) => i.sequence < cutoffSequence && i.sequence > compactedUpTo,
    );

    if (itemsToCompact.length === 0) {
      return;
    }

    const conversationText = formatItemsForSummary(itemsToCompact);
    const previousSummary = existingState?.summary;

    const prompt = previousSummary
      ? `${COMPACTION_PROMPT}\n\n--- Previous Summary ---\n${previousSummary}\n\n--- New Messages to Incorporate ---\n${conversationText}`
      : `${COMPACTION_PROMPT}\n\n${conversationText}`;

    const model = await getLanguageModel(this.config.summarizationModel);
    const result = await generateText({
      model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
    });

    const newState: CompactionState = {
      summary: result.text,
      compactedUpToSequence: cutoffSequence - 1,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(this.filePath, JSON.stringify(newState, null, 2), "utf-8");
  }
}

function formatItemsForSummary(items: Item[]): string {
  const lines: string[] = [];

  for (const item of items) {
    if (item.type === "message") {
      const msg = item as MessageItem;
      const role = msg.role === "user" ? "User" : "Assistant";
      lines.push(`${role}: ${msg.content}`);
    } else if (item.type === "tool_call") {
      lines.push(`[Tool call: ${item.toolName}]`);
    } else if (item.type === "tool_result") {
      const output = item.toolOutput ?? item.toolError ?? "";
      const truncated = output.length > 200 ? output.slice(0, 200) + "..." : output;
      lines.push(`[Tool result: ${truncated}]`);
    }
  }

  return lines.join("\n");
}
