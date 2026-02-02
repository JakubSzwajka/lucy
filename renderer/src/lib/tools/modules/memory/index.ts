/**
 * Memory Tool Module - Hybrid Entity/Fact Model
 *
 * Two types of memories:
 * - ENTITIES: Brief profiles of people, projects, concepts (stable, hub-like)
 * - FACTS: Specific pieces of knowledge about entities (evolve independently)
 *
 * Structure:
 *   Memory/
 *   ├── Kuba.md              <- Entity (brief profile)
 *   ├── Kuba/
 *   │   ├── tech stack.md    <- Fact (specific knowledge)
 *   │   └── philosophy.md    <- Fact
 *   ├── Lucy App.md          <- Entity
 *   └── Lucy App/
 *       └── architecture.md  <- Fact
 *
 * Obsidian's backlinks automatically aggregate all facts about an entity.
 * The entity note stays brief - facts hold the detailed knowledge.
 */

import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { ObsidianClient } from "@/lib/integrations";
import {
  conversationsIntegration,
  type ConversationSearchResult,
} from "@/lib/integrations";

// ============================================================================
// Constants
// ============================================================================

const MEMORY_ROOT = "Memory";

// ============================================================================
// Types
// ============================================================================

interface MemoryFrontmatter {
  created: string;
  kind: "entity" | "fact";
  tags: string[];
  aliases?: string[];
  entity?: string; // For facts: which entity this is about
  updates?: string; // Path to memory this supersedes
}

interface Memory {
  path: string;
  title: string;
  content: string;
  frontmatter: MemoryFrontmatter;
}

// ============================================================================
// Helpers
// ============================================================================

