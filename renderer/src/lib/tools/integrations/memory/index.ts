import { z } from "zod";
import { defineIntegration } from "../types";
import { createMemoryTools } from "./tools";

export const memoryIntegration = defineIntegration({
  id: "memory",
  name: "Memory",
  description: "Persistent memory for storing and recalling information across conversations",
  iconUrl: "/icons/memory.svg",

  // Memory doesn't need credentials - it's local storage
  credentialsSchema: z.object({}),

  // Optional config for customization
  configSchema: z.object({
    maxMemories: z
      .number()
      .optional()
      .describe("Maximum number of memories to store (default: unlimited)"),
  }),

  createTools: () => {
    return createMemoryTools();
  },
});
