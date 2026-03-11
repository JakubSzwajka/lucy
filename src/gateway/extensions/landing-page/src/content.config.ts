import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
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

// Docs collection: module READMEs from src/ + hand-written pages from docs/pages/
const docs = defineCollection({
  loader: glob({
    pattern: [
      "src/**/README.md",
      "docs/pages/**/*.md",
      "docs/decisions/README.md",
    ],
    base: root,
    generateId: ({ entry }) => {
      // docs/pages/getting-started.md → getting-started
      if (entry.startsWith("docs/pages/")) {
        return entry.replace("docs/pages/", "").replace(/\.md$/, "");
      }
      // docs/decisions/README.md → decisions
      if (entry === "docs/decisions/README.md") {
        return "decisions";
      }
      // src/gateway/core/README.md → gateway-core
      // src/runtime/core/README.md → runtime-core
      // src/runtime/extensions/memory/README.md → memory
      // src/gateway/extensions/webui/README.md → webui
      const dir = entry.replace(/\/README\.md$/, "");
      const parts = dir.split("/");
      const name = parts[parts.length - 1];
      // Disambiguate "core" by prefixing with parent (runtime/gateway)
      if (name === "core" && parts.length >= 2) {
        return `${parts[parts.length - 2]}-${name}`;
      }
      return name;
    },
  }),
  schema: z.object({
    title: z.string(),
    section: z.string().optional().default("General"),
    order: z.number().optional().default(99),
  }),
});

export const collections = { prds, docs };
