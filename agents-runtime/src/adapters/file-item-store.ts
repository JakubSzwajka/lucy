import { appendFile, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ItemStore } from "../ports.js";
import type {
  Item,
  MessageItem,
  ToolCallItem,
  ToolCallStatus,
  ToolResultItem,
} from "../types.js";

export class FileItemStore implements ItemStore {
  constructor(private dataDir: string = ".agents-data") {}

  private filePath(): string {
    return join(this.dataDir, "items.jsonl");
  }

  private async readLines(): Promise<Item[]> {
    try {
      const data = await readFile(this.filePath(), "utf-8");
      return data
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Item);
    } catch {
      return [];
    }
  }

  private async getNextSequence(): Promise<number> {
    const items = await this.readLines();
    if (items.length === 0) return 1;
    return Math.max(...items.map((i) => i.sequence)) + 1;
  }

  private async appendItem(item: Item): Promise<void> {
    await appendFile(this.filePath(), JSON.stringify(item) + "\n", "utf-8");
  }

  async getByAgentId(agentId: string): Promise<Item[]> {
    const items = await this.readLines();
    return items.filter((item) => item.agentId === agentId);
  }

  async create(item: Item): Promise<Item> {
    const sequence = await this.getNextSequence();
    const enriched = { ...item, sequence };
    await this.appendItem(enriched);
    return enriched;
  }

  async createMessage(
    agentId: string,
    data: Omit<MessageItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<MessageItem> {
    const sequence = await this.getNextSequence();
    const item: MessageItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "message",
      createdAt: new Date(),
    };
    await this.appendItem(item);
    return item;
  }

  async createToolCall(
    agentId: string,
    data: Omit<ToolCallItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolCallItem> {
    const sequence = await this.getNextSequence();
    const item: ToolCallItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "tool_call",
      createdAt: new Date(),
    };
    await this.appendItem(item);
    return item;
  }

  async createToolResult(
    agentId: string,
    data: Omit<ToolResultItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolResultItem> {
    const sequence = await this.getNextSequence();
    const item: ToolResultItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "tool_result",
      createdAt: new Date(),
    };
    await this.appendItem(item);
    return item;
  }

  async updateToolCallStatus(itemId: string, status: ToolCallStatus): Promise<void> {
    const filePath = this.filePath();

    let data: string;
    try {
      data = await readFile(filePath, "utf-8");
    } catch {
      throw new Error(`Item not found: ${itemId}`);
    }

    const lines = data.split("\n").filter((line) => line.trim().length > 0);

    let found = false;
    const updated = lines.map((line) => {
      const item = JSON.parse(line) as Item;
      if (item.id === itemId && item.type === "tool_call") {
        found = true;
        return JSON.stringify({ ...item, toolStatus: status });
      }
      return line;
    });

    if (!found) {
      throw new Error(`Item not found: ${itemId}`);
    }

    await writeFile(filePath, updated.join("\n") + "\n", "utf-8");
  }
}
