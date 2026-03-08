import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const prdsBase = path.join(root, "docs/prds");

const prds = defineCollection({
  loader: glob({
    pattern: "**/README.md",
    base: prdsBase,
    generateId: ({ entry }) => {
      // entry is like "plugin-hot-reload/README.md" — extract dir name as slug
      const parts = entry.split("/");
      return parts.length > 1 ? parts[0] : entry.replace(/\/README\.md$/, "");
    },
  }),
  schema: z.object({
    status: z.string().optional().default("draft"),
    date: z.coerce.date().optional(),
    author: z.string().optional(),
    "gh-issue": z.string().nullable().optional(),
  }),
});

export const collections = { prds };
