import { z } from "zod";
import { defineTool } from "../../types";
import type { ToolDefinition } from "../../types";
import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

interface MemoryEntry {
  key: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export function createMemoryTools(): AnyToolDefinition[] {
  const fs = createFilesystemService("memories");

  return [
    defineTool({
      name: "save_memory",
      description:
        "Save a piece of information to persistent memory. Use this to remember important facts, preferences, or context for future conversations.",

      inputSchema: z.object({
        key: z
          .string()
          .regex(/^[a-z0-9_-]+$/i, "Key must be alphanumeric with underscores/dashes")
          .describe("Unique identifier for this memory (e.g., 'user_preferences', 'project_context')"),
        content: z
          .string()
          .describe("The information to remember"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Optional tags for categorization and search"),
      }),

      source: { type: "integration", integrationId: "memory" },

      execute: async ({ key, content, tags }) => {
        const filename = `${key}.yaml`;
        const now = new Date().toISOString();

        let entry: MemoryEntry;

        // Check if memory exists to preserve createdAt
        if (fs.exists(filename)) {
          const existing = yaml.parse(await fs.readFile(filename)) as MemoryEntry;
          entry = {
            key,
            content,
            tags,
            createdAt: existing.createdAt,
            updatedAt: now,
          };
        } else {
          entry = {
            key,
            content,
            tags,
            createdAt: now,
            updatedAt: now,
          };
        }

        await fs.writeFile(filename, yaml.stringify(entry));

        return {
          success: true,
          key,
          message: `Memory "${key}" saved successfully.`,
        };
      },
    }),

    defineTool({
      name: "recall_memory",
      description:
        "Retrieve a specific memory by its key. Use this to recall previously saved information.",

      inputSchema: z.object({
        key: z.string().describe("The key of the memory to recall"),
      }),

      source: { type: "integration", integrationId: "memory" },

      execute: async ({ key }) => {
        const filename = `${key}.yaml`;

        if (!fs.exists(filename)) {
          return {
            success: false,
            error: `Memory "${key}" not found.`,
          };
        }

        const content = await fs.readFile(filename);
        const entry = yaml.parse(content) as MemoryEntry;

        return {
          success: true,
          memory: entry,
        };
      },
    }),

    defineTool({
      name: "search_memories",
      description:
        "Search through all saved memories. Can filter by tags or search in content.",

      inputSchema: z.object({
        tag: z
          .string()
          .optional()
          .describe("Filter memories by tag"),
        query: z
          .string()
          .optional()
          .describe("Text to search for in memory content"),
      }),

      source: { type: "integration", integrationId: "memory" },

      execute: async ({ tag, query }) => {
        const files = await fs.listFiles("", /\.yaml$/);
        const memories: MemoryEntry[] = [];

        for (const file of files) {
          const content = await fs.readFile(file);
          const entry = yaml.parse(content) as MemoryEntry;

          // Apply tag filter
          if (tag && (!entry.tags || !entry.tags.includes(tag))) {
            continue;
          }

          // Apply query filter
          if (query && !entry.content.toLowerCase().includes(query.toLowerCase())) {
            continue;
          }

          memories.push(entry);
        }

        return {
          count: memories.length,
          memories: memories.map((m) => ({
            key: m.key,
            content: m.content,
            tags: m.tags,
            updatedAt: m.updatedAt,
          })),
        };
      },
    }),

    defineTool({
      name: "delete_memory",
      description: "Delete a memory by its key.",

      inputSchema: z.object({
        key: z.string().describe("The key of the memory to delete"),
      }),

      source: { type: "integration", integrationId: "memory" },

      requiresApproval: true,

      execute: async ({ key }) => {
        const filename = `${key}.yaml`;

        if (!fs.exists(filename)) {
          return {
            success: false,
            error: `Memory "${key}" not found.`,
          };
        }

        await fs.deleteFile(filename);

        return {
          success: true,
          message: `Memory "${key}" deleted.`,
        };
      },
    }),
  ];
}
