/**
 * Obsidian Integration
 *
 * Connects to Obsidian vault via Local REST API plugin.
 * Reads API key from OBSIDIAN_API_KEY environment variable.
 * Optionally reads base URL from OBSIDIAN_BASE_URL (defaults to https://127.0.0.1:27124).
 */

import { ObsidianClient } from "./client";

// Re-export client and types
export { ObsidianClient } from "./client";
export type { NoteInfo, NoteContent } from "./client";

const DEFAULT_BASE_URL = "https://127.0.0.1:27124";

/**
 * Obsidian integration definition.
 */
export const obsidianIntegration = {
  id: "obsidian",
  name: "Obsidian",
  description: "Read and write notes in your Obsidian vault via Local REST API",

  /**
   * Check if the integration is configured (API key is set).
   */
  isConfigured: () => !!process.env.OBSIDIAN_API_KEY,

  /**
   * Create a client instance. Returns null if not configured.
   */
  createClient: (): ObsidianClient | null => {
    const apiKey = process.env.OBSIDIAN_API_KEY;
    if (!apiKey) return null;
    const baseUrl = process.env.OBSIDIAN_BASE_URL || DEFAULT_BASE_URL;
    return new ObsidianClient(baseUrl, apiKey);
  },
};
