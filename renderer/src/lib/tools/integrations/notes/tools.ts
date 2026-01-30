import { z } from "zod";
import { defineTool } from "../../types";
import type { ToolDefinition } from "../../types";
import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

interface NoteEntry {
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Sanitize a title to be used as a filename.
 */
function titleToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export function createNotesTools(): AnyToolDefinition[] {
  const fs = createFilesystemService("notes");

  return [
    defineTool({
      name: "create_note",
      description:
        "Create or update a note. Notes are for longer-form content like documentation, summaries, or drafts.",

      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .describe("Title of the note"),
        content: z
          .string()
          .describe("The note content (supports markdown)"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Optional tags for organization"),
      }),

      source: { type: "integration", integrationId: "notes" },

      execute: async ({ title, content, tags }) => {
        const filename = `${titleToFilename(title)}.yaml`;
        const now = new Date().toISOString();

        let entry: NoteEntry;

        if (fs.exists(filename)) {
          const existing = yaml.parse(await fs.readFile(filename)) as NoteEntry;
          entry = {
            title,
            content,
            tags,
            createdAt: existing.createdAt,
            updatedAt: now,
          };
        } else {
          entry = {
            title,
            content,
            tags,
            createdAt: now,
            updatedAt: now,
          };
        }

        await fs.writeFile(filename, yaml.stringify(entry));

        return {
          success: true,
          filename: filename.replace(".yaml", ""),
          message: `Note "${title}" saved successfully.`,
        };
      },
    }),

    defineTool({
      name: "read_note",
      description: "Read a note by its filename (without extension) or search by title.",

      inputSchema: z.object({
        filename: z
          .string()
          .describe("The filename of the note (without .yaml extension)"),
      }),

      source: { type: "integration", integrationId: "notes" },

      execute: async ({ filename }) => {
        const filepath = `${filename}.yaml`;

        if (!fs.exists(filepath)) {
          return {
            success: false,
            error: `Note "${filename}" not found.`,
          };
        }

        const content = await fs.readFile(filepath);
        const entry = yaml.parse(content) as NoteEntry;

        return {
          success: true,
          note: entry,
        };
      },
    }),

    defineTool({
      name: "list_notes",
      description: "List all notes, optionally filtered by tag.",

      inputSchema: z.object({
        tag: z
          .string()
          .optional()
          .describe("Filter notes by tag"),
      }),

      source: { type: "integration", integrationId: "notes" },

      execute: async ({ tag }) => {
        const files = await fs.listFiles("", /\.yaml$/);
        const notes: Array<{
          filename: string;
          title: string;
          tags?: string[];
          updatedAt: string;
        }> = [];

        for (const file of files) {
          const content = await fs.readFile(file);
          const entry = yaml.parse(content) as NoteEntry;

          // Apply tag filter
          if (tag && (!entry.tags || !entry.tags.includes(tag))) {
            continue;
          }

          notes.push({
            filename: file.replace(".yaml", ""),
            title: entry.title,
            tags: entry.tags,
            updatedAt: entry.updatedAt,
          });
        }

        // Sort by update time, newest first
        notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return {
          count: notes.length,
          notes,
        };
      },
    }),

    defineTool({
      name: "delete_note",
      description: "Delete a note by its filename.",

      inputSchema: z.object({
        filename: z
          .string()
          .describe("The filename of the note to delete (without .yaml extension)"),
      }),

      source: { type: "integration", integrationId: "notes" },

      requiresApproval: true,

      execute: async ({ filename }) => {
        const filepath = `${filename}.yaml`;

        if (!fs.exists(filepath)) {
          return {
            success: false,
            error: `Note "${filename}" not found.`,
          };
        }

        await fs.deleteFile(filepath);

        return {
          success: true,
          message: `Note "${filename}" deleted.`,
        };
      },
    }),

    defineTool({
      name: "search_notes",
      description: "Search notes by content or title.",

      inputSchema: z.object({
        query: z
          .string()
          .describe("Text to search for in note titles and content"),
      }),

      source: { type: "integration", integrationId: "notes" },

      execute: async ({ query }) => {
        const files = await fs.listFiles("", /\.yaml$/);
        const matches: Array<{
          filename: string;
          title: string;
          snippet: string;
          updatedAt: string;
        }> = [];

        const lowerQuery = query.toLowerCase();

        for (const file of files) {
          const content = await fs.readFile(file);
          const entry = yaml.parse(content) as NoteEntry;

          const titleMatch = entry.title.toLowerCase().includes(lowerQuery);
          const contentMatch = entry.content.toLowerCase().includes(lowerQuery);

          if (titleMatch || contentMatch) {
            // Create a snippet around the match
            let snippet = "";
            if (contentMatch) {
              const idx = entry.content.toLowerCase().indexOf(lowerQuery);
              const start = Math.max(0, idx - 50);
              const end = Math.min(entry.content.length, idx + query.length + 50);
              snippet = (start > 0 ? "..." : "") +
                entry.content.substring(start, end) +
                (end < entry.content.length ? "..." : "");
            } else {
              snippet = entry.content.substring(0, 100) + (entry.content.length > 100 ? "..." : "");
            }

            matches.push({
              filename: file.replace(".yaml", ""),
              title: entry.title,
              snippet,
              updatedAt: entry.updatedAt,
            });
          }
        }

        return {
          count: matches.length,
          results: matches,
        };
      },
    }),
  ];
}
