/**
 * Register all inline generative UI components
 * This file is imported to initialize the component registry
 */

import { registerInlineUI, taskListSchema, inlineUISchemas } from "./registry";
import { TaskList } from "@/components/generative-ui/inline/TaskList";

// Register TaskList component
registerInlineUI("task-list", {
  schema: taskListSchema,
  component: TaskList,
  description: inlineUISchemas["task-list"].description,
  example: inlineUISchemas["task-list"].example,
});

// Log registered components for debugging
if (typeof window !== "undefined") {
  console.log("[Inline Generative UI] Registered component: task-list");
}
