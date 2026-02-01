/**
 * Memory Tool Module
 *
 * Knowledge management with wiki-link based relationships.
 * Uses Obsidian as the storage backend with structured memory organization.
 */

import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { ObsidianClient } from "@/lib/integrations";

// ============================================================================
// Constants
// ============================================================================

const MEMORY_ROOT = "Memory";

const MEMORY_TYPES = [
  "fact",
  "decision",
  "preference",
  "project",
  "person",
  "concept",
  "procedure",
  "reference",
] as const;

type MemoryType = (typeof MEMORY_TYPES)[number];

const TYPE_FOLDERS: Record<MemoryType, string> = {
  fact: "Facts",
  decision: "Decisions",
  preference: "Preferences",
  project: "Projects",
  person: "People",
  concept: "Concepts",
  procedure: "Procedures",
  reference: "References",
};

// ============================================================================
// Helpers
// ============================================================================

interface MemoryFrontmatter {
  created: string;
  updated: string;
  type: MemoryType;
  tags: string[];
  source: string;
}

interface Memory {
  path: string;
  title: string;
  content: string;
  frontmatter: MemoryFrontmatter;
  links: string[];
}

function generateFrontmatter(
  type: MemoryType,
  tags: string[],
  existingCreated?: string
): string {
  const now = new Date().toISOString();
  return `---
created: ${existingCreated || now}
updated: ${now}
type: ${type}
tags:
${tags.map((t) => `  - ${t}`).join("\n")}
source: lucy-agent
---`;
}

function parseFrontmatter(content: string): {
  frontmatter: Partial<MemoryFrontmatter>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yaml, body] = match;
  const frontmatter: Partial<MemoryFrontmatter> = {};

  // Simple YAML parsing for our known fields
  const lines = yaml.split("\n");
  let collectingTags = false;
  const tags: string[] = [];

  for (const line of lines) {
    if (line.startsWith("created:")) {
      frontmatter.created = line.replace("created:", "").trim();
      collectingTags = false;
    } else if (line.startsWith("updated:")) {
      frontmatter.updated = line.replace("updated:", "").trim();
      collectingTags = false;
    } else if (line.startsWith("type:")) {
      frontmatter.type = line.replace("type:", "").trim() as MemoryType;
      collectingTags = false;
    } else if (line.startsWith("source:")) {
      frontmatter.source = line.replace("source:", "").trim();
      collectingTags = false;
    } else if (line.startsWith("tags:")) {
      collectingTags = true;
    } else if (collectingTags && line.trim().startsWith("- ")) {
      tags.push(line.trim().replace("- ", ""));
    }
  }

  if (tags.length > 0) {
    frontmatter.tags = tags;
  }

  return { frontmatter, body: body.trim() };
}

function extractWikiLinks(content: string): string[] {
  const linkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    links.push(match[1]);
  }

  return [...new Set(links)];
}

function formatMemoryContent(
  title: string,
  content: string,
  context?: string,
  links?: string[]
): string {
  let body = `# ${title}\n\n## Content\n\n${content}`;

  if (context) {
    body += `\n\n## Context\n\n${context}`;
  }

  if (links && links.length > 0) {
    body += `\n\n## Related\n\n${links.map((l) => `- [[${l}]]`).join("\n")}`;
  }

  body += `\n\n---\n*Memory managed by Lucy*`;

  return body;
}

