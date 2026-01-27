/**
 * Register all generative UI components
 * This file is imported once at app initialization
 */

import { registerGenerativeUI, getRegisteredPatterns } from "./registry";
import { parseTodoistResult } from "./todoist/parser";
import { TodoistTaskList } from "@/components/generative-ui/todoist/TodoistTaskList";
import type { TodoistTaskListData } from "./todoist/types";
import type { GenerativeUIComponentProps } from "./registry";

// Register Todoist task list component
registerGenerativeUI({
  displayName: "Todoist Tasks",
  toolPatterns: [
    // Match any server ID with these tool names (pattern uses * wildcard)
    // The registry normalizes names (lowercase, hyphens->underscores) for matching
    "*__get_tasks",
    "*__find_tasks_by_date",
    "*__find-tasks-by-date", // Also include hyphenated version
    "*__get_task",
    "*__search_tasks",
    "*__search-tasks",
    // Direct tool names (if no server prefix)
    "get_tasks",
    "find_tasks_by_date",
    "find-tasks-by-date",
    "get_task",
    "search_tasks",
    "search-tasks",
  ],
  component: TodoistTaskList as React.ComponentType<GenerativeUIComponentProps<unknown>>,
  parseResult: (result: string): TodoistTaskListData => {
    return parseTodoistResult(result);
  },
});

// Log registered patterns for debugging
if (typeof window !== "undefined") {
  console.log("[Generative UI] Registered patterns:", getRegisteredPatterns());
}

// Future registrations can be added here:
// registerGenerativeUI({ ... }) for other components
