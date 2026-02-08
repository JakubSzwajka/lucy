/**
 * Notes Tool Module
 *
 * Abstract note management tools.
 * Currently backed by Obsidian integration.
 */

import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { ObsidianClient } from "@/lib/integrations";

/**
 * Notes module definition.
 *
 * Provides abstract note tools that work with the Obsidian integration.
 */
export const notesModule = defineToolModule<ObsidianClient>({
  id: "notes",
  name: "Notes",
  description: "Note management - read, write, and list notes",
  integrationId: "obsidian",

  createTools: (client) => [
    defineTool({
      name: "notes_list",
      description:
        "List notes. Optionally filter by folder path.",

      inputSchema: z.object({
        folder: z
          .string()
          .optional()
          .describe("Folder path to list notes from (e.g., 'Projects/Work')"),
      }),

      source: { type: "builtin", moduleId: "notes" },

      execute: async (args) => {
        const notes = await client.listNotes(args.folder);
        return {
          notes,
          count: notes.length,
          folder: args.folder || "/",
        };
      },
    }),

    defineTool({
      name: "notes_read",
      description: "Read the contents of a note.",

      inputSchema: z.object({
        path: z.string().describe("Path to the note (e.g., 'Projects/my-note' or 'Projects/my-note.md')"),
      }),

      source: { type: "builtin", moduleId: "notes" },

      execute: async (args) => {
        const note = await client.readNote(args.path);
        if (!note) {
          return { error: `Note not found: ${args.path}` };
        }
        return note;
      },
    }),

    defineTool({
      name: "notes_write",
      description:
        "Create or update a note. If the note exists, it will be overwritten.",

      inputSchema: z.object({
        path: z.string().describe("Path for the note (e.g., 'Projects/my-note')"),
        content: z.string().describe("Markdown content for the note"),
      }),

      source: { type: "builtin", moduleId: "notes" },

      execute: async (args) => {
        await client.writeNote(args.path, args.content);
        const fullPath = args.path.endsWith(".md") ? args.path : `${args.path}.md`;
        return {
          success: true,
          path: fullPath,
          message: `Note "${fullPath}" saved.`,
        };
      },
    }),

    defineTool({
      name: "notes_delete",
      description: "Delete a note.",

      inputSchema: z.object({
        path: z.string().describe("Path to the note to delete"),
      }),

      source: { type: "builtin", moduleId: "notes" },
      requiresApproval: true,

      execute: async (args) => {
        const deleted = await client.deleteNote(args.path);
        if (!deleted) {
          return { error: `Note not found: ${args.path}` };
        }
        const fullPath = args.path.endsWith(".md") ? args.path : `${args.path}.md`;
        return {
          success: true,
          path: fullPath,
          message: `Note "${fullPath}" deleted.`,
        };
      },
    }),
  ],
});
