import type { z } from "zod";
import type { Schema } from "ai";

// ============================================================================
// Tool Source Types
// ============================================================================

export interface McpToolSource {
  type: "mcp";
  serverId: string;
  serverName: string;
}

export interface BuiltinToolSource {
  type: "builtin";
  moduleId: string; // e.g., "todoist", "filesystem"
}

export type ToolSource = McpToolSource | BuiltinToolSource;

// ============================================================================
// Tool Execution Context
// ============================================================================

export interface ChildAgentConfig {
  name: string;
  task: string;
  model?: string;
  systemPrompt?: string;
  parentId: string;
  sourceCallId: string;
}

export interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  callId: string;

  // For tools that spawn sub-agents
  createChildAgent?: (config: ChildAgentConfig) => Promise<string>;

  // For tools that need to store state within the session
  getState: <T>(key: string) => T | undefined;
  setState: <T>(key: string, value: T) => void;
}

// ============================================================================
// Tool Definition
// ============================================================================

export interface ToolDefinition<
  TInput = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  description: string;
  // Accepts both Zod schemas (for builtin tools) and AI SDK jsonSchema() (for MCP tools)
  inputSchema: z.ZodType<TInput> | Schema<TInput>;
  source: ToolSource;

  // Execution handler
  execute: (args: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  // Optional: Require user approval before execution
  requiresApproval?: boolean | ((args: TInput) => boolean);

  // Optional: Custom validation beyond schema
  validate?: (
    args: TInput,
    context: ToolExecutionContext
  ) => Promise<{ valid: boolean; error?: string }>;

  // Optional: Transform output before returning to AI
  formatOutput?: (output: TOutput) => unknown;
}

// ============================================================================
// Tool Provider Interface
// ============================================================================

export interface ToolProvider {
  readonly name: string;

  // Get all tools from this provider
  getTools(): Promise<ToolDefinition[]>;

  // Optional: Check if provider is available/connected
  isAvailable?(): Promise<boolean>;

  // Optional: Initialize/connect the provider
  initialize?(): Promise<void>;

  // Optional: Cleanup/disconnect
  dispose?(): Promise<void>;
}

// ============================================================================
// Tool Execution Result
// ============================================================================

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  duration?: number;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface RegisteredTool {
  key: string;
  definition: ToolDefinition;
}

export interface ToolRegistryOptions {
  // Whether to automatically connect MCP servers
  autoConnectMcp?: boolean;

  // Default approval setting for tools without explicit setting
  defaultRequiresApproval?: boolean;
}

// ============================================================================
// Helper type for creating tool definitions with type inference
// ============================================================================

export function defineTool<TInput, TOutput>(
  definition: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return definition;
}

// ============================================================================
// Tool Module (references an integration for its client)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

/**
 * A ToolModule defines abstract tools that use a client from an integration.
 *
 * Tool modules:
 * - Reference an integration by ID (e.g., "todoist", "obsidian")
 * - Receive a client instance created by the integration
 * - Create tools that use that client
 *
 * This separates tool definitions from service implementations,
 * allowing the same tools to work with different backends.
 *
 * @template TClient - The type of client this module expects from its integration
 */
export interface ToolModule<TClient = unknown> {
  // Identity
  id: string; // e.g., "tasks", "notes", "files"
  name: string; // e.g., "Tasks", "Notes", "Files"
  description: string;

  // Which integration provides the client
  integrationId: string; // e.g., "todoist", "obsidian", "filesystem"

  // Factory: client → tools
  createTools: (client: TClient) => AnyToolDefinition[];
}

/**
 * Helper function to define a tool module with type inference.
 */
export function defineToolModule<TClient>(
  module: ToolModule<TClient>
): ToolModule<TClient> {
  return module;
}

/**
 * Base tool module type that can be used in arrays and lookups.
 * Uses `any` for the client type to allow heterogeneous collections.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolModule = ToolModule<any>;
