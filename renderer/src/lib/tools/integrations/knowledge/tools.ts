/**
 * Knowledge Graph Tools - Unified Entity Model
 *
 * Everything is an entity:
 * - Facts: Quick key-value information (type: "fact")
 * - Notes: Longer-form content (type: "note")
 * - People, Places, Organizations, etc.: Named entities for linking
 *
 * All entities can have tags and relations to other entities.
 */

import { z } from "zod";
import { defineTool } from "../../types";
import type { ToolDefinition } from "../../types";
import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";
import type { Entity, EntityType, TagCategory } from "./types";
import { CONTENT_ENTITY_TYPES } from "./types";
import { getKnowledgeConfigService } from "./config.service";
import { getIndexManager } from "./index-manager";
import { searchEntities, nameToId, findDuplicateEntity } from "./matching";
import { validateTags } from "./validation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

const ENTITIES_SUBDIR = "entities";

/**
 * Load all entities from filesystem
 */
async function loadAllEntities(
  fs: ReturnType<typeof createFilesystemService>
): Promise<Entity[]> {
  const files = await fs.listFiles("", /\.yaml$/);
  const entities: Entity[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file);
      const entity = yaml.parse(content) as Entity;
      // Ensure arrays exist (migration from old format)
      if (!entity.tags) entity.tags = [];
      if (!entity.relations) entity.relations = [];
      if (!entity.aliases) entity.aliases = [];
      entities.push(entity);
    } catch {
      // Skip invalid files
    }
  }

  return entities;
}

/**
 * Save an entity and update index
 */
async function saveEntity(
  fs: ReturnType<typeof createFilesystemService>,
  entity: Entity,
  indexManager: ReturnType<typeof getIndexManager>
): Promise<void> {
  await fs.writeFile(`${entity.id}.yaml`, yaml.stringify(entity));
  await indexManager.updateEntityTags(entity.id, entity.tags);
  if (entity.relations.length > 0) {
    await indexManager.updateEntityRelations(entity.id, entity.relations);
  }
}

/**
 * Create knowledge graph tools
 */
