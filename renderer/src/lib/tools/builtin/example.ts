/**
 * Example Builtin Tools
 *
 * This file demonstrates how to create programmatic tools.
 * Copy this pattern when adding new tool categories.
 */

import { z } from "zod";
import { defineTool } from "../types";
import { BUILTIN_CATEGORIES } from "./index";

// ============================================================================
// Example: Echo Tool
// ============================================================================

export const echoTool = defineTool({
  name: "echo",
  description: "Echoes back the provided message. Useful for testing.",
  inputSchema: z.object({
    message: z.string().describe("The message to echo back"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.SYSTEM,
  },
  execute: async ({ message }) => {
    return { echoed: message, timestamp: new Date().toISOString() };
  },
});

// ============================================================================
// Example: Tool with Approval Required
// ============================================================================

export const dangerousTool = defineTool({
  name: "dangerous_operation",
  description: "An example tool that requires user approval before execution.",
  inputSchema: z.object({
    operation: z.string().describe("The operation to perform"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.SYSTEM,
  },
  // Static approval requirement
  requiresApproval: true,
  execute: async ({ operation }) => {
    return { result: `Executed: ${operation}` };
  },
});

// ============================================================================
// Example: Tool with Dynamic Approval
// ============================================================================

export const conditionalApprovalTool = defineTool({
  name: "conditional_operation",
  description: "A tool that requires approval only for certain arguments.",
  inputSchema: z.object({
    action: z.enum(["read", "write", "delete"]).describe("The action to perform"),
    target: z.string().describe("The target of the action"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.SYSTEM,
  },
  // Dynamic approval: only require for destructive actions
  requiresApproval: (args) => args.action === "delete",
  execute: async ({ action, target }) => {
    return { action, target, success: true };
  },
});

// ============================================================================
// Example: Tool with Custom Validation
// ============================================================================

export const validatedTool = defineTool({
  name: "validated_operation",
  description: "A tool with custom validation logic beyond the schema.",
  inputSchema: z.object({
    count: z.number().describe("A number between 1 and 100"),
    name: z.string().describe("A non-empty name"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.SYSTEM,
  },
  validate: async (args) => {
    if (args.count < 1 || args.count > 100) {
      return { valid: false, error: "Count must be between 1 and 100" };
    }
    if (args.name.trim().length === 0) {
      return { valid: false, error: "Name cannot be empty" };
    }
    return { valid: true };
  },
  execute: async ({ count, name }) => {
    return { message: `Created ${count} items for ${name}` };
  },
});

// ============================================================================
// Example: Tool with Context Access
// ============================================================================

export const statefulTool = defineTool({
  name: "counter",
  description: "A stateful counter tool that persists across calls within a session.",
  inputSchema: z.object({
    action: z.enum(["increment", "decrement", "get", "reset"]).describe("Counter action"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.SYSTEM,
  },
  execute: async ({ action }, context) => {
    const key = "counter_value";
    let value = context.getState<number>(key) ?? 0;

    switch (action) {
      case "increment":
        value += 1;
        break;
      case "decrement":
        value -= 1;
        break;
      case "reset":
        value = 0;
        break;
      case "get":
        // Just return current value
        break;
    }

    context.setState(key, value);
    return { value, action };
  },
});

// ============================================================================
// Example: Tool with Output Formatting
// ============================================================================

export const formattedOutputTool = defineTool({
  name: "get_user_info",
  description: "Returns user information with formatted output.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID to look up"),
  }),
  source: {
    type: "builtin",
    category: BUILTIN_CATEGORIES.DATA,
  },
  execute: async ({ userId }) => {
    // Simulate fetching user data
    return {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      createdAt: new Date(),
      metadata: {
        loginCount: 42,
        preferences: { theme: "dark" },
      },
    };
  },
  // Transform the output before returning to AI
  formatOutput: (output) => {
    return {
      id: output.id,
      name: output.name,
      email: output.email,
      // Convert date to ISO string for AI consumption
      createdAt: output.createdAt.toISOString(),
      // Flatten nested metadata
      loginCount: output.metadata.loginCount,
      theme: output.metadata.preferences.theme,
    };
  },
});

// ============================================================================
// Export All Example Tools
// ============================================================================

export const exampleTools = [
  echoTool,
  dangerousTool,
  conditionalApprovalTool,
  validatedTool,
  statefulTool,
  formattedOutputTool,
];
