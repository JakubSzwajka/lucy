import { z } from "zod";
import { defineIntegration } from "../types";
import { createKnowledgeTools } from "./tools";

export const knowledgeIntegration = defineIntegration({
  id: "knowledge",
  name: "Knowledge Graph",
  description:
    "Manage tags, entities, and relationships between memories and notes",
  iconUrl: "/icons/knowledge.svg",

  // Knowledge graph doesn't need external credentials - it's local
  credentialsSchema: z.object({}),

  // Optional configuration
  configSchema: z.object({}),

  createTools: () => createKnowledgeTools(),
});

// Re-export types and services for external use
export type {
  Entity,
  EntityType,
  EntityMatch,
  EntitySearchResult,
  TagCategory,
  TagValue,
  TagValidationResult,
  KnowledgeConfig,
  GraphIndex,
  GraphStats,
  FindRelatedResult,
  RelatedEntity,
} from "./types";

export { getKnowledgeConfigService } from "./config.service";
export { getIndexManager } from "./index-manager";
export { searchEntities, nameToId, findDuplicateEntity } from "./matching";
export { validateTags, getAllValidTags } from "./validation";
