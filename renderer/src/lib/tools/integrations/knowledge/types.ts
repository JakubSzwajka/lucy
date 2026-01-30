// Tag system types
export interface TagValue {
  id: string;
  name: string;
}

export interface TagCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  allowCustom: boolean;
  values: TagValue[];
}

// Entity types
export interface EntityType {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

// Unified Entity - everything is an entity
export interface Entity {
  id: string;
  type: string;  // "fact", "note", "person", "place", "organization", etc.
  name: string;
  aliases: string[];
  description?: string;

  // Content (for facts and notes)
  content?: string;

  // Tags and relations
  tags: string[];
  relations: string[];  // IDs of related entities

  // Metadata
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Knowledge configuration
export interface KnowledgeConfig {
  tagCategories: TagCategory[];
  entityTypes: EntityType[];
}

// Graph index types - simplified for unified model
export interface GraphIndex {
  // Tag index: tag -> entity IDs
  tagIndex: Record<string, string[]>;

  // Entity relations: entity ID -> related entity IDs
  relations: Record<string, string[]>;

  // Co-occurrence tracking
  cooccurrence: Record<string, Array<{ entity: string; count: number }>>;

  updatedAt: string;
}

// Validation types
export interface TagValidationError {
  input: string;
  message: string;
  suggestions: string[];
}

export interface TagValidationResult {
  valid: boolean;
  normalizedTags: string[];
  errors: TagValidationError[];
}

// Entity match types
export interface EntityMatch {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  score: number;
}

export interface EntitySearchResult {
  matches: EntityMatch[];
}

// Graph query types
export interface RelatedEntity {
  id: string;
  name: string;
  type: string;
  connectionCount: number;
  // Preview for content entities
  contentPreview?: string;
}

export interface FindRelatedResult {
  entities: RelatedEntity[];
}

export interface GraphStats {
  totalEntities: number;
  byType: Record<string, number>;  // { fact: 10, note: 5, person: 3, ... }
  totalTags: number;
  topTags: Array<{ tag: string; count: number }>;
  topEntities: Array<{ id: string; name: string; type: string; count: number }>;
  untaggedEntities: number;
}

// Default configuration
export const DEFAULT_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "topic",
    name: "Topic",
    description: "Subject matter of the content",
    color: "#3B82F6",
    allowCustom: false,
    values: [
      { id: "finance", name: "Finance" },
      { id: "health", name: "Health" },
      { id: "technology", name: "Technology" },
      { id: "travel", name: "Travel" },
      { id: "personal", name: "Personal" },
      { id: "work", name: "Work" },
    ],
  },
  {
    id: "project",
    name: "Project",
    description: "Associated project",
    color: "#10B981",
    allowCustom: true,
    values: [],
  },
  {
    id: "status",
    name: "Status",
    description: "Current status",
    color: "#F59E0B",
    allowCustom: false,
    values: [
      { id: "active", name: "Active" },
      { id: "archived", name: "Archived" },
      { id: "todo", name: "To Do" },
      { id: "done", name: "Done" },
    ],
  },
  {
    id: "priority",
    name: "Priority",
    description: "Importance level",
    color: "#EF4444",
    allowCustom: false,
    values: [
      { id: "high", name: "High" },
      { id: "medium", name: "Medium" },
      { id: "low", name: "Low" },
    ],
  },
];

export const DEFAULT_ENTITY_TYPES: EntityType[] = [
  // Content types (for storing information)
  { id: "fact", name: "Fact", icon: "zap", enabled: true },
  { id: "note", name: "Note", icon: "file-text", enabled: true },

  // Named entity types (for extraction)
  { id: "person", name: "Person", icon: "user", enabled: true },
  { id: "place", name: "Place", icon: "map-pin", enabled: true },
  { id: "organization", name: "Organization", icon: "building", enabled: true },
  { id: "project", name: "Project", icon: "folder", enabled: true },
  { id: "concept", name: "Concept", icon: "lightbulb", enabled: true },
  { id: "event", name: "Event", icon: "calendar", enabled: true },
];

// Content entity types (have content field)
export const CONTENT_ENTITY_TYPES = ["fact", "note"];

// Named entity types (extracted from content, can be linked)
export const NAMED_ENTITY_TYPES = ["person", "place", "organization", "project", "concept", "event"];
