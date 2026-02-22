/**
 * Filesystem Service
 *
 * Generic file operations for the memory directory.
 * This is an internal service - not exposed directly to AI.
 * Higher-level integrations (memory, notes) build on top of this.
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

// ============================================================================
// Path Resolution
// ============================================================================

function getMemoryBasePath(): string {
  if (process.env.LUCY_USER_DATA_PATH) {
    return path.join(process.env.LUCY_USER_DATA_PATH, "memory");
  }
  return path.join(process.cwd(), "memory");
}

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Resolves and validates a path within a base directory.
 * Prevents directory traversal attacks.
 */
function resolveSafePath(basePath: string, relativePath: string): string {
  const resolved = path.resolve(basePath, relativePath);

  if (!resolved.startsWith(basePath + path.sep) && resolved !== basePath) {
    throw new Error(`Path "${relativePath}" escapes the allowed directory.`);
  }

  return resolved;
}

// ============================================================================
// Filesystem Service
// ============================================================================

export interface FileInfo {
  path: string;
  size: number;
  modifiedAt: Date;
  createdAt: Date;
}

export interface FilesystemServiceConfig {
  /** Subdirectory within the memory base path */
  subdir: string;
}

export class FilesystemService {
  private basePath: string;

  constructor(config: FilesystemServiceConfig) {
    this.basePath = path.join(getMemoryBasePath(), config.subdir);
    ensureDirectory(this.basePath);
  }

  /**
   * Get the base path for this service instance.
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Check if a file exists.
   */
  exists(relativePath: string): boolean {
    const fullPath = resolveSafePath(this.basePath, relativePath);
    return existsSync(fullPath);
  }

  /**
   * Read a file's content.
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = resolveSafePath(this.basePath, relativePath);

    if (!existsSync(fullPath)) {
      throw new Error(`File "${relativePath}" does not exist.`);
    }

    return fs.readFile(fullPath, "utf-8");
  }

  /**
   * Write content to a file. Creates parent directories if needed.
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = resolveSafePath(this.basePath, relativePath);
    const parentDir = path.dirname(fullPath);

    ensureDirectory(parentDir);
    await fs.writeFile(fullPath, content, "utf-8");
  }

  /**
   * Delete a file.
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = resolveSafePath(this.basePath, relativePath);

    if (!existsSync(fullPath)) {
      throw new Error(`File "${relativePath}" does not exist.`);
    }

    await fs.unlink(fullPath);
  }

  /**
   * List files in a directory, optionally filtered by pattern.
   */
  async listFiles(
    subdir: string = "",
    pattern?: RegExp
  ): Promise<string[]> {
    const searchDir = subdir
      ? resolveSafePath(this.basePath, subdir)
      : this.basePath;

    if (!existsSync(searchDir)) {
      return [];
    }

    const results = await this.walkDirectory(searchDir, this.basePath, pattern);
    return results;
  }

  /**
   * Get file info (size, dates).
   */
  async getFileInfo(relativePath: string): Promise<FileInfo> {
    const fullPath = resolveSafePath(this.basePath, relativePath);

    if (!existsSync(fullPath)) {
      throw new Error(`File "${relativePath}" does not exist.`);
    }

    const stats = await fs.stat(fullPath);
    return {
      path: relativePath,
      size: stats.size,
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime,
    };
  }

  /**
   * Recursively walk a directory.
   */
  private async walkDirectory(
    dir: string,
    baseDir: string,
    pattern?: RegExp
  ): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        const subResults = await this.walkDirectory(fullPath, baseDir, pattern);
        results.push(...subResults);
      } else if (entry.isFile()) {
        if (!pattern || pattern.test(relativePath)) {
          results.push(relativePath);
        }
      }
    }

    return results;
  }
}

/**
 * Create a filesystem service for a specific subdirectory.
 */
export function createFilesystemService(subdir: string): FilesystemService {
  return new FilesystemService({ subdir });
}
