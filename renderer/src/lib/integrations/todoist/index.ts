import { z } from "zod";
import { defineIntegration } from "../types";
import { TodoistClient } from "./client";
import { createTodoistTools } from "./tools";

export const todoistIntegration = defineIntegration({
  id: "todoist",
  name: "Todoist",
  description: "Task management - list tasks and projects from Todoist",
  iconUrl: "/icons/todoist.svg",

  credentialsSchema: z.object({
    apiKey: z
      .string()
      .min(1)
      .describe("Todoist API token (from Settings > Integrations > Developer)"),
  }),

  configSchema: z.object({
    defaultProject: z
      .string()
      .optional()
      .describe("Default project ID for new tasks"),
  }),

  createTools: (credentials, config) => {
    const client = new TodoistClient(credentials.apiKey);
    return createTodoistTools(client, config);
  },

  testConnection: async (credentials) => {
    try {
      const client = new TodoistClient(credentials.apiKey);
      const user = await client.getUser();
      return {
        success: true,
        info: `Connected as ${user.email}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});
