import { z } from "zod";

// ============================================================================
// Tool Source Types
// ============================================================================

export interface McpToolSource {
  type: "mcp";
  serverId: string;
  serverName: string;
}

export interface IntegrationToolSource {
  type: "integration";
  integrationId: string;
}

export type ToolSource = McpToolSource | IntegrationToolSource;

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
  inputSchema: z.ZodType<TInput>;
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