export function createKnowledgeTools(): AnyToolDefinition[] {
  const fs = createFilesystemService(ENTITIES_SUBDIR);
  const configService = getKnowledgeConfigService();
  const indexManager = getIndexManager();

  return [
    // =========================================================================
    // FACT TOOLS (Quick key-value information)
    // =========================================================================

    defineTool({
      name: "save_fact",
      description:
        "Save a piece of information as a fact. Facts are quick, key-value style pieces of information like preferences, context, or important details.",

      inputSchema: z.object({
        key: z
          .string()
          .regex(/^[a-z0-9_-]+$/i, "Key must be alphanumeric with underscores/dashes")
          .describe("Unique key for this fact (e.g., 'user_name', 'project_deadline')"),
        content: z.string().describe("The information to save"),
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Tags for categorization (e.g., 'topic:personal', 'project:lucy')"),
        relations: z
          .array(z.string())
          .optional()
          .default([])
          .describe("IDs of related entities (e.g., person or project IDs)"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ key, content, tags, relations }) => {
        const id = `fact-${key}`;
        const now = new Date().toISOString();

        // Validate tags
        let normalizedTags: string[] = [];
        if (tags && tags.length > 0) {
          const config = await configService.getConfig();
          const validation = validateTags(tags, config);
          if (!validation.valid) {
            return {
              success: false,
              error: "Invalid tags",
              validationErrors: validation.errors,
            };
          }
          normalizedTags = validation.normalizedTags;
        }

        // Check if exists (update) or new (create)
        let entity: Entity;
        if (fs.exists(`${id}.yaml`)) {
          const existing = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;
          entity = {
            ...existing,
            content,
            tags: normalizedTags,
            relations: relations || existing.relations || [],
            updatedAt: now,
          };
        } else {
          entity = {
            id,
            type: "fact",
            name: key,
            aliases: [],
            content,
            tags: normalizedTags,
            relations: relations || [],
            createdAt: now,
            updatedAt: now,
          };
        }

        await saveEntity(fs, entity, indexManager);

        return {
          success: true,
          id,
          message: `Fact "${key}" saved.`,
        };
      },
    }),

    defineTool({
      name: "recall_fact",
      description: "Retrieve a specific fact by its key.",

      inputSchema: z.object({
        key: z.string().describe("The fact key to retrieve"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ key }) => {
        const id = `fact-${key}`;
        const filename = `${id}.yaml`;

        if (!fs.exists(filename)) {
          return {
            success: false,
            error: `Fact "${key}" not found.`,
          };
        }

        const entity = yaml.parse(await fs.readFile(filename)) as Entity;

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
      description: "Search through saved facts by content or tags.",

      inputSchema: z.object({
        query: z.string().optional().describe("Text to search in fact content"),
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().default(20).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ query, tag, limit }) => {
        const entities = await loadAllEntities(fs);
        let facts = entities.filter((e) => e.type === "fact");

        if (tag) {
          facts = facts.filter((f) => f.tags.includes(tag));
        }

        if (query) {
          const lowerQuery = query.toLowerCase();
          facts = facts.filter(
            (f) =>
              f.content?.toLowerCase().includes(lowerQuery) ||
              f.name.toLowerCase().includes(lowerQuery)
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
      name: "delete_fact",
      description: "Delete a fact by its key.",

      inputSchema: z.object({
        key: z.string().describe("The fact key to delete"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      requiresApproval: true,

      execute: async ({ key }) => {
        const id = `fact-${key}`;
        const filename = `${id}.yaml`;

        if (!fs.exists(filename)) {
          return { success: false, error: `Fact "${key}" not found.` };
        }

        await fs.deleteFile(filename);
        await indexManager.removeEntity(id);

        return { success: true, message: `Fact "${key}" deleted.` };
      },
    }),

    // =========================================================================
    // NOTE TOOLS (Longer-form content)
    // =========================================================================

    defineTool({
      name: "save_note",
      description:
        "Save a note for longer-form content like documentation, summaries, or drafts. Notes support markdown.",

      inputSchema: z.object({
        title: z.string().min(1).describe("Title of the note"),
        content: z.string().describe("Note content (supports markdown)"),
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Tags for categorization"),
        relations: z
          .array(z.string())
          .optional()
          .default([])
          .describe("IDs of related entities"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ title, content, tags, relations }) => {
        const baseId = nameToId(title);
        const id = `note-${baseId}`;
        const now = new Date().toISOString();

        // Validate tags
        let normalizedTags: string[] = [];
        if (tags && tags.length > 0) {
          const config = await configService.getConfig();
          const validation = validateTags(tags, config);
          if (!validation.valid) {
            return {
              success: false,
              error: "Invalid tags",
              validationErrors: validation.errors,
            };
          }
          normalizedTags = validation.normalizedTags;
        }

        // Check if exists (update) or new (create)
        let entity: Entity;
        if (fs.exists(`${id}.yaml`)) {
          const existing = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;
          entity = {
            ...existing,
            name: title,
            content,
            tags: normalizedTags,
            relations: relations || existing.relations || [],
            updatedAt: now,
          };
        } else {
          entity = {
            id,
            type: "note",
            name: title,
            aliases: [],
            content,
            tags: normalizedTags,
            relations: relations || [],
            createdAt: now,
            updatedAt: now,
          };
        }

        await saveEntity(fs, entity, indexManager);

        return {
          success: true,
          id,
          message: `Note "${title}" saved.`,
        };
      },
    }),

    defineTool({
      name: "read_note",
      description: "Read a note by its ID or search by title.",

      inputSchema: z.object({
        id: z.string().describe("The note ID (e.g., 'note-meeting-notes')"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ id }) => {
        // Handle both "note-xxx" and just "xxx" formats
        const fullId = id.startsWith("note-") ? id : `note-${id}`;
        const filename = `${fullId}.yaml`;

        if (!fs.exists(filename)) {
          return { success: false, error: `Note "${id}" not found.` };
        }

        const entity = yaml.parse(await fs.readFile(filename)) as Entity;

        return {
          success: true,
          note: {
            id: entity.id,
            title: entity.name,
            content: entity.content,
            tags: entity.tags,
            relations: entity.relations,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          },
        };
      },
    }),

    defineTool({
      name: "search_notes",
      description: "Search notes by title or content.",

      inputSchema: z.object({
        query: z.string().optional().describe("Text to search in title and content"),
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().default(20).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ query, tag, limit }) => {
        const entities = await loadAllEntities(fs);
        let notes = entities.filter((e) => e.type === "note");

        if (tag) {
          notes = notes.filter((n) => n.tags.includes(tag));
        }

        if (query) {
          const lowerQuery = query.toLowerCase();
          notes = notes.filter(
            (n) =>
              n.name.toLowerCase().includes(lowerQuery) ||
              n.content?.toLowerCase().includes(lowerQuery)
          );
        }

        notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return {
          count: notes.length,
          notes: notes.slice(0, limit).map((n) => ({
            id: n.id,
            title: n.name,
            snippet: n.content?.substring(0, 150) + (n.content && n.content.length > 150 ? "..." : ""),
            tags: n.tags,
            updatedAt: n.updatedAt,
          })),
        };
      },
    }),

    defineTool({
      name: "list_notes",
      description: "List all notes with optional tag filter.",

      inputSchema: z.object({
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().default(50).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ tag, limit }) => {
        const entities = await loadAllEntities(fs);
        let notes = entities.filter((e) => e.type === "note");

        if (tag) {
          notes = notes.filter((n) => n.tags.includes(tag));
        }

        notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return {
          count: notes.length,
          notes: notes.slice(0, limit).map((n) => ({
            id: n.id,
            title: n.name,
            tags: n.tags,
            updatedAt: n.updatedAt,
          })),
        };
      },
    }),

    defineTool({
      name: "delete_note",
      description: "Delete a note by its ID.",

      inputSchema: z.object({
        id: z.string().describe("The note ID to delete"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      requiresApproval: true,

      execute: async ({ id }) => {
        const fullId = id.startsWith("note-") ? id : `note-${id}`;
        const filename = `${fullId}.yaml`;

        if (!fs.exists(filename)) {
          return { success: false, error: `Note "${id}" not found.` };
        }

        const entity = yaml.parse(await fs.readFile(filename)) as Entity;
        await fs.deleteFile(filename);
        await indexManager.removeEntity(fullId);

        return { success: true, message: `Note "${entity.name}" deleted.` };
      },
    }),

    // =========================================================================
    // NAMED ENTITY TOOLS (People, Places, Organizations, etc.)
    // =========================================================================

    defineTool({
      name: "search_entities",
      description:
        "Search for existing entities by name or alias. Use this before creating new entities to avoid duplicates.",

      inputSchema: z.object({
        query: z.string().describe("Search query"),
        type: z.string().optional().describe("Filter by type (person, place, organization, etc.)"),
        limit: z.number().optional().default(10).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ query, type, limit }) => {
        const entities = await loadAllEntities(fs);
        // Exclude content entities from entity search (facts/notes have their own search)
        const namedEntities = entities.filter((e) => !CONTENT_ENTITY_TYPES.includes(e.type));

        const result = searchEntities(query, namedEntities, {
          type,
          limit,
          minScore: 0.3,
        });

        return {
          count: result.matches.length,
          matches: result.matches.map((m) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            aliases: m.aliases,
            score: Math.round(m.score * 100) / 100,
          })),
        };
      },
    }),

    defineTool({
      name: "create_entity",
      description:
        "Create a named entity (person, place, organization, etc.). First use search_entities to check for duplicates.",

      inputSchema: z.object({
        type: z
          .string()
          .describe("Entity type: person, place, organization, project, concept, event"),
        name: z.string().describe("Primary name"),
        aliases: z.array(z.string()).optional().default([]).describe("Alternative names"),
        description: z.string().optional().describe("Brief description"),
        tags: z.array(z.string()).optional().default([]).describe("Tags"),
        relations: z.array(z.string()).optional().default([]).describe("Related entity IDs"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ type, name, aliases, description, tags, relations }) => {
        // Validate type
        if (CONTENT_ENTITY_TYPES.includes(type)) {
          return {
            success: false,
            error: `Use save_fact or save_note for content. "${type}" is a content type.`,
          };
        }

        const config = await configService.getConfig();
        const entityType = config.entityTypes.find(
          (t: EntityType) => t.id === type && t.enabled
        );

        if (!entityType) {
          const validTypes = config.entityTypes
            .filter((t: EntityType) => t.enabled && !CONTENT_ENTITY_TYPES.includes(t.id))
            .map((t: EntityType) => t.id);
          return {
            success: false,
            error: `Invalid type "${type}". Valid: ${validTypes.join(", ")}`,
          };
        }

        // Check for duplicates
        const entities = await loadAllEntities(fs);
        const duplicate = findDuplicateEntity(name, entities, 0.9);

        if (duplicate) {
          return {
            success: false,
            error: `Similar entity exists: "${duplicate.name}" (${duplicate.id})`,
            existingEntity: { id: duplicate.id, name: duplicate.name },
          };
        }

        // Validate tags
        let normalizedTags: string[] = [];
        if (tags && tags.length > 0) {
          const validation = validateTags(tags, config);
          if (!validation.valid) {
            return { success: false, error: "Invalid tags", validationErrors: validation.errors };
          }
          normalizedTags = validation.normalizedTags;
        }

        const id = nameToId(name);
        if (fs.exists(`${id}.yaml`)) {
          return { success: false, error: `Entity ID "${id}" already exists.` };
        }

        const now = new Date().toISOString();
        const entity: Entity = {
          id,
          type,
          name,
          aliases: aliases || [],
          description,
          tags: normalizedTags,
          relations: relations || [],
          createdAt: now,
          updatedAt: now,
        };

        await saveEntity(fs, entity, indexManager);

        return { success: true, id, message: `Entity "${name}" created.` };
      },
    }),

    defineTool({
      name: "get_entity",
      description: "Get full details of an entity by ID.",

      inputSchema: z.object({
        id: z.string().describe("Entity ID"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ id }) => {
        if (!fs.exists(`${id}.yaml`)) {
          return { success: false, error: `Entity "${id}" not found.` };
        }

        const entity = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;
        return { success: true, entity };
      },
    }),

    defineTool({
      name: "update_entity",
      description: "Update an entity's details.",

      inputSchema: z.object({
        id: z.string().describe("Entity ID"),
        addAliases: z.array(z.string()).optional().describe("Aliases to add"),
        description: z.string().optional().describe("New description"),
        addTags: z.array(z.string()).optional().describe("Tags to add"),
        addRelations: z.array(z.string()).optional().describe("Relations to add"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ id, addAliases, description, addTags, addRelations }) => {
        if (!fs.exists(`${id}.yaml`)) {
          return { success: false, error: `Entity "${id}" not found.` };
        }

        const entity = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;

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
          const config = await configService.getConfig();
          const validation = validateTags(addTags, config);
          if (validation.valid) {
            const existingTags = new Set(entity.tags);
            for (const tag of validation.normalizedTags) {
              if (!existingTags.has(tag)) {
                entity.tags.push(tag);
              }
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
        await saveEntity(fs, entity, indexManager);

        return { success: true, entity, message: `Entity "${entity.name}" updated.` };
      },
    }),

    defineTool({
      name: "list_entities",
      description: "List all named entities (not facts/notes).",

      inputSchema: z.object({
        type: z.string().optional().describe("Filter by type"),
        limit: z.number().optional().default(50).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ type, limit }) => {
        const entities = await loadAllEntities(fs);
        let filtered = entities.filter((e) => !CONTENT_ENTITY_TYPES.includes(e.type));

        if (type) {
          filtered = filtered.filter((e) => e.type === type);
        }

        filtered.sort((a, b) => a.name.localeCompare(b.name));

        return {
          count: filtered.length,
          entities: filtered.slice(0, limit).map((e) => ({
            id: e.id,
            type: e.type,
            name: e.name,
            aliases: e.aliases,
            description: e.description,
          })),
        };
      },
    }),

    defineTool({
      name: "delete_entity",
      description: "Delete an entity from the knowledge graph.",

      inputSchema: z.object({
        id: z.string().describe("Entity ID to delete"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      requiresApproval: true,

      execute: async ({ id }) => {
        if (!fs.exists(`${id}.yaml`)) {
          return { success: false, error: `Entity "${id}" not found.` };
        }

        const entity = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;
        await fs.deleteFile(`${id}.yaml`);
        await indexManager.removeEntity(id);

        return { success: true, message: `Entity "${entity.name}" deleted.` };
      },
    }),

    // =========================================================================
    // GRAPH QUERY TOOLS
    // =========================================================================

    defineTool({
      name: "get_knowledge_config",
      description: "Get tag vocabulary and entity types configuration.",

      inputSchema: z.object({}),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async () => {
        const config = await configService.getConfig();

        return {
          tagCategories: config.tagCategories.map((cat: TagCategory) => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            allowCustom: cat.allowCustom,
            values: cat.values.map((v) => v.id),
          })),
          entityTypes: config.entityTypes
            .filter((t: EntityType) => t.enabled)
            .map((t: EntityType) => ({ id: t.id, name: t.name })),
        };
      },
    }),

    defineTool({
      name: "find_related",
      description: "Find entities related to a given entity or tag.",

      inputSchema: z.object({
        entityId: z.string().optional().describe("Find entities related to this ID"),
        tag: z.string().optional().describe("Find entities with this tag"),
        limit: z.number().optional().default(20).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async ({ entityId, tag, limit }) => {
        if (!entityId && !tag) {
          return { success: false, error: "Provide entityId or tag." };
        }

        const entityLoader = async (id: string) => {
          if (!fs.exists(`${id}.yaml`)) return null;
          const e = yaml.parse(await fs.readFile(`${id}.yaml`)) as Entity;
          return { name: e.name, type: e.type, content: e.content };
        };

        if (entityId) {
          const result = await indexManager.findRelated(entityId, entityLoader);
          return { success: true, related: result.entities.slice(0, limit) };
        }

        if (tag) {
          const result = await indexManager.findByTag(tag, entityLoader);
          return { success: true, related: result.entities.slice(0, limit) };
        }

        return { success: false, error: "Unexpected error" };
      },
    }),

    defineTool({
      name: "get_graph_stats",
      description: "Get statistics about the knowledge graph.",

      inputSchema: z.object({}),

      source: { type: "integration", integrationId: "knowledge" },

      execute: async () => {
        const entityLoader = async () => {
          const entities = await loadAllEntities(fs);
          return entities.map((e) => ({
            id: e.id,
            type: e.type,
            tags: e.tags,
            name: e.name,
          }));
        };

        const stats = await indexManager.getStats(entityLoader);

        return {
          totalEntities: stats.totalEntities,
          byType: stats.byType,
          totalTags: stats.totalTags,
          topTags: stats.topTags,
          topEntities: stats.topEntities,
          untaggedEntities: stats.untaggedEntities,
        };
      },
    }),
  ];
}
