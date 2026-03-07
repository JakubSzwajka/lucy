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
  moduleId: string;
}

export interface DelegateToolSource {
  type: "delegate";
  configId: string;
  configName: string;
}

export type ToolSource = McpToolSource | BuiltinToolSource | DelegateToolSource;

// ============================================================================
// Tool Execution Context
// ============================================================================

export interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  callId: string;
  userId: string;

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
  inputSchema: z.ZodType<TInput> | Schema<TInput>;
  source: ToolSource;

  execute: (args: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  requiresApproval?: boolean | ((args: TInput) => boolean);

  validate?: (
    args: TInput,
    context: ToolExecutionContext
  ) => Promise<{ valid: boolean; error?: string }>;

  formatOutput?: (output: TOutput) => unknown;
}

// ============================================================================
// Tool Filter
// ============================================================================

export interface ToolFilter {
  allowedMcpServerIds?: string[];
  allowedBuiltinModuleIds?: string[];
}

// ============================================================================
// Tool Provider Interface
// ============================================================================

export interface ToolProvider {
  readonly name: string;

  getTools(filter?: { allowedServerIds?: string[]; allowedModuleIds?: string[] }): Promise<ToolDefinition[]>;

  isAvailable?(): Promise<boolean>;
  initialize?(): Promise<void>;
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
  autoConnectMcp?: boolean;
  defaultRequiresApproval?: boolean;
}

// ============================================================================
// Tool Module
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export interface ToolModule {
  id: string;
  name: string;
  description: string;

  createTools: () => AnyToolDefinition[];
}

export function defineTool<TInput, TOutput>(
  definition: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return definition;
}

export function defineToolModule(module: ToolModule): ToolModule {
  return module;
}
