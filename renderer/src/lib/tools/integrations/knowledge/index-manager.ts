/**
 * Graph Index Manager - Unified Entity Model
 *
 * Maintains relationships between entities through tags and direct relations.
 * All data (facts, notes, people, places, etc.) are entities in a unified graph.
 */

import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";
import type { GraphIndex, GraphStats, RelatedEntity, FindRelatedResult } from "./types";

const INDEX_FILE = "index.yaml";

function createEmptyIndex(): GraphIndex {
  return {
    tagIndex: {},
    relations: {},
    cooccurrence: {},
    updatedAt: new Date().toISOString(),
  };
}

class IndexManager {
  private fs = createFilesystemService(""); // Root of memory folder
  private index: GraphIndex | null = null;

  /**
   * Load the index from disk or create empty
   */
  async getIndex(): Promise<GraphIndex> {
    if (this.index) return this.index;

    if (!this.fs.exists(INDEX_FILE)) {
      this.index = createEmptyIndex();
      await this.saveIndex();
      return this.index;
    }

    const content = await this.fs.readFile(INDEX_FILE);
    const parsed = yaml.parse(content);

    // Migration: handle old format with items/entityIndex
    if (parsed.items || parsed.entityIndex) {
      this.index = createEmptyIndex();
      await this.saveIndex();
      return this.index;
    }

    this.index = parsed as GraphIndex;
    return this.index;
  }

  /**
   * Save the index to disk
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;
    this.index.updatedAt = new Date().toISOString();
    await this.fs.writeFile(INDEX_FILE, yaml.stringify(this.index));
  }

  /**
   * Update index for an entity's tags
   */
  async updateEntityTags(entityId: string, tags: string[]): Promise<void> {
    const index = await this.getIndex();

    // Remove from old tag entries
    for (const [tag, entities] of Object.entries(index.tagIndex)) {
      const idx = entities.indexOf(entityId);
      if (idx >= 0) {
        entities.splice(idx, 1);
        if (entities.length === 0) {
          delete index.tagIndex[tag];
        }
      }
    }

    // Add to new tag entries
    for (const tag of tags) {
      if (!index.tagIndex[tag]) {
        index.tagIndex[tag] = [];
      }
      if (!index.tagIndex[tag].includes(entityId)) {
        index.tagIndex[tag].push(entityId);
      }
    }

    await this.saveIndex();
  }

  /**
   * Update relations between entities (bidirectional)
   */
  async updateEntityRelations(entityId: string, relatedIds: string[]): Promise<void> {
    const index = await this.getIndex();

    // Get old relations to clean up
    const oldRelations = index.relations[entityId] || [];

    // Remove old reverse relations
    for (const oldId of oldRelations) {
      if (index.relations[oldId]) {
        const idx = index.relations[oldId].indexOf(entityId);
        if (idx >= 0) {
          index.relations[oldId].splice(idx, 1);
          if (index.relations[oldId].length === 0) {
            delete index.relations[oldId];
          }
        }
      }
    }

    // Set new relations
    if (relatedIds.length > 0) {
      index.relations[entityId] = [...relatedIds];

      // Add reverse relations
      for (const relatedId of relatedIds) {
        if (!index.relations[relatedId]) {
          index.relations[relatedId] = [];
        }
        if (!index.relations[relatedId].includes(entityId)) {
          index.relations[relatedId].push(entityId);
        }
      }

      // Update cooccurrence
      this.updateCooccurrence(entityId, relatedIds, index);
    } else {
      delete index.relations[entityId];
    }

    await this.saveIndex();
  }

  /**
   * Update cooccurrence counts
   */
  private updateCooccurrence(entityId: string, relatedIds: string[], index: GraphIndex): void {
    for (const relatedId of relatedIds) {
      // Update entityId -> relatedId
      if (!index.cooccurrence[entityId]) {
        index.cooccurrence[entityId] = [];
      }
      const entry1 = index.cooccurrence[entityId].find((c) => c.entity === relatedId);
      if (entry1) {
        entry1.count++;
      } else {
        index.cooccurrence[entityId].push({ entity: relatedId, count: 1 });
      }

      // Update relatedId -> entityId
      if (!index.cooccurrence[relatedId]) {
        index.cooccurrence[relatedId] = [];
      }
      const entry2 = index.cooccurrence[relatedId].find((c) => c.entity === entityId);
      if (entry2) {
        entry2.count++;
      } else {
        index.cooccurrence[relatedId].push({ entity: entityId, count: 1 });
      }
    }
  }

