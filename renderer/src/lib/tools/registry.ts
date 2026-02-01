import { tool } from "ai";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type {
  ToolDefinition,
  ToolProvider,
  ToolExecutionContext,
  ToolSource,
  RegisteredTool,
  ToolRegistryOptions,
} from "./types";

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private providers: Map<string, ToolProvider> = new Map();
  private options: ToolRegistryOptions;

  // Session-scoped state storage for tools
  private toolState: Map<string, Map<string, unknown>> = new Map();

  constructor(options: ToolRegistryOptions = {}) {
    this.options = {
      autoConnectMcp: true,
      defaultRequiresApproval: false,
      ...options,
    };
  }

  // -------------------------------------------------------------------------
  // Provider Management
  // -------------------------------------------------------------------------

  registerProvider(provider: ToolProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  getProvider(name: string): ToolProvider | undefined {
    return this.providers.get(name);
  }

  // -------------------------------------------------------------------------
  // Individual Tool Registration
  // -------------------------------------------------------------------------

  registerTool(definition: ToolDefinition): void {
    const key = this.getToolKey(definition.source, definition.name);
    this.tools.set(key, definition);
  }

  unregisterTool(source: ToolSource, name: string): void {
    const key = this.getToolKey(source, name);
    this.tools.delete(key);
  }

  // -------------------------------------------------------------------------
  // Tool Discovery
  // -------------------------------------------------------------------------

  async getAllTools(): Promise<RegisteredTool[]> {
    const allTools: RegisteredTool[] = [];

    // Gather tools from all providers
    for (const provider of this.providers.values()) {
      try {
        // Check availability if the provider supports it
        if (provider.isAvailable) {
          const available = await provider.isAvailable();
          if (!available) continue;
        }

        const providerTools = await provider.getTools();
        for (const def of providerTools) {
          const key = this.getToolKey(def.source, def.name);
          allTools.push({ key, definition: def });
        }
      } catch (error) {
        console.error(`[ToolRegistry] Error getting tools from provider ${provider.name}:`, error);
      }
    }

    // Add individually registered tools
    for (const [key, definition] of this.tools) {
      allTools.push({ key, definition });
    }

    return allTools;
  }

  async getToolByKey(key: string): Promise<ToolDefinition | undefined> {
    // Check individually registered tools first
    if (this.tools.has(key)) {
      return this.tools.get(key);
    }

    // Search in providers
    const allTools = await this.getAllTools();
    const found = allTools.find((t) => t.key === key);
    return found?.definition;
  }

  // -------------------------------------------------------------------------
  // AI SDK Conversion
  // -------------------------------------------------------------------------

  async toAiSdkTools(
    contextPartial: Omit<ToolExecutionContext, "callId" | "getState" | "setState">
  ): Promise<Record<string, ReturnType<typeof tool>>> {
    const allTools = await this.getAllTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    for (const { key, definition } of allTools) {
      result[key] = this.createAiSdkTool(key, definition, contextPartial);
    }

    return result;
  }

  private createAiSdkTool(
    _key: string,
    definition: ToolDefinition,
    contextPartial: Omit<ToolExecutionContext, "callId" | "getState" | "setState">
  ) {
    // Use passthrough schema to allow any input structure from AI
    const passthroughSchema = z.object({}).passthrough();

    // Capture 'this' for use in execute callback
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const registry = this;

    return tool({
      description: definition.description,
      inputSchema: passthroughSchema,
      execute: async (args: Record<string, unknown>) => {
        return registry.executeWithContext(_key, definition, args, contextPartial);
      },
    });
  }

  // -------------------------------------------------------------------------
  // Tool Execution
  // -------------------------------------------------------------------------

  /**
   * Execute a tool with context.
   * Note: Persistence is handled centrally by onStepFinish in the chat route.
   */
  private async executeWithContext(
    key: string,
    definition: ToolDefinition,
    args: unknown,
    contextPartial: Omit<ToolExecutionContext, "callId" | "getState" | "setState">
  ): Promise<unknown> {
    const callId = uuidv4();
    const startTime = Date.now();
    const { sessionId } = contextPartial;

    // Build full execution context
    const context: ToolExecutionContext = {
      ...contextPartial,
      callId,
      getState: <T>(stateKey: string) => this.getToolState<T>(sessionId, stateKey),
      setState: <T>(stateKey: string, value: T) => this.setToolState(sessionId, stateKey, value),
    };

    // Preprocess args: AI models sometimes send arrays/objects as JSON strings
    const preprocessedArgs = this.preprocessArgs(args as Record<string, unknown>);

    // Parse and validate args with the tool's input schema
    let parsedArgs: unknown;
    try {
      parsedArgs = definition.inputSchema.parse(preprocessedArgs);
    } catch (parseError) {
      console.error(`[ToolRegistry] Schema validation failed for ${key}:`, parseError);
      parsedArgs = preprocessedArgs; // Fall back to preprocessed args if schema parsing fails
    }

    // Log if approval would be required (approval flow not yet implemented)
    const requiresApproval = this.checkRequiresApproval(definition, parsedArgs);
    if (requiresApproval) {
      console.log(`[ToolRegistry] Tool ${definition.name} requires approval (not implemented yet)`);
    }

    try {
      // Run custom validation if provided
      if (definition.validate) {
        const validation = await definition.validate(parsedArgs as never, context);
        if (!validation.valid) {
          throw new Error(validation.error || "Validation failed");
        }
      }

      // Execute the tool with parsed args
      const result = await definition.execute(parsedArgs as never, context);
      const executionTime = Date.now() - startTime;

      // Format output if transformer provided
      const formattedResult = definition.formatOutput
        ? definition.formatOutput(result as never)
        : result;

      console.log(`[ToolRegistry] Tool ${key} executed in ${executionTime}ms`);

      return formattedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
      console.error(`[ToolRegistry] Tool ${key} failed:`, errorMessage);
      return { error: errorMessage };
    }
  }

  // -------------------------------------------------------------------------
  // Approval Check
  // -------------------------------------------------------------------------

  private checkRequiresApproval(definition: ToolDefinition, args: unknown): boolean {
    if (definition.requiresApproval === undefined) {
      return this.options.defaultRequiresApproval || false;
    }

    if (typeof definition.requiresApproval === "function") {
      return definition.requiresApproval(args as never);
    }

    return definition.requiresApproval;
  }

  // -------------------------------------------------------------------------
  // Args Preprocessing
  // -------------------------------------------------------------------------

  /**
   * Preprocess tool arguments to handle JSON strings that should be arrays/objects.
   * AI models sometimes send arrays as stringified JSON like '["a","b"]' instead of actual arrays.
   */
  private preprocessArgs(args: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string") {
        // Try to parse JSON strings that look like arrays or objects
        const trimmed = value.trim();
        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))
        ) {
          try {
            result[key] = JSON.parse(trimmed);
            continue;
          } catch {
            // Not valid JSON, keep as string
          }
        }
      }
      result[key] = value;
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Tool Key Generation
  // -------------------------------------------------------------------------

  getToolKey(source: ToolSource, name: string): string {
    switch (source.type) {
      case "mcp":
        return `mcp__${source.serverId}__${name}`;
      case "builtin":
        return `builtin__${source.moduleId}__${name}`;
    }
  }

  parseToolKey(key: string): { sourceType: string; sourceId: string; name: string } | null {
    const parts = key.split("__");
    if (parts.length !== 3) return null;

    return {
      sourceType: parts[0],
      sourceId: parts[1],
      name: parts[2],
    };
  }

  // -------------------------------------------------------------------------
  // Session State Management
  // -------------------------------------------------------------------------

  private getToolState<T>(sessionId: string, key: string): T | undefined {
    const sessionState = this.toolState.get(sessionId);
    if (!sessionState) return undefined;
    return sessionState.get(key) as T | undefined;
  }

  private setToolState<T>(sessionId: string, key: string, value: T): void {
    let sessionState = this.toolState.get(sessionId);
    if (!sessionState) {
      sessionState = new Map();
      this.toolState.set(sessionId, sessionState);
    }
    sessionState.set(key, value);
  }

  clearSessionState(sessionId: string): void {
    this.toolState.delete(sessionId);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.initialize) {
        try {
          await provider.initialize();
        } catch (error) {
          console.error(`[ToolRegistry] Failed to initialize provider ${provider.name}:`, error);
        }
      }
    }
  }

  async dispose(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.dispose) {
        try {
          await provider.dispose();
        } catch (error) {
          console.error(`[ToolRegistry] Failed to dispose provider ${provider.name}:`, error);
        }
      }
    }

    this.tools.clear();
    this.providers.clear();
    this.toolState.clear();
  }
}

// ============================================================================
// Global Registry Singleton
// ============================================================================

let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
    // Providers will be registered by their respective modules
  }
  return globalRegistry;
}

export function resetToolRegistry(): void {
  if (globalRegistry) {
    globalRegistry.dispose();
    globalRegistry = null;
  }
}
