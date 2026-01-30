/**
 * Knowledge Tools - Facts & People
 *
 * Two entity types:
 * - Facts: Key-value memories (preferences, context, details)
 * - People: Named individuals with aliases and descriptions
 */

import { z } from "zod";
import { defineTool } from "../../types";
import type { ToolDefinition } from "../../types";
import type { Entity } from "./types";
import { getEntityStorage } from "./storage";
import { getKnowledgeConfigService } from "./config.service";
import { searchEntities, nameToId, findDuplicateEntity } from "./matching";
import { validateTags } from "./validation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

const storage = getEntityStorage();
const configService = getKnowledgeConfigService();

/**
 * Normalize tags using config validation
 */
async function normalizeTags(tags: string[]): Promise<string[]> {
  if (!tags || tags.length === 0) return [];
  const config = await configService.getConfig();
  const validation = validateTags(tags, config);
  return validation.valid ? validation.normalizedTags : [];
}

/**
 * Create a new entity with timestamps
 */
function createEntity(
  id: string,
  type: string,
  name: string,
  data: Partial<Entity> = {}
): Entity {
  const now = new Date().toISOString();
  return {
    id,
    type,
    name,
    aliases: data.aliases || [],
    description: data.description,
    content: data.content,
    tags: data.tags || [],
    relations: data.relations || [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create knowledge tools
 */
export function createKnowledgeTools(): AnyToolDefinition[] {
  return [
    // =========================================================================
    // FACT TOOLS
    // =========================================================================

    defineTool({
      name: "save_fact",
      description:
        "Save a memory/fact. Use for preferences, context, details, or any information worth remembering.",

      inputSchema: z.object({
        key: z
          .string()
          .regex(/^[a-z0-9_-]+$/i, "Key must be alphanumeric with underscores/dashes")
          .describe("Unique key (e.g., 'user_name', 'favorite_color')"),
        content: z.string().describe("The information to remember"),
        tags: z.array(z.string()).optional().default([]).describe("Optional tags"),
        relations: z.array(z.string()).optional().default([]).describe("Related entity IDs"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ key, content, tags, relations }) => {
        const id = `fact-${key}`;
        const normalizedTags = await normalizeTags(tags);

        const existing = await storage.get(id);
        const entity = existing
          ? { ...existing, content, tags: normalizedTags, relations: relations || existing.relations, updatedAt: new Date().toISOString() }
          : createEntity(id, "fact", key, { content, tags: normalizedTags, relations });

        await storage.save(entity);
        return { success: true, id, message: `Fact "${key}" saved.` };
      },
    }),

    defineTool({
      name: "recall_fact",
      description: "Retrieve a specific fact/memory by its key.",

      inputSchema: z.object({
        key: z.string().describe("The fact key to retrieve"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ key }) => {
        const entity = await storage.get(`fact-${key}`);
        if (!entity) {
          return { success: false, error: `Fact "${key}" not found.` };
        }

        return {
          success: true,
          fact: {
            key: entity.name,
            content: entity.content,
            tags: entity.tags,
            relations: entity.relations,
            updatedAt: entity.updatedAt,
          },
        };
      },
    }),

    defineTool({
      name: "search_facts",
      description: "Search through saved facts/memories.",

      inputSchema: z.object({
        query: z.string().optional().describe("Text to search for"),
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().default(20).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ query, tag, limit }) => {
        let facts = await storage.getByType("fact");

        if (tag) {
          facts = facts.filter((f) => f.tags.includes(tag));
        }

        if (query) {
          const q = query.toLowerCase();
          facts = facts.filter(
            (f) => f.content?.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
          );
        }

        facts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return {
          count: facts.length,
          facts: facts.slice(0, limit).map((f) => ({
            key: f.name,
            content: f.content,
            tags: f.tags,
            updatedAt: f.updatedAt,
          })),
        };
      },
    }),

    defineTool({
      name: "update_fact",
      description: "Update an existing fact. Use to append tags/relations or modify content.",

      inputSchema: z.object({
        key: z.string().describe("The fact key to update"),
        content: z.string().optional().describe("New content (replaces existing)"),
        addTags: z.array(z.string()).optional().describe("Tags to add"),
        addRelations: z.array(z.string()).optional().describe("Relations to add"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ key, content, addTags, addRelations }) => {
        const entity = await storage.get(`fact-${key}`);
        if (!entity) {
          return { success: false, error: `Fact "${key}" not found.` };
        }

        if (content !== undefined) {
          entity.content = content;
        }

        if (addTags && addTags.length > 0) {
          const normalizedTags = await normalizeTags(addTags);
          const existingTags = new Set(entity.tags);
          for (const tag of normalizedTags) {
            if (!existingTags.has(tag)) {
              entity.tags.push(tag);
            }
          }
        }

        if (addRelations) {
          const existingRels = new Set(entity.relations);
          for (const rel of addRelations) {
            if (!existingRels.has(rel)) {
              entity.relations.push(rel);
            }
          }
        }

        entity.updatedAt = new Date().toISOString();
        await storage.save(entity);

        return { success: true, message: `Fact "${key}" updated.` };
      },
    }),

    defineTool({
      name: "delete_fact",
      description: "Delete a fact/memory.",

      inputSchema: z.object({
        key: z.string().describe("The fact key to delete"),
      }),

      source: { type: "integration", integrationId: "knowledge" },
      requiresApproval: true,

      execute: async ({ key }) => {
        const deleted = await storage.delete(`fact-${key}`);
        if (!deleted) {
          return { success: false, error: `Fact "${key}" not found.` };
        }
        return { success: true, message: `Fact "${key}" deleted.` };
      },
    }),

    // =========================================================================
    // PEOPLE TOOLS
    // =========================================================================

    defineTool({
      name: "remember_person",
      description: "Remember a person. Use when you learn about someone the user knows.",

      inputSchema: z.object({
        name: z.string().describe("Person's full name"),
        aliases: z.array(z.string()).optional().default([]).describe("Nicknames, alternative names"),
        description: z.string().optional().describe("Who they are, relationship to user"),
        tags: z.array(z.string()).optional().default([]).describe("Optional tags"),
        relations: z.array(z.string()).optional().default([]).describe("Related entity IDs"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ name, aliases, description, tags, relations }) => {
        const allEntities = await storage.getAll();
        const duplicate = findDuplicateEntity(name, allEntities, 0.9);

        if (duplicate) {
          return {
            success: false,
            error: `Person already exists: "${duplicate.name}" (${duplicate.id})`,
            existingPerson: { id: duplicate.id, name: duplicate.name },
          };
        }

        const id = `person-${nameToId(name)}`;
        if (storage.exists(id)) {
          return { success: false, error: `Person ID "${id}" already exists.` };
        }

        const normalizedTags = await normalizeTags(tags);
        const entity = createEntity(id, "person", name, {
          aliases,
          description,
          tags: normalizedTags,
          relations,
        });

        await storage.save(entity);
        return { success: true, id, message: `Remembered "${name}".` };
      },
    }),

    defineTool({
      name: "get_person",
      description: "Get details about a remembered person.",

      inputSchema: z.object({
        id: z.string().describe("Person ID (e.g., 'person-john-doe')"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ id }) => {
        const fullId = id.startsWith("person-") ? id : `person-${id}`;
        const entity = await storage.get(fullId);

        if (!entity) {
          return { success: false, error: `Person "${id}" not found.` };
        }

        return {
          success: true,
          person: {
            id: entity.id,
            name: entity.name,
            aliases: entity.aliases,
            description: entity.description,
            tags: entity.tags,
            relations: entity.relations,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          },
        };
      },
    }),

    defineTool({
      name: "update_person",
      description: "Update information about a person.",

      inputSchema: z.object({
        id: z.string().describe("Person ID"),
        addAliases: z.array(z.string()).optional().describe("Aliases to add"),
        description: z.string().optional().describe("New description"),
        addTags: z.array(z.string()).optional().describe("Tags to add"),
        addRelations: z.array(z.string()).optional().describe("Relations to add"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ id, addAliases, description, addTags, addRelations }) => {
        const fullId = id.startsWith("person-") ? id : `person-${id}`;
        const entity = await storage.get(fullId);

        if (!entity) {
          return { success: false, error: `Person "${id}" not found.` };
        }

        if (addAliases) {
          const existing = new Set(entity.aliases.map((a) => a.toLowerCase()));
          for (const alias of addAliases) {
            if (!existing.has(alias.toLowerCase())) {
              entity.aliases.push(alias);
            }
          }
        }

        if (description !== undefined) {
          entity.description = description;
        }

        if (addTags && addTags.length > 0) {
          const normalizedTags = await normalizeTags(addTags);
          const existingTags = new Set(entity.tags);
          for (const tag of normalizedTags) {
            if (!existingTags.has(tag)) {
              entity.tags.push(tag);
            }
          }
        }

        if (addRelations) {
          const existingRels = new Set(entity.relations);
          for (const rel of addRelations) {
            if (!existingRels.has(rel)) {
              entity.relations.push(rel);
            }
          }
        }

        entity.updatedAt = new Date().toISOString();
        await storage.save(entity);

        return { success: true, message: `Updated "${entity.name}".` };
      },
    }),

    defineTool({
      name: "search_people",
      description: "Search for remembered people by name or alias.",

      inputSchema: z.object({
        query: z.string().describe("Name to search for"),
        limit: z.number().optional().default(10).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ query, limit }) => {
        const people = await storage.getByType("person");
        const result = searchEntities(query, people, { limit, minScore: 0.3 });

        return {
          count: result.matches.length,
          people: result.matches.map((m) => ({
            id: m.id,
            name: m.name,
            aliases: m.aliases,
            score: Math.round(m.score * 100) / 100,
          })),
        };
      },
    }),

    defineTool({
      name: "list_people",
      description: "List all remembered people.",

      inputSchema: z.object({
        limit: z.number().optional().default(50).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ limit }) => {
        const people = await storage.getByType("person");
        people.sort((a, b) => a.name.localeCompare(b.name));

        return {
          count: people.length,
          people: people.slice(0, limit).map((p) => ({
            id: p.id,
            name: p.name,
            aliases: p.aliases,
            description: p.description,
          })),
        };
      },
    }),

    defineTool({
      name: "forget_person",
      description: "Remove a person from memory.",

      inputSchema: z.object({
        id: z.string().describe("Person ID to delete"),
      }),

      source: { type: "integration", integrationId: "knowledge" },
      requiresApproval: true,

      execute: async ({ id }) => {
        const fullId = id.startsWith("person-") ? id : `person-${id}`;
        const entity = await storage.get(fullId);

        if (!entity) {
          return { success: false, error: `Person "${id}" not found.` };
        }

        await storage.delete(fullId);
        return { success: true, message: `Forgot "${entity.name}".` };
      },
    }),

    // =========================================================================
    // GRAPH TOOLS
    // =========================================================================

    defineTool({
      name: "find_related",
      description: "Find entities related to a person or fact.",

      inputSchema: z.object({
        entityId: z.string().describe("Entity ID to find relations for"),
        limit: z.number().optional().default(20).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ entityId, limit }) => {
        const { getIndexManager } = await import("./index-manager");
        const indexManager = getIndexManager();

        const entityLoader = async (id: string) => {
          const e = await storage.get(id);
          if (!e) return null;
          return { name: e.name, type: e.type, content: e.content };
        };

        const result = await indexManager.findRelated(entityId, entityLoader);
        return { success: true, related: result.entities.slice(0, limit) };
      },
    }),

    defineTool({
      name: "get_memory_stats",
      description: "Get statistics about stored memories.",

      inputSchema: z.object({}),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async () => {
        const [facts, people] = await Promise.all([
          storage.getByType("fact"),
          storage.getByType("person"),
        ]);

        return {
          totalFacts: facts.length,
          totalPeople: people.length,
          recentFacts: facts
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 5)
            .map((f) => ({ key: f.name, updatedAt: f.updatedAt })),
        };
      },
    }),
  ];
}
