import type { ComponentType } from "react";
import type { ToolCallActivity } from "@/types";

/**
 * Props passed to all generative UI components
 */
export interface GenerativeUIComponentProps<T = unknown> {
  /** Parsed data from the tool result */
  data: T;
  /** The original tool call activity */
  activity: ToolCallActivity;
  /** Callback for component actions (e.g., complete task, reschedule) */
  onAction?: (action: string, payload: unknown) => Promise<void>;
  /** Whether an action is currently in progress */
  isActionPending?: boolean;
}

/**
 * Configuration for a generative UI component
 */
export interface GenerativeUIConfig {
  /** The React component to render */
  component: ComponentType<GenerativeUIComponentProps<unknown>>;
  /** Function to parse the tool result string into typed data */
  parseResult: (result: string) => unknown;
  /** Tool name patterns this component handles (supports * wildcard) */
  toolPatterns: string[];
  /** Human-readable name for this component type */
  displayName: string;
}

// Registry maps tool names to their generative UI config
const registry: Map<string, GenerativeUIConfig> = new Map();

/**
 * Register a generative UI component for specific tool patterns
 */
export function registerGenerativeUI(config: GenerativeUIConfig): void {
  for (const pattern of config.toolPatterns) {
    registry.set(pattern, config);
  }
}

/**
 * Get the generative UI config for a tool name
 * Supports exact matches and wildcard patterns (e.g., "*__get_tasks")
 * Pattern matching is case-insensitive and normalizes hyphens to underscores
 */
export function getGenerativeUI(toolName: string): GenerativeUIConfig | null {
  // Normalize tool name: lowercase and replace hyphens with underscores
  const normalizedToolName = toolName.toLowerCase().replace(/-/g, "_");

  // Direct match first (normalized)
  for (const [pattern, config] of registry.entries()) {
    const normalizedPattern = pattern.toLowerCase().replace(/-/g, "_");
    if (normalizedPattern === normalizedToolName) {
      return config;
    }
  }

  // Pattern match (e.g., "*__get_tasks" matches "UUID__GET-TASKS")
  for (const [pattern, config] of registry.entries()) {
    if (pattern.includes("*")) {
      const normalizedPattern = pattern.toLowerCase().replace(/-/g, "_");
      const regexPattern = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
        .replace(/\*/g, ".*"); // Convert * to .*
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(normalizedToolName)) {
        return config;
      }
    }
  }

  return null;
}

/**
 * Check if a tool has a generative UI component registered
 */
export function hasGenerativeUI(toolName: string): boolean {
  return getGenerativeUI(toolName) !== null;
}

/**
 * Get all registered tool patterns
 */
export function getRegisteredPatterns(): string[] {
  return Array.from(registry.keys());
}
