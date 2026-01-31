/**
 * Todoist Integration
 *
 * Connects to Todoist for task management.
 * Reads API key from TODOIST_API_KEY environment variable.
 */

import { TodoistClient } from "./client";

// Re-export client and types
export { TodoistClient } from "./client";
export type { TodoistTask, TodoistProject, TodoistUser } from "./types";

/**
 * Todoist integration definition.
 */
export const todoistIntegration = {
  id: "todoist",
  name: "Todoist",
  description: "Task management via Todoist",

  /**
   * Check if the integration is configured (API key is set).
   */
  isConfigured: () => !!process.env.TODOIST_API_KEY,

  /**
   * Create a client instance. Returns null if not configured.
   */
  createClient: (): TodoistClient | null => {
    const apiKey = process.env.TODOIST_API_KEY;
    if (!apiKey) return null;
    return new TodoistClient(apiKey);
  },
};
