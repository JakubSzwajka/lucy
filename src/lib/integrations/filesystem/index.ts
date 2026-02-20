/**
 * Filesystem Integration
 *
 * Provides file operations within a sandboxed directory.
 * Uses the internal FilesystemService.
 * Optionally reads base path from FILESYSTEM_BASE_PATH (defaults to "lucy-data").
 */

import { FilesystemService, createFilesystemService } from "@/lib/services";

// Re-export service types
export { FilesystemService } from "@/lib/services";
export type { FileInfo, FilesystemServiceConfig } from "@/lib/services";

const DEFAULT_BASE_PATH = "lucy-data";

/**
 * Filesystem integration definition.
 */
export const filesystemIntegration = {
  id: "filesystem",
  name: "Filesystem",
  description: "Read and write files in a local directory",

  /**
   * Filesystem is always configured (no credentials needed).
   */
  isConfigured: () => true,

  /**
   * Create a FilesystemService instance.
   */
  createClient: (): FilesystemService => {
    const basePath = process.env.FILESYSTEM_BASE_PATH || DEFAULT_BASE_PATH;
    return createFilesystemService(basePath);
  },
};
