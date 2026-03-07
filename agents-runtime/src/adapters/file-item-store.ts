import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ItemStore } from "../ports.js";
import type {
  Item,
  MessageItem,
  ToolCallItem,
  ToolResultItem,
  ToolCallStatus,
} from "../types.js";

export class FileItemStore implements ItemStore {
  constructor(private dataDir: string = ".agents-data") {}

  private filePath(agentId: string): string {
    return join(this.dataDir, "items", `${agentId}.jsonl`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(join(this.dataDir, "items"), { recursive: true });
  }

  private async readLines(agentId: string): Promise<Item[]> {
    try {
      const data = await readFile(this.filePath(agentId), "utf-8");
      return data
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Item);
    } catch {
      return [];
    }
  }

  private async getNextSequence(agentId: string): Promise<number> {
    const items = await this.readLines(agentId);
    if (items.length === 0) return 1;
    return Math.max(...items.map((i) => i.sequence)) + 1;
  }

  private async appendItem(agentId: string, item: Item): Promise<void> {
    await this.ensureDir();
    await appendFile(this.filePath(agentId), JSON.stringify(item) + "\n", "utf-8");
  }

  async getByAgentId(agentId: string): Promise<Item[]> {
    return this.readLines(agentId);
  }

  async create(item: Item): Promise<Item> {
    const sequence = await this.getNextSequence(item.agentId);
    const enriched = { ...item, sequence };
    await this.appendItem(item.agentId, enriched);
    return enriched;
  }

  async createMessage(
    agentId: string,
    data: Omit<MessageItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<MessageItem> {
    const sequence = await this.getNextSequence(agentId);
    const item: MessageItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "message",
      createdAt: new Date(),
    };
    await this.appendItem(agentId, item);
    return item;
  }

  async createToolCall(
    agentId: string,
    data: Omit<ToolCallItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolCallItem> {
    const sequence = await this.getNextSequence(agentId);
    const item: ToolCallItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "tool_call",
      createdAt: new Date(),
    };
    await this.appendItem(agentId, item);
    return item;
  }

  async createToolResult(
    agentId: string,
    data: Omit<ToolResultItem, "id" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolResultItem> {
    const sequence = await this.getNextSequence(agentId);
    const item: ToolResultItem = {
      ...data,
      id: randomUUID(),
      agentId,
      sequence,
      type: "tool_result",
      createdAt: new Date(),
    };
    await this.appendItem(agentId, item);
    return item;
  }

  async updateToolCallStatus(itemId: string, status: ToolCallStatus): Promise<void> {
    // We need to scan all JSONL files to find the item since we only have itemId
    const { readdir } = await import("node:fs/promises");
    const dir = join(this.dataDir, "items");

    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      throw new Error(`Item not found: ${itemId}`);
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const data = await readFile(filePath, "utf-8");
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

      if (found) {
        await writeFile(filePath, updated.join("\n") + "\n", "utf-8");
        return;
      }
    }

    throw new Error(`Item not found: ${itemId}`);
  }
}
