/**
 * Tasks Tool Module
 *
 * Abstract task management tools.
 * Currently backed by Todoist integration.
 */

import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { TodoistClient } from "@/lib/integrations";

/**
 * Tasks module definition.
 *
 * Provides abstract task tools that work with the Todoist integration.
 */
export const tasksModule = defineToolModule<TodoistClient>({
  id: "tasks",
  name: "Tasks",
  description: "Task management - list tasks and projects",
  integrationId: "todoist",

  createTools: (client) => [
    defineTool({
      name: "tasks_list",
      description:
        "List tasks. Can filter by project ID or using filter syntax (e.g., 'today', 'overdue', 'p1' for priority 1).",

      inputSchema: z.object({
        projectId: z
          .string()
          .optional()
          .describe("Filter tasks by project ID"),
        filter: z
          .string()
          .optional()
          .describe(
            "Filter query (e.g., 'today', 'overdue', 'tomorrow', 'p1' for priority 1)"
          ),
      }),

      source: { type: "builtin", moduleId: "tasks" },

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
      name: "tasks_get_projects",
      description: "List all task projects.",

      inputSchema: z.object({}),

      source: { type: "builtin", moduleId: "tasks" },

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
  ],
});