function generateFrontmatter(
  kind: "entity" | "fact",
  tags: string[],
  options?: {
    aliases?: string[];
    entity?: string;
    updates?: string;
  }
): string {
  const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  let yaml = `---
created: ${now}
kind: ${kind}
tags: [${tags.join(", ")}]`;

  if (options?.aliases && options.aliases.length > 0) {
    yaml += `\naliases: [${options.aliases.join(", ")}]`;
  }

  if (options?.entity) {
    yaml += `\nentity: "[[${options.entity}]]"`;
  }

  if (options?.updates) {
    yaml += `\nupdates: ${options.updates}`;
  }

  yaml += `\n---`;
  return yaml;
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

  const parseInlineArray = (line: string, prefix: string): string[] | null => {
    if (!line.startsWith(prefix)) return null;
    const match = line.match(new RegExp(`${prefix}\\s*\\[([^\\]]*)\\]`));
    if (match) {
      return match[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return null;
  };

  const lines = yaml.split("\n");
  for (const line of lines) {
    if (line.startsWith("created:")) {
      frontmatter.created = line.replace("created:", "").trim();
    } else if (line.startsWith("kind:")) {
      frontmatter.kind = line.replace("kind:", "").trim() as "entity" | "fact";
    } else if (line.startsWith("entity:")) {
      // Extract entity name from "[[Name]]" format
      const entityMatch = line.match(/entity:\s*"?\[\[([^\]]+)\]\]"?/);
      if (entityMatch) {
        frontmatter.entity = entityMatch[1];
      }
    } else if (line.startsWith("updates:")) {
      frontmatter.updates = line.replace("updates:", "").trim();
    } else if (line.startsWith("tags:")) {
      const tags = parseInlineArray(line, "tags:");
      if (tags) frontmatter.tags = tags;
    } else if (line.startsWith("aliases:")) {
      const aliases = parseInlineArray(line, "aliases:");
      if (aliases) frontmatter.aliases = aliases;
    }
  }

  return { frontmatter, body: body.trim() };
}

function sanitizeForPath(text: string): string {
  return text.replace(/[/\\:*?"<>|]/g, "-").trim();
}

function getEntityPath(title: string): string {
  return `${MEMORY_ROOT}/${sanitizeForPath(title)}`;
}

function getFactPath(entity: string, topic: string): string {
  return `${MEMORY_ROOT}/${sanitizeForPath(entity)}/${sanitizeForPath(topic)}`;
}

// ============================================================================
// Conversation Search Formatting
// ============================================================================

interface FormattedConversationResult {
  sessionTitle: string;
  matchType: "message" | "tool_call" | "tool_result" | "reasoning";
  matchedContent: string;
  context: string;
  createdAt: Date;
}

function formatConversationResults(
  results: ConversationSearchResult[]
): FormattedConversationResult[] {
  return results.map((result) => {
    // Format context as readable conversation snippet
    const contextLines: string[] = [];

    // Add "before" context
    for (const item of result.context.before) {
      contextLines.push(formatContextItem(item));
    }

    // Add matched item with marker
    contextLines.push(`>>> MATCHED: ${formatContextItem(result.matchedItem)} <<<`);

    // Add "after" context
    for (const item of result.context.after) {
      contextLines.push(formatContextItem(item));
    }

    return {
      sessionTitle: result.sessionTitle,
      matchType: result.matchedItem.type,
      matchedContent: result.matchedItem.content,
      context: contextLines.join("\n"),
      createdAt: result.matchedItem.createdAt,
    };
  });
}

function formatContextItem(item: {
  type: string;
  content: string;
  role?: string;
  toolName?: string;
}): string {
  switch (item.type) {
    case "message":
      return `[${item.role || "unknown"}]: ${truncate(item.content, 200)}`;
    case "tool_call":
      return `[tool: ${item.toolName}]`;
    case "tool_result":
      return `[result]: ${truncate(item.content, 200)}`;
    case "reasoning":
      return `[thinking]: ${truncate(item.content, 200)}`;
    default:
      return `[${item.type}]: ${truncate(item.content, 200)}`;
  }
}

function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// ============================================================================
// Module Definition
// ============================================================================

export const memoryModule = defineToolModule<ObsidianClient>({
  id: "memory",
  name: "Memory",
  description: "Knowledge management with entity/fact hybrid model",
  integrationId: "obsidian",

  createTools: (client) => [
    defineTool({
      name: "memory",
      description: `Store and recall knowledge using a hybrid entity/fact model.

TWO TYPES OF MEMORIES:

1. ENTITIES - Brief profiles of people, projects, or concepts
   - Stable, hub-like notes
   - Just identity + key relationships
   - Let backlinks aggregate the details
   - Path: Memory/{name}.md

2. FACTS - Specific pieces of knowledge about an entity
   - Detailed, evolving information
   - Can be superseded independently
   - Linked to their entity
   - Path: Memory/{entity}/{topic}.md

STRUCTURE EXAMPLE:
  Memory/
  ├── Kuba.md                 <- Entity (brief)
  ├── Kuba/
  │   ├── tech stack.md       <- Fact
  │   ├── work philosophy.md  <- Fact
  │   └── side projects.md    <- Fact
  ├── Dominika.md             <- Entity
  ├── Lucy App.md             <- Entity
  └── Lucy App/
      └── architecture.md     <- Fact

KEY INSIGHT: The entity note stays brief. Obsidian's backlinks automatically
show all facts. You don't need to cram everything into one document.

WIKI LINKS: Use [[Name]] to connect knowledge. Links to non-existent notes
are fine - they become real when created. Be consistent with naming.

ACTIONS:
- "save": Store entity or fact
- "find": Search memories
- "update": Append to existing memory

EXAMPLES:

Save an entity (person):
{
  "action": "save",
  "kind": "entity",
  "title": "Kuba",
  "content": "Software architect based in Wrocław. Engaged to [[Dominika]]. Building [[Lucy App]].",
  "tags": ["person"],
  "aliases": ["Jakub Szwajka", "Kuba Szwajka"]
}

Save an entity (project):
{
  "action": "save",
  "kind": "entity",
  "title": "Lucy App",
  "content": "AI assistant with memory. Built with [[Electron]] + [[Next.js]]. Created by [[Kuba]].",
  "tags": ["project", "ai"],
  "aliases": ["Lucy", "Lucy Assistant"]
}

Save an entity (concept):
{
  "action": "save",
  "kind": "entity",
  "title": "Domain-Driven Design",
  "content": "Software design approach focusing on the business domain. Core concepts: bounded contexts, aggregates, entities.",
  "tags": ["concept", "architecture"],
  "aliases": ["DDD"]
}

Save a fact about a person:
{
  "action": "save",
  "kind": "fact",
  "entity": "Kuba",
  "topic": "tech stack",
  "content": "Primary: [[Python]], [[FastAPI]], [[SQLAlchemy]], [[Pydantic]]. Has explored: [[Solidity]], [[HTMX]], [[Hono]], [[WebSockets]].",
  "tags": ["tech", "skills"]
}

Save a fact about preferences:
{
  "action": "save",
  "kind": "fact",
  "entity": "Kuba",
  "topic": "work philosophy",
  "content": "Ship fast AND don't create a mess. Uses [[Domain-Driven Design]] for flexibility. AI-assisted workflows. 'Most technical decisions are business decisions in disguise.'",
  "tags": ["philosophy", "work"]
}

Save a fact about a project:
{
  "action": "save",
  "kind": "fact",
  "entity": "Lucy App",
  "topic": "architecture",
  "content": "Desktop app using [[Electron]] + [[Next.js]] via Nextron. [[SQLite]] database with [[Drizzle ORM]]. Connects to [[Anthropic]], [[OpenAI]], [[Google]] APIs.",
  "tags": ["architecture", "tech"]
}

Save a relationship fact:
{
  "action": "save",
  "kind": "fact",
  "entity": "Dominika",
  "topic": "relationship",
  "content": "Engaged to [[Kuba]]. Works as a designer. Loves [[hiking]] and [[photography]].",
  "tags": ["relationship", "family"]
}

Supersede a fact (when something changes):
{
  "action": "save",
  "kind": "fact",
  "entity": "Kuba",
  "topic": "tech stack",
  "content": "Shifting to [[Go]] for performance-critical services. Still using [[Python]] for rapid prototyping.",
  "tags": ["tech", "skills"],
  "updates": "Memory/Kuba/tech stack"
}

SEARCH BEHAVIOR (critical for "find" action):
- This is KEYWORD search, NOT semantic/AI search
- Searches BOTH Obsidian memories AND past conversations in parallel
- Searches match literal text in content
- Short, specific terms work best (1-3 words max)
- Make MULTIPLE searches with different keywords rather than one long query
- Conversation results include context (messages before/after the match)

BAD QUERY (will likely fail):
  { "query": "what is the user's personal website URL" }
  → Searches for that exact phrase literally

GOOD STRATEGY - multiple focused searches:
  { "query": "website" }
  { "query": "URL" }
  { "query": "personal site" }
  { "query": "Kuba" }  ← entity names are reliable anchors

SEARCH TIPS:
1. Start with entity name if known (e.g., "Kuba", "Lucy App")
2. Use 1-3 keywords max per search
3. Try synonyms in separate calls (e.g., "website", "URL", "homepage")
4. Combine results from multiple searches

Find examples:
{
  "action": "find",
  "query": "Kuba"
}

{
  "action": "find",
  "query": "tech stack"
}

{
  "action": "find",
  "query": "Lucy architecture"
}

Update a fact (append new information):
{
  "action": "update",
  "path": "Memory/Kuba/side projects",
  "append": "Started working on [[Tail Gazer]] - tool for tailing multiple service logs."
}

Add aliases to existing entity:
{
  "action": "update",
  "path": "Memory/Dominika",
  "newAliases": ["Dom"]
}`,

      inputSchema: z.object({
        action: z
          .enum(["save", "find", "update"])
          .describe("Action to perform"),

        // For save
        kind: z
          .enum(["entity", "fact"])
          .optional()
          .describe("Type of memory: 'entity' (brief profile) or 'fact' (specific knowledge)"),
        title: z
          .string()
          .optional()
          .describe("For entities: the name (e.g., 'Kuba', 'Lucy App')"),
        entity: z
          .string()
          .optional()
          .describe("For facts: which entity this fact is about"),
        topic: z
          .string()
          .optional()
          .describe("For facts: the topic (e.g., 'tech stack', 'work philosophy')"),
        content: z
          .string()
          .optional()
          .describe("Memory content with [[wiki links]] to connect knowledge"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Tags for categorization"),
        aliases: z
          .array(z.string())
          .optional()
          .describe("Alternative names for entities (e.g., ['Domi'] for Dominika)"),
        updates: z
          .string()
          .optional()
          .describe("Path to memory this supersedes"),

        // For find
        query: z.string().optional().describe("Search keywords (1-3 words). Use short terms, not full sentences. Make multiple searches with different keywords."),

        // For update
        path: z.string().optional().describe("Path to memory to update"),
        append: z.string().optional().describe("Content to append"),
        newTags: z.array(z.string()).optional().describe("Tags to add"),
        newAliases: z.array(z.string()).optional().describe("Aliases to add"),
      }),

      source: { type: "builtin", moduleId: "memory" },

      execute: async (args, context) => {
        const { action } = args;

        // ========== SAVE ==========
        if (action === "save") {
          const { kind, title, entity, topic, content, tags = [], aliases, updates } = args;

          if (!kind) {
            return { error: "kind is required: 'entity' or 'fact'" };
          }

          if (!content) {
            return { error: "content is required" };
          }

          // ENTITY
          if (kind === "entity") {
            if (!title) {
              return { error: "title is required for entities" };
            }

            const path = getEntityPath(title);
            const frontmatter = generateFrontmatter("entity", tags, { aliases, updates });
            const fullContent = `${frontmatter}\n\n${content}`;

            await client.writeNote(path, fullContent);

            return {
              success: true,
              kind: "entity",
              path: `${path}.md`,
              title,
              tags,
              aliases: aliases || [],
              message: `Entity saved: "${title}"`,
            };
          }

          // FACT
          if (kind === "fact") {
            if (!entity) {
              return { error: "entity is required for facts (which entity is this about?)" };
            }
            if (!topic) {
              return { error: "topic is required for facts (what aspect?)" };
            }

            const path = getFactPath(entity, topic);
            const frontmatter = generateFrontmatter("fact", tags, { entity, updates });
            const fullContent = `${frontmatter}\n\n${content}`;

            await client.writeNote(path, fullContent);

            return {
              success: true,
              kind: "fact",
              path: `${path}.md`,
              entity,
              topic,
              tags,
              message: `Fact saved: "${entity} / ${topic}"`,
            };
          }

          return { error: `Unknown kind: ${kind}` };
        }

        // ========== FIND ==========
        if (action === "find") {
          const { query, tags } = args;

          if (!query) {
            return { error: "query is required for find action" };
          }

          // Create conversations client for parallel search
          const conversationsClient = conversationsIntegration.createClient();

          // Search Obsidian memories and past conversations in parallel
          const [searchResults, conversationResults] = await Promise.all([
            client.searchNotes(query, 150),
            Promise.resolve(
              conversationsClient.search(query, {
                excludeSessionId: context.sessionId,
                limit: 5,
                contextWindow: 3,
              })
            ),
          ]);

          // Filter Obsidian results to memory folder only
          const memoryResults = searchResults.filter((r) =>
            r.filename.startsWith(MEMORY_ROOT + "/")
          );

          // Read full content for top Obsidian results
          const memories: Memory[] = [];
          const limit = 10;

          for (const result of memoryResults.slice(0, limit * 2)) {
            const note = await client.readNote(result.filename);
            if (!note) continue;

            const { frontmatter, body } = parseFrontmatter(note.content);

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
            });

            if (memories.length >= limit) break;
          }

          // Format conversation results
          const conversations = formatConversationResults(conversationResults);

          return {
            memories,
            conversations,
            query,
          };
        }

        // ========== UPDATE ==========
        if (action === "update") {
          const { path, append, newTags, newAliases } = args;

          if (!path) {
            return { error: "path is required for update action" };
          }

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
          let updatedTags = frontmatter.tags || [];
          if (newTags && newTags.length > 0) {
            updatedTags = [...new Set([...updatedTags, ...newTags])];
          }

          // Update aliases
          let updatedAliases = frontmatter.aliases || [];
          if (newAliases && newAliases.length > 0) {
            updatedAliases = [...new Set([...updatedAliases, ...newAliases])];
          }

          // Update content
          let newBody = body;
          if (append) {
            const date = new Date().toISOString().split("T")[0];
            newBody = `${body}\n\n---\n**Update (${date}):** ${append}`;
          }

          // Regenerate frontmatter
          const newFrontmatter = generateFrontmatter(
            frontmatter.kind || "entity",
            updatedTags,
            {
              aliases: updatedAliases.length > 0 ? updatedAliases : undefined,
              entity: frontmatter.entity,
              updates: frontmatter.updates,
            }
          );
          // Preserve original created date
          const finalFrontmatter = newFrontmatter.replace(
            /created: .*/,
            `created: ${frontmatter.created}`
          );

          const fullContent = `${finalFrontmatter}\n\n${newBody}`;
          await client.writeNote(normalizedPath, fullContent);

          return {
            success: true,
            path: note.path,
            tags: updatedTags,
            aliases: updatedAliases,
            message: `Memory updated: "${note.name}"`,
          };
        }

        return { error: `Unknown action: ${action}` };
      },
    }),
  ],
});
