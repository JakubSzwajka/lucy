/**
 * Filesystem Integration
 *
 * Provides file operations within a sandboxed directory.
 * Uses the FilesystemService from /lib/services.
 */

import { z } from "zod";
import { defineIntegration } from "../types";
import { defineTool, type ToolDefinition } from "@/lib/tools/types";
import { createFilesystemService, type FilesystemService } from "@/lib/services";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

// ============================================================================
// Types
// ============================================================================

export interface FileInfo {
  path: string;
  name: string;
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  size: number;
  createdAt?: string;
  modifiedAt?: string;
}

// ============================================================================
// Tool Factory
// ============================================================================

function createFilesystemTools(
  config: { basePath: string }
): AnyToolDefinition[] {
  const service: FilesystemService = createFilesystemService(config.basePath);

  return [
    defineTool({
      name: "fs_list_files",
      description:
        "List files in the filesystem. Optionally filter by regex pattern. Returns file paths, names, sizes, and timestamps.",

      inputSchema: z.object({
        pattern: z
          .string()
          .optional()
          .describe("Optional regex pattern to filter files (e.g., '\\.md$' for markdown files)"),
      }),

      source: { type: "integration", integrationId: "filesystem" },

      execute: async (args) => {
        const patternRegex = args.pattern ? new RegExp(args.pattern) : undefined;
        const files = await service.listFiles("", patternRegex);

        const fileInfos: FileInfo[] = await Promise.all(
          files.map(async (file) => {
            try {
              const info = await service.getFileInfo(file);
              return {
                path: file,
                name: file.split("/").pop() || file,
                size: info.size,
                createdAt: info.createdAt.toISOString(),
                modifiedAt: info.modifiedAt.toISOString(),
              };
            } catch {
              return {
                path: file,
                name: file.split("/").pop() || file,
              };
            }
          })
        );

        return {
          files: fileInfos,
          count: fileInfos.length,
          basePath: service.getBasePath(),
        };
      },
    }),

    defineTool({
      name: "fs_read_file",
      description: "Read the contents of a file. Returns the file content along with metadata.",

      inputSchema: z.object({
        path: z.string().describe("Path to the file (relative to base path)"),
      }),

      source: { type: "integration", integrationId: "filesystem" },

      execute: async (args) => {
        if (!service.exists(args.path)) {
          return { error: `File not found: ${args.path}` };
        }

        const content = await service.readFile(args.path);
        const info = await service.getFileInfo(args.path);

        return {
          path: args.path,
          name: args.path.split("/").pop() || args.path,
          content,
          size: info.size,
          createdAt: info.createdAt.toISOString(),
          modifiedAt: info.modifiedAt.toISOString(),
        };
      },
    }),

    defineTool({
      name: "fs_write_file",
      description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",

      inputSchema: z.object({
        path: z.string().describe("Path to the file (relative to base path)"),
        content: z.string().describe("Content to write to the file"),
      }),

      source: { type: "integration", integrationId: "filesystem" },

      execute: async (args) => {
        await service.writeFile(args.path, args.content);
        return {
          success: true,
          path: args.path,
          message: `File "${args.path}" written successfully.`,
        };
      },
    }),

    defineTool({
      name: "fs_delete_file",
      description: "Delete a file from the filesystem.",

      inputSchema: z.object({
        path: z.string().describe("Path to the file to delete"),
      }),

      source: { type: "integration", integrationId: "filesystem" },

      requiresApproval: true,

      execute: async (args) => {
        if (!service.exists(args.path)) {
          return { error: `File not found: ${args.path}` };
        }

        await service.deleteFile(args.path);
        return {
          success: true,
          path: args.path,
          message: `File "${args.path}" deleted.`,
        };
      },
    }),
  ];
}

// ============================================================================
// Integration Definition
// ============================================================================

export const filesystemIntegration = defineIntegration({
  id: "filesystem",
  name: "Filesystem",
  description: "Read and write files in a local directory",

  credentialsSchema: z.object({}),

  configSchema: z.object({
    basePath: z
      .string()
      .default("lucy-data")
      .describe("Base directory for file operations (relative to user data)"),
  }),

  createTools: (_credentials, config) => {
    return createFilesystemTools({ basePath: config.basePath || "lucy-data" });
  },

  testConnection: async (_credentials) => {
    return { success: true, info: "Filesystem is always available" };
  },
});
