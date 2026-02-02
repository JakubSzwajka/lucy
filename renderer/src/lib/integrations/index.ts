/**
 * Integrations
 *
 * External service integrations that provide clients for tool modules.
 *
 * Each integration:
 * - Has an ID, name, description
 * - Checks if it's configured (via env vars)
 * - Creates a client when configured
 *
 * Tool modules reference integrations by ID to get their client instances.
 */

// ============================================================================
// MCP Integration (Model Context Protocol)
// ============================================================================

export {
  McpService,
  getMcpService,
  McpRepository,
  getMcpRepository,
} from "./mcp";
export type { McpTestResult, McpStatusResult, ValidationResult } from "./mcp";

// ============================================================================
// Service Integrations
// ============================================================================

// Todoist
export { todoistIntegration, TodoistClient } from "./todoist";
export type { TodoistTask, TodoistProject, TodoistUser } from "./todoist";

// Obsidian
export { obsidianIntegration, ObsidianClient } from "./obsidian";
export type { NoteInfo, NoteContent } from "./obsidian";

// Conversations
export { conversationsIntegration, ConversationsClient } from "./conversations";
export type {
  ConversationSearchResult,
  ConversationSearchOptions,
  ContextItem,
} from "./conversations";

// Filesystem
export { filesystemIntegration, FilesystemService } from "./filesystem";
export type { FileInfo, FilesystemServiceConfig } from "./filesystem";

// ============================================================================
// Integration Types
// ============================================================================

/**
 * Common integration interface.
 */
export interface SimpleIntegration<TClient = unknown> {
  id: string;
  name: string;
  description: string;
  isConfigured: () => boolean;
  createClient: () => TClient | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyIntegration = SimpleIntegration<any>;

// ============================================================================
// Integration Registry
// ============================================================================

import { todoistIntegration } from "./todoist";
import { obsidianIntegration } from "./obsidian";
import { conversationsIntegration } from "./conversations";
import { filesystemIntegration } from "./filesystem";

/**
 * All available integrations.
 *
 * To add a new integration:
 * 1. Create a new directory under integrations/
 * 2. Export an integration object with id, name, description, isConfigured, createClient
 * 3. Add it to this array
 */
export const allIntegrations: AnyIntegration[] = [
  todoistIntegration,
  obsidianIntegration,
  conversationsIntegration,
  filesystemIntegration,
];

/**
 * Get an integration by ID.
 */
export function getIntegration(id: string): AnyIntegration | undefined {
  return allIntegrations.find((i) => i.id === id);
}
