import { z } from "zod";
import type { InlineUIRegistration } from "./types";

// ============================================================================
// COMPONENT SCHEMAS
// ============================================================================

/**
 * Schema for task-list component items
 */
export const taskItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

export type TaskItem = z.infer<typeof taskItemSchema>;

/**
 * Schema for task-list component props
 */
export const taskListSchema = z.object({
  items: z.array(taskItemSchema),
});

export type TaskListProps = z.infer<typeof taskListSchema>;

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

// Note: Components are registered separately in register-inline-components.ts
// This file only contains schemas and helper functions

export const inlineUISchemas: Record<string, { schema: z.ZodType; description: string; example: string }> = {
  "task-list": {
    schema: taskListSchema,
    description: "Interactive task/todo list with checkboxes. Users can toggle task completion by clicking.",
    example: `\`\`\`lucy-ui:task-list
{
  "items": [
    {"id": "1", "text": "Review the pull request", "completed": false},
    {"id": "2", "text": "Update documentation", "completed": true}
  ]
}
\`\`\``,
  },
};

export type InlineUIComponentName = keyof typeof inlineUISchemas;

// Full registry with components (populated by register-inline-components.ts)
const fullRegistry: Map<string, InlineUIRegistration> = new Map();

/**
 * Register an inline UI component
 */
export function registerInlineUI(name: string, registration: InlineUIRegistration): void {
  fullRegistry.set(name, registration);
}

/**
 * Get registration for a component
 */
export function getInlineUIRegistration(name: string): InlineUIRegistration | undefined {
  return fullRegistry.get(name);
}

/**
 * Check if a component name is registered
 */
export function isRegisteredInlineComponent(name: string): boolean {
  return fullRegistry.has(name);
}

/**
 * Validate props for an inline UI component
 */
export function validateInlineUIProps(
  componentName: string,
  props: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const schemaConfig = inlineUISchemas[componentName as InlineUIComponentName];

  if (!schemaConfig) {
    return { success: false, error: `Unknown component: ${componentName}` };
  }

  const result = schemaConfig.schema.safeParse(props);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data };
}

/**
 * Generate system prompt documentation for available inline UI components
 */
export function generateInlineUIPrompt(): string {
  const lines = [
    "## Available UI Components",
    "",
    "You can embed interactive UI components in your responses using special code blocks.",
    "Use these when interactivity adds value over plain markdown.",
    "",
  ];

  for (const [name, config] of Object.entries(inlineUISchemas)) {
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(config.description);
    lines.push("");
    lines.push("**Format:**");
    lines.push(config.example);
    lines.push("");
  }

  lines.push("**Guidelines:**");
  lines.push("- Use UI components only when interactivity adds value");
  lines.push("- Always provide valid JSON inside the code block");
  lines.push("- Include surrounding text to provide context");
  lines.push("- IDs should be unique within each component");

  return lines.join("\n");
}
