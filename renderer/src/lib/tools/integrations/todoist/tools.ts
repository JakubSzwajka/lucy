import { z } from "zod";
import { defineTool } from "../../types";
import type { ToolDefinition } from "../../types";
import type { TodoistClient } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function createTodoistTools(
  client: TodoistClient,
  _config: Record<string, unknown>
): AnyToolDefinition[] {
  return [
    defineTool({
      name: "todoist_list_tasks",
      description:
        "List tasks from Todoist. Can filter by project ID or using Todoist filter syntax (e.g., 'today', 'overdue', 'p1', '@label').",

      inputSchema: z.object({
        projectId: z
          .string()
          .optional()
          .describe("Filter tasks by project ID"),
        filter: z
          .string()
          .optional()
          .describe(
            "Todoist filter query (e.g., 'today', 'overdue', 'tomorrow', 'p1' for priority 1)"
          ),
      }),

      source: { type: "integration", integrationId: "todoist" },

      execute: async (args) => {
        const tasks = await client.getTasks({
          project_id: args.projectId,
          filter: args.filter,
        });

        return tasks.map((task) => ({
          id: task.id,
          content: task.content,
          description: task.description || undefined,
          projectId: task.project_id,
          priority: task.priority,
          due: task.due
            ? {
                date: task.due.date,
                string: task.due.string,
                isRecurring: task.due.is_recurring,
              }
            : null,
          labels: task.labels,
          url: task.url,
        }));
      },
    }),

    defineTool({
      name: "todoist_list_projects",
      description: "List all projects in Todoist.",

      inputSchema: z.object({}),

      source: { type: "integration", integrationId: "todoist" },

      execute: async () => {
        const projects = await client.getProjects();

        return projects.map((project) => ({
          id: project.id,
          name: project.name,
          color: project.color,
          isInbox: project.is_inbox_project,
          isFavorite: project.is_favorite,
          url: project.url,
        }));
      },
    }),
  ];
}
