import type { ToolDefinition } from "../types";

// Re-export all builtin tool categories
// Add new categories here as they are created:
// export { filesystemTools } from "./filesystem";
// export { agentTools } from "./agents";
// export { webTools } from "./web";

// ============================================================================
// All Builtin Tools
// ============================================================================

// Combine all builtin tools into a single array
// Add tool arrays from each category as they are implemented
export const builtinTools: ToolDefinition[] = [
  // ...filesystemTools,
  // ...agentTools,
  // ...webTools,
];

// ============================================================================
// Category Constants
// ============================================================================

export const BUILTIN_CATEGORIES = {
  FILESYSTEM: "filesystem",
  AGENTS: "agents",
  WEB: "web",
  SYSTEM: "system",
  DATA: "data",
} as const;

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[keyof typeof BUILTIN_CATEGORIES];
