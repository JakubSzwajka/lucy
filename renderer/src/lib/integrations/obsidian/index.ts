/**
 * Obsidian Integration
 *
 * Provides CRUD operations for Obsidian vault via Local REST API.
 * Requires the Obsidian Local REST API plugin to be installed and configured.
 *
 * @see https://github.com/coddingtonbear/obsidian-local-rest-api
 */

import { z } from "zod";
import { defineIntegration } from "../types";
import { defineTool, type ToolDefinition } from "@/lib/tools/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

// ============================================================================
// Types
// ============================================================================

export interface NoteInfo {
  path: string;
  name: string;
}

export interface NoteContent {
  path: string;
  name: string;
  content: string;
}

// ============================================================================
// Obsidian Client
// ============================================================================

class ObsidianClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    options: { body?: string; accept?: string; contentType?: string } = {}
  ): Promise<{ data: T | null; error?: string; status: number }> {
    try {
      // Disable TLS verification for self-signed cert
      if (typeof process !== "undefined") {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(options.accept && { Accept: options.accept }),
          ...(options.contentType && { "Content-Type": options.contentType }),
        },
        body: options.body,
      });

      if (res.status === 404) {
        return { data: null, status: 404 };
      }

      if (!res.ok) {
        return { data: null, error: await res.text(), status: res.status };
      }

      if (res.status === 204) {
        return { data: null, status: 204 };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return { data: (await res.json()) as T, status: res.status };
      }

      return { data: (await res.text()) as unknown as T, status: res.status };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Connection failed",
        status: 500,
      };
    }
  }

  async listNotes(folder: string = ""): Promise<NoteInfo[]> {
    const path = folder ? `/vault/${encodeURIComponent(folder + "/")}` : "/vault/";
    const { data, error } = await this.request<{ files: string[] }>("GET", path);

    if (error) {
      throw new Error(error);
    }

    return (data?.files || [])
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        path: folder ? `${folder}/${f}` : f,
        name: f.replace(/\.md$/, ""),
      }));
  }

  async readNote(notePath: string): Promise<NoteContent | null> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { data: content, status, error } = await this.request<string>(
      "GET",
      `/vault/${encodeURIComponent(fullPath)}`,
      { accept: "text/markdown" }
    );

    if (status === 404) {
      return null;
    }

    if (error) {
      throw new Error(error);
    }

    return {
      path: fullPath,
      name: fullPath.replace(/\.md$/, "").split("/").pop() || fullPath,
      content: content || "",
    };
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { error } = await this.request(
      "PUT",
      `/vault/${encodeURIComponent(fullPath)}`,
      { body: content, contentType: "text/markdown" }
    );

    if (error) {
      throw new Error(error);
    }
  }

  async deleteNote(notePath: string): Promise<boolean> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { status, error } = await this.request(
      "DELETE",
      `/vault/${encodeURIComponent(fullPath)}`
    );

    if (status === 404) {
      return false;
    }

    if (error) {
      throw new Error(error);
    }

    return true;
  }

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    const { data, error } = await this.request<{ ok: boolean; authenticated: boolean }>("GET", "/");

    if (error) {
      return { connected: false, error };
    }

    if (!data?.ok) {
      return { connected: false, error: "Obsidian API not responding" };
    }

    if (!data?.authenticated) {
      return { connected: false, error: "Invalid API key" };
    }

    return { connected: true };
  }
}

// ============================================================================
// Tool Factory
// ============================================================================

function createObsidianTools(client: ObsidianClient): AnyToolDefinition[] {
  return [
    defineTool({
      name: "obsidian_list_notes",
      description:
        "List markdown notes in the Obsidian vault. Optionally filter by folder path.",

      inputSchema: z.object({
        folder: z
          .string()
          .optional()
          .describe("Folder path to list notes from (e.g., 'Projects/Work')"),
      }),

      source: { type: "integration", integrationId: "obsidian" },

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
      name: "obsidian_read_note",
      description: "Read the contents of a note from Obsidian vault.",

      inputSchema: z.object({
        path: z.string().describe("Path to the note (e.g., 'Projects/my-note' or 'Projects/my-note.md')"),
      }),

      source: { type: "integration", integrationId: "obsidian" },

      execute: async (args) => {
        const note = await client.readNote(args.path);
        if (!note) {
          return { error: `Note not found: ${args.path}` };
        }
        return note;
      },
    }),

    defineTool({
      name: "obsidian_write_note",
      description:
        "Create or update a note in Obsidian vault. If the note exists, it will be overwritten.",

      inputSchema: z.object({
        path: z.string().describe("Path for the note (e.g., 'Projects/my-note')"),
        content: z.string().describe("Markdown content for the note"),
      }),

      source: { type: "integration", integrationId: "obsidian" },

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
      name: "obsidian_delete_note",
      description: "Delete a note from the Obsidian vault.",

      inputSchema: z.object({
        path: z.string().describe("Path to the note to delete"),
      }),

      source: { type: "integration", integrationId: "obsidian" },

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
  ];
}

// ============================================================================
// Integration Definition
// ============================================================================

export const obsidianIntegration = defineIntegration({
  id: "obsidian",
  name: "Obsidian",
  description: "Read and write notes in your Obsidian vault via Local REST API",

  credentialsSchema: z.object({
    apiKey: z
      .string()
      .min(1)
      .describe("API key from Obsidian Local REST API plugin settings"),
  }),

  configSchema: z.object({
    baseUrl: z
      .string()
      .default("https://127.0.0.1:27124")
      .describe("Obsidian Local REST API URL"),
  }),

  createTools: (credentials, config) => {
    const client = new ObsidianClient(
      config.baseUrl || "https://127.0.0.1:27124",
      credentials.apiKey
    );
    return createObsidianTools(client);
  },

  testConnection: async (credentials) => {
    try {
      const client = new ObsidianClient("https://127.0.0.1:27124", credentials.apiKey);
      const result = await client.checkConnection();

      if (!result.connected) {
        return { success: false, error: result.error };
      }

      return { success: true, info: "Connected to Obsidian vault" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});