function getMemoryPath(type: MemoryType, title: string): string {
  const folder = TYPE_FOLDERS[type];
  const sanitizedTitle = title.replace(/[/\\:*?"<>|]/g, "-");
  return `${MEMORY_ROOT}/${folder}/${sanitizedTitle}`;
}

// ============================================================================
// Module Definition
// ============================================================================

export const memoryModule = defineToolModule<ObsidianClient>({
  id: "memory",
  name: "Memory",
  description: "Knowledge management with wiki-link relationships",
  integrationId: "obsidian",

  createTools: (client) => [
    defineTool({
      name: "memory_search",
      description: `Search the knowledge base for relevant memories.

Use this to:
- Recall past decisions and their rationale
- Find user preferences before making suggestions
- Look up project context and history
- Discover related information via the link graph

Returns memories with their content, tags, and wiki link connections.
ALWAYS search before adding to avoid duplicates.`,

      inputSchema: z.object({
        query: z
          .string()
          .describe("Search query - keywords or natural language"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Filter by tags (e.g., ['project', 'decision'])"),
        type: z
          .enum(MEMORY_TYPES)
          .optional()
          .describe("Filter by memory type"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum results to return"),
      }),

      source: { type: "builtin", moduleId: "memory" },

      execute: async (args) => {
        const { query, tags, type, limit = 10 } = args;

        // Search using Obsidian's search API
        const searchResults = await client.searchNotes(query, 150);

        // Filter to memory folder only
        const memoryResults = searchResults.filter((r) =>
          r.filename.startsWith(MEMORY_ROOT + "/")
        );

        // Read full content for matching notes and apply filters
        const memories: Memory[] = [];

        for (const result of memoryResults.slice(0, limit * 2)) {
          const note = await client.readNote(result.filename);
          if (!note) continue;

          const { frontmatter, body } = parseFrontmatter(note.content);

          // Filter by type if specified
          if (type && frontmatter.type !== type) continue;

          // Filter by tags if specified
          if (tags && tags.length > 0) {
            const memoryTags = frontmatter.tags || [];
            const hasMatchingTag = tags.some((t) => memoryTags.includes(t));
            if (!hasMatchingTag) continue;
          }

          memories.push({
            path: note.path,
            title: note.name,
            content: body,
            frontmatter: frontmatter as MemoryFrontmatter,
            links: extractWikiLinks(note.content),
          });

          if (memories.length >= limit) break;
        }

        return {
          memories,
          count: memories.length,
          query,
        };
      },
    }),

    defineTool({
      name: "memory_add",
      description: `Store a new memory in the knowledge base.

REQUIRED STRUCTURE:
- title: Clear, searchable title for the memory
- content: The information to remember (markdown supported)
- tags: At least 2-3 relevant tags for categorization
- type: Classify appropriately (fact, decision, preference, project, person, concept, procedure, reference)

WIKI LINK REQUIREMENTS - CRITICAL:
Your content MUST include [[wiki links]] to build the knowledge graph:
- Link to topics: [[Programming]], [[JavaScript]], [[API Design]]
- Link to people: [[@Person Name]] (use @ prefix)
- Link to projects: [[#Project Name]] (use # prefix)
- Link to related memories when relevant

EXAMPLE with proper linking:
"Discussed [[API Design]] patterns with [[@Sarah]].
Decided to use [[REST]] over [[GraphQL]] for [[#Lucy App]]
due to simpler caching. See [[Decision - Tech Stack 2024]]."

The wiki links create relationships in Obsidian's graph, enabling discovery of related knowledge.`,

      inputSchema: z.object({
        title: z.string().describe("Memory title (becomes the note filename)"),
        content: z
          .string()
          .describe(
            "Main content with [[wiki links]] to related topics, people, and concepts"
          ),
        tags: z
          .array(z.string())
          .min(1)
          .describe("Tags for categorization (at least 1 required)"),
        type: z.enum(MEMORY_TYPES).describe("Memory classification type"),
        context: z
          .string()
          .optional()
          .describe("Optional context about when/why this was stored"),
        links: z
          .array(z.string())
          .optional()
          .describe(
            "Additional explicit links to add in Related section (without [[ ]])"
          ),
      }),

      source: { type: "builtin", moduleId: "memory" },

      execute: async (args) => {
        const { title, content, tags, type, context, links } = args;

        // Validate wiki links are present
        const contentLinks = extractWikiLinks(content);
        if (contentLinks.length === 0) {
          return {
            error:
              "Content must include at least one [[wiki link]] to build the knowledge graph. " +
              "Link to topics like [[Programming]], people like [[@Name]], or projects like [[#Project]].",
          };
        }

        const path = getMemoryPath(type, title);
        const frontmatter = generateFrontmatter(type, tags);
        const body = formatMemoryContent(title, content, context, links);
        const fullContent = `${frontmatter}\n\n${body}`;

        await client.writeNote(path, fullContent);

        const allLinks = [...contentLinks, ...(links || [])];

        return {
          success: true,
          path: `${path}.md`,
          title,
          type,
          tags,
          links: [...new Set(allLinks)],
          message: `Memory "${title}" stored in ${TYPE_FOLDERS[type]}/`,
        };
      },
    }),

    defineTool({
      name: "memory_update",
      description: `Update an existing memory with new information or corrections.

Use this to:
- Append new learnings to existing knowledge
- Correct outdated information
- Add new [[wiki links]] as relationships are discovered
- Update tags for better organization

When appending, the new content is added under a dated section.
Maintain wiki link conventions in any new content.`,

      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Path to the memory (e.g., 'Memory/Decisions/API Choice' or full path)"
          ),
        updates: z.object({
          content: z
            .string()
            .optional()
            .describe("Replace entire content (must include [[wiki links]])"),
          append: z
            .string()
            .optional()
            .describe("Append to existing content (should include [[wiki links]])"),
          tags: z
            .object({
              add: z.array(z.string()).optional(),
              remove: z.array(z.string()).optional(),
            })
            .optional()
            .describe("Tags to add or remove"),
          links: z
            .object({
              add: z.array(z.string()).optional(),
            })
            .optional()
            .describe("Links to add to Related section"),
        }),
      }),

      source: { type: "builtin", moduleId: "memory" },

      execute: async (args) => {
        const { path, updates } = args;

        // Normalize path
        const normalizedPath = path.startsWith(MEMORY_ROOT)
          ? path
          : `${MEMORY_ROOT}/${path}`;

        // Read existing note
        const note = await client.readNote(normalizedPath);
        if (!note) {
          return { error: `Memory not found: ${normalizedPath}` };
        }

        const { frontmatter, body } = parseFrontmatter(note.content);

        // Update tags
        let newTags = frontmatter.tags || [];
        if (updates.tags?.add) {
          newTags = [...new Set([...newTags, ...updates.tags.add])];
        }
        if (updates.tags?.remove) {
          newTags = newTags.filter((t) => !updates.tags!.remove!.includes(t));
        }

        // Update content
        let newBody = body;
        if (updates.content) {
          // Validate wiki links
          if (extractWikiLinks(updates.content).length === 0) {
            return {
              error:
                "New content must include at least one [[wiki link]].",
            };
          }
          newBody = updates.content;
        } else if (updates.append) {
          const date = new Date().toISOString().split("T")[0];
          newBody = `${body}\n\n### Update (${date})\n\n${updates.append}`;
        }

        // Add new links to Related section
        if (updates.links?.add && updates.links.add.length > 0) {
          const existingLinks = extractWikiLinks(newBody);
          const newLinks = updates.links.add.filter(
            (l) => !existingLinks.includes(l)
          );

          if (newLinks.length > 0) {
            if (newBody.includes("## Related")) {
              // Append to existing Related section
              newBody = newBody.replace(
                /(## Related\n\n[\s\S]*?)(\n\n---|\n*$)/,
                `$1\n${newLinks.map((l) => `- [[${l}]]`).join("\n")}$2`
              );
            } else {
              // Add Related section before footer
              newBody = newBody.replace(
                /(\n\n---\n\*Memory managed by Lucy\*)?$/,
                `\n\n## Related\n\n${newLinks.map((l) => `- [[${l}]]`).join("\n")}\n\n---\n*Memory managed by Lucy*`
              );
            }
          }
        }

        // Regenerate frontmatter with updated date
        const newFrontmatter = generateFrontmatter(
          frontmatter.type || "fact",
          newTags,
          frontmatter.created
        );

        const fullContent = `${newFrontmatter}\n\n${newBody}`;
        await client.writeNote(normalizedPath, fullContent);

        return {
          success: true,
          path: note.path,
          updated: {
            tags: newTags,
            links: extractWikiLinks(fullContent),
          },
          message: `Memory "${note.name}" updated.`,
        };
      },
    }),
  ],
});
