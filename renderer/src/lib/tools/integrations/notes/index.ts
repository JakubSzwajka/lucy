import { z } from "zod";
import { defineIntegration } from "../types";
import { createNotesTools } from "./tools";

export const notesIntegration = defineIntegration({
  id: "notes",
  name: "Notes",
  description: "Create and manage notes for longer-form content like documentation and drafts",
  iconUrl: "/icons/notes.svg",

  // Notes doesn't need credentials - it's local storage
  credentialsSchema: z.object({}),

  // Optional config
  configSchema: z.object({
    defaultTags: z
      .array(z.string())
      .optional()
      .describe("Default tags to apply to new notes"),
  }),

  createTools: () => {
    return createNotesTools();
  },
});
