/**
 * Entity Storage Service
 *
 * Handles all file operations for knowledge entities.
 * Abstracts YAML serialization and filesystem access.
 */

import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";
import type { Entity } from "./types";
import { getIndexManager } from "./index-manager";

const ENTITIES_SUBDIR = "entities";

export interface EntityStorage {
  // Read operations
  exists(id: string): boolean;
  get(id: string): Promise<Entity | null>;
  getAll(): Promise<Entity[]>;
  getByType(type: string): Promise<Entity[]>;

  // Write operations
  save(entity: Entity): Promise<void>;
  delete(id: string): Promise<boolean>;
}

/**
 * Create entity storage service
 */
export function createEntityStorage(): EntityStorage {
  const fs = createFilesystemService(ENTITIES_SUBDIR);
  const indexManager = getIndexManager();

  return {
    /**
     * Check if entity exists
     */
    exists(id: string): boolean {
      return fs.exists(`${id}.yaml`);
    },

    /**
     * Get a single entity by ID
     */
    async get(id: string): Promise<Entity | null> {
      const filename = `${id}.yaml`;
      if (!fs.exists(filename)) {
        return null;
      }

      try {
        const content = await fs.readFile(filename);
        const entity = yaml.parse(content) as Entity;
        // Ensure arrays exist
        if (!entity.tags) entity.tags = [];
        if (!entity.relations) entity.relations = [];
        if (!entity.aliases) entity.aliases = [];
        return entity;
      } catch {
        return null;
      }
    },

    /**
     * Get all entities
     */
    async getAll(): Promise<Entity[]> {
      const files = await fs.listFiles("", /\.yaml$/);
      const entities: Entity[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file);
          const entity = yaml.parse(content) as Entity;
          if (!entity.tags) entity.tags = [];
          if (!entity.relations) entity.relations = [];
          if (!entity.aliases) entity.aliases = [];
          entities.push(entity);
        } catch {
          // Skip invalid files
        }
      }

      return entities;
    },

    /**
     * Get entities by type
     */
    async getByType(type: string): Promise<Entity[]> {
      const all = await this.getAll();
      return all.filter((e) => e.type === type);
    },

    /**
     * Save an entity (create or update)
     */
    async save(entity: Entity): Promise<void> {
      await fs.writeFile(`${entity.id}.yaml`, yaml.stringify(entity));
      await indexManager.updateEntityTags(entity.id, entity.tags);
      if (entity.relations.length > 0) {
        await indexManager.updateEntityRelations(entity.id, entity.relations);
      }
    },

    /**
     * Delete an entity
     */
    async delete(id: string): Promise<boolean> {
      const filename = `${id}.yaml`;
      if (!fs.exists(filename)) {
        return false;
      }

      await fs.deleteFile(filename);
      await indexManager.removeEntity(id);
      return true;
    },
  };
}

// Singleton instance
let storageInstance: EntityStorage | null = null;

export function getEntityStorage(): EntityStorage {
  if (!storageInstance) {
    storageInstance = createEntityStorage();
  }
  return storageInstance;
}