  /**
   * Remove an entity from the index completely
   */
  async removeEntity(entityId: string): Promise<void> {
    const index = await this.getIndex();

    // Remove from tag index
    for (const entities of Object.values(index.tagIndex)) {
      const idx = entities.indexOf(entityId);
      if (idx >= 0) {
        entities.splice(idx, 1);
      }
    }
    // Clean up empty tag entries
    for (const [tag, entities] of Object.entries(index.tagIndex)) {
      if (entities.length === 0) {
        delete index.tagIndex[tag];
      }
    }

    // Remove from relations (both directions)
    const relatedIds = index.relations[entityId] || [];
    for (const relatedId of relatedIds) {
      if (index.relations[relatedId]) {
        const idx = index.relations[relatedId].indexOf(entityId);
        if (idx >= 0) {
          index.relations[relatedId].splice(idx, 1);
          if (index.relations[relatedId].length === 0) {
            delete index.relations[relatedId];
          }
        }
      }
    }
    delete index.relations[entityId];

    // Remove from cooccurrence
    delete index.cooccurrence[entityId];
    for (const entries of Object.values(index.cooccurrence)) {
      const idx = entries.findIndex((e) => e.entity === entityId);
      if (idx >= 0) {
        entries.splice(idx, 1);
      }
    }

    await this.saveIndex();
  }

  /**
   * Get entities by tag
   */
  async getEntitiesByTag(tag: string): Promise<string[]> {
    const index = await this.getIndex();
    return index.tagIndex[tag] || [];
  }

  /**
   * Get directly related entities
   */
  async getRelatedEntities(entityId: string): Promise<string[]> {
    const index = await this.getIndex();
    return index.relations[entityId] || [];
  }

  /**
   * Find all related entities with details
   */
  async findRelated(
    entityId: string,
    entityLoader: (id: string) => Promise<{ name: string; type: string; content?: string } | null>
  ): Promise<FindRelatedResult> {
    const index = await this.getIndex();
    const relatedIds = new Set<string>();

    // Direct relations
    const directRelations = index.relations[entityId] || [];
    directRelations.forEach((id) => relatedIds.add(id));

    // Build result with loaded entity data
    const entities: RelatedEntity[] = [];
    for (const id of relatedIds) {
      const entity = await entityLoader(id);
      if (entity) {
        const cooccurrenceEntry = (index.cooccurrence[entityId] || []).find(
          (c) => c.entity === id
        );
        entities.push({
          id,
          name: entity.name,
          type: entity.type,
          connectionCount: cooccurrenceEntry?.count || 1,
          contentPreview: entity.content?.substring(0, 100),
        });
      }
    }

    // Sort by connection count
    entities.sort((a, b) => b.connectionCount - a.connectionCount);

    return { entities };
  }

  /**
   * Get entities sharing a tag
   */
  async findByTag(
    tag: string,
    entityLoader: (id: string) => Promise<{ name: string; type: string; content?: string } | null>
  ): Promise<FindRelatedResult> {
    const index = await this.getIndex();
    const entityIds = index.tagIndex[tag] || [];

    const entities: RelatedEntity[] = [];
    for (const id of entityIds) {
      const entity = await entityLoader(id);
      if (entity) {
        entities.push({
          id,
          name: entity.name,
          type: entity.type,
          connectionCount: (index.relations[id] || []).length,
          contentPreview: entity.content?.substring(0, 100),
        });
      }
    }

    return { entities };
  }

  /**
   * Get graph statistics
   */
  async getStats(
    entityLoader: () => Promise<Array<{ id: string; type: string; tags: string[]; name: string }>>
  ): Promise<GraphStats> {
    const index = await this.getIndex();
    const entities = await entityLoader();

    // Count by type
    const byType: Record<string, number> = {};
    let untagged = 0;

    for (const entity of entities) {
      byType[entity.type] = (byType[entity.type] || 0) + 1;
      if (entity.tags.length === 0) {
        untagged++;
      }
    }

    // Tag counts
    const tagCounts = Object.entries(index.tagIndex)
      .map(([tag, ids]) => ({ tag, count: ids.length }))
      .sort((a, b) => b.count - a.count);

    // Entity connection counts (by relations)
    const entityCounts = entities
      .map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        count: (index.relations[entity.id] || []).length,
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      totalEntities: entities.length,
      byType,
      totalTags: Object.keys(index.tagIndex).length,
      topTags: tagCounts.slice(0, 10),
      topEntities: entityCounts.slice(0, 10),
      untaggedEntities: untagged,
    };
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.index = null;
  }
}

// Singleton
let instance: IndexManager | null = null;

export function getIndexManager(): IndexManager {
  if (!instance) {
    instance = new IndexManager();
  }
  return instance;
}

export { IndexManager };
