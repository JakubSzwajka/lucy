# Knowledge Graph System Specification

## Overview

A controlled knowledge management system that prevents tag fragmentation, extracts and deduplicates entities (people, places, organizations), and builds a graph of relationships between notes and memories.

## Goals

1. **Controlled Tags**: Define tag vocabulary in settings, validate AI-generated tags against it
2. **Entity Extraction**: Extract named entities (people, places, etc.) with deduplication
3. **Graph Relations**: Link notes/memories through shared tags and entities
4. **Queryable**: Find related content through graph traversal

---

## Architecture

### Storage Layout

```
memory/
├── config/
│   └── knowledge.yaml      # Tag vocabulary + entity type config
├── entities/
│   ├── {entity-id}.yaml    # One file per entity
│   └── ...
├── index.yaml              # Graph index (links between items)
├── memories/
│   └── {key}.yaml          # Existing memory files (enhanced)
└── notes/
    └── {filename}.yaml     # Existing note files (enhanced)
```

### Data Models

#### 1. Knowledge Configuration (`config/knowledge.yaml`)

```yaml
tagCategories:
  - id: "topic"
    name: "Topic"
    description: "Subject matter of the content"
    color: "#3B82F6"          # For UI display
    allowCustom: false        # If false, only predefined values allowed
    values:
      - id: "finance"
        name: "Finance"
      - id: "health"
        name: "Health"
      - id: "technology"
        name: "Technology"
      - id: "travel"
        name: "Travel"
      - id: "personal"
        name: "Personal"
      - id: "work"
        name: "Work"

  - id: "project"
    name: "Project"
    description: "Associated project"
    color: "#10B981"
    allowCustom: true         # AI can create new projects
    values:
      - id: "lucy"
        name: "Lucy App"

  - id: "status"
    name: "Status"
    description: "Current status"
    color: "#F59E0B"
    allowCustom: false
    values:
      - id: "active"
        name: "Active"
      - id: "archived"
        name: "Archived"
      - id: "todo"
        name: "To Do"
      - id: "done"
        name: "Done"

  - id: "priority"
    name: "Priority"
    description: "Importance level"
    color: "#EF4444"
    allowCustom: false
    values:
      - id: "high"
        name: "High"
      - id: "medium"
        name: "Medium"
      - id: "low"
        name: "Low"

entityTypes:
  - id: "person"
    name: "Person"
    icon: "user"
    enabled: true
  - id: "place"
    name: "Place"
    icon: "map-pin"
    enabled: true
  - id: "organization"
    name: "Organization"
    icon: "building"
    enabled: true
  - id: "project"
    name: "Project"
    icon: "folder"
    enabled: true
  - id: "concept"
    name: "Concept"
    icon: "lightbulb"
    enabled: true
  - id: "event"
    name: "Event"
    icon: "calendar"
    enabled: true
```

#### 2. Entity (`entities/{id}.yaml`)

```yaml
id: "john-smith"
type: "person"
name: "John Smith"
aliases:
  - "John"
  - "JS"
  - "Johnny Smith"
description: "Senior engineer at Acme Corp"
metadata:                     # Optional type-specific fields
  company: "Acme Corp"
  email: "john@acme.com"
createdAt: "2025-01-15T10:00:00Z"
updatedAt: "2025-01-30T14:00:00Z"
```

#### 3. Graph Index (`index.yaml`)

```yaml
# Forward index: item -> tags/entities
items:
  note:meeting-notes-jan-15:
    tags:
      - "topic:work"
      - "project:lucy"
    entities:
      - "john-smith"
      - "acme-corp"
  memory:user_preferences:
    tags:
      - "topic:personal"
    entities: []

# Reverse index: tag -> items
tagIndex:
  "topic:work":
    - "note:meeting-notes-jan-15"
  "project:lucy":
    - "note:meeting-notes-jan-15"
    - "memory:project_context"

# Reverse index: entity -> items
entityIndex:
  "john-smith":
    - "note:meeting-notes-jan-15"
    - "memory:project_context"
  "acme-corp":
    - "note:meeting-notes-jan-15"

# Entity co-occurrence (for graph visualization)
entityCooccurrence:
  "john-smith":
    - entity: "acme-corp"
      count: 3
    - entity: "lucy-project"
      count: 2

updatedAt: "2025-01-30T14:00:00Z"
```

#### 4. Enhanced Memory Entry (`memories/{key}.yaml`)

```yaml
key: "project_context"
content: "Working on Lucy app with John Smith from Acme Corp..."
tags:                         # Now validated against vocabulary
  - "topic:work"
  - "project:lucy"
entities:                     # NEW: linked entity IDs
  - "john-smith"
  - "acme-corp"
createdAt: "2025-01-15T10:00:00Z"
updatedAt: "2025-01-30T14:00:00Z"
```

#### 5. Enhanced Note Entry (`notes/{filename}.yaml`)

```yaml
title: "Meeting Notes - January 15"
content: "Met with John Smith to discuss Lucy project budget..."
tags:
  - "topic:work"
  - "topic:finance"
  - "project:lucy"
entities:
  - "john-smith"
createdAt: "2025-01-15T10:00:00Z"
updatedAt: "2025-01-30T14:00:00Z"
```

---

## Tools API

### Knowledge Configuration Tools

#### `get_knowledge_config`
Returns the current tag vocabulary and entity types.

**Input**: None

**Output**:
```typescript
{
  tagCategories: TagCategory[];
  entityTypes: EntityType[];
}
```

#### `update_tag_category`
Add or update a tag category (for `allowCustom: true` categories).

**Input**:
```typescript
{
  categoryId: string;
  value: { id: string; name: string; }
}
```

### Entity Tools

#### `search_entities`
Search for existing entities by name/alias. **Must be called before creating new entities.**

**Input**:
```typescript
{
  query: string;           // Search term
  type?: string;           // Filter by entity type
  limit?: number;          // Max results (default: 10)
}
```

**Output**:
```typescript
{
  matches: Array<{
    id: string;
    name: string;
    type: string;
    aliases: string[];
    score: number;         // 0-1 similarity score
  }>;
}
```

#### `get_entity`
Get full entity details by ID.

**Input**: `{ id: string }`

**Output**: Full entity object

#### `create_entity`
Create a new entity. Should only be called after `search_entities` confirms no match.

**Input**:
```typescript
{
  type: string;            // person, place, organization, etc.
  name: string;            // Primary name
  aliases?: string[];      // Alternative names
  description?: string;    // Brief description
  metadata?: Record<string, string>;  // Type-specific fields
}
```

**Output**: `{ id: string; entity: Entity }`

#### `update_entity`
Update an existing entity (add aliases, update description).

**Input**:
```typescript
{
  id: string;
  name?: string;
  aliases?: string[];      // Merged with existing
  description?: string;
  metadata?: Record<string, string>;
}
```

#### `list_entities`
List all entities, optionally filtered by type.

**Input**: `{ type?: string; limit?: number; offset?: number }`

**Output**: `{ entities: Entity[]; total: number }`

### Enhanced Memory/Note Tools

#### `save_memory` (updated)
Now validates tags and accepts entity links.

**Input**:
```typescript
{
  key: string;
  content: string;
  tags?: string[];         // Format: "category:value" or just "value"
  entities?: string[];     // Entity IDs to link
}
```

**Validation**:
- Tags must match vocabulary (unless category has `allowCustom: true`)
- If tag is just "value", attempt to infer category
- Return error with suggestions if invalid

#### `create_note` (updated)
Same tag validation and entity linking as `save_memory`.

### Graph Query Tools

#### `find_related`
Find items related to a given item, entity, or tag.

**Input**:
```typescript
{
  // One of these required:
  itemId?: string;         // e.g., "note:meeting-notes" or "memory:user_prefs"
  entityId?: string;       // e.g., "john-smith"
  tag?: string;            // e.g., "project:lucy"

  // Options:
  depth?: number;          // Traversal depth (default: 1)
  limit?: number;          // Max results
}
```

**Output**:
```typescript
{
  items: Array<{
    id: string;
    type: "note" | "memory";
    title?: string;        // For notes
    key?: string;          // For memories
    tags: string[];
    entities: string[];
    relevanceScore: number;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    connectionCount: number;
  }>;
}
```

#### `get_graph_stats`
Get statistics about the knowledge graph.

**Input**: None

**Output**:
```typescript
{
  totalNotes: number;
  totalMemories: number;
  totalEntities: number;
  totalTags: number;
  topTags: Array<{ tag: string; count: number }>;
  topEntities: Array<{ id: string; name: string; count: number }>;
  orphanedItems: number;   // Items with no tags or entities
}
```

---

## Tag Validation Logic

### Normalization Rules

1. **Full format**: `"topic:finance"` → validated as-is
2. **Value only**: `"finance"` → search categories, if unique match found, expand to `"topic:finance"`
3. **Case insensitive**: `"Finance"` → `"finance"` → `"topic:finance"`
4. **Unknown value**:
   - If category has `allowCustom: true` → create new value
   - If category has `allowCustom: false` → error with suggestions

### Validation Response

```typescript
{
  valid: boolean;
  normalizedTags: string[];      // Successfully validated tags
  errors: Array<{
    input: string;
    message: string;
    suggestions: string[];       // Closest matches
  }>;
}
```

---

## Entity Matching Logic

### Similarity Algorithm

Use a combination of:
1. **Exact match**: Name or alias matches exactly (score: 1.0)
2. **Case-insensitive match**: (score: 0.95)
3. **Levenshtein distance**: For typos (score: based on distance)
4. **Token overlap**: "John Smith" vs "Smith, John" (score: based on overlap)

### Deduplication Flow

```
AI wants to save: "Met with Johnny at Acme"
         │
         ▼
search_entities("Johnny")
         │
         ▼
┌─ Match found: john-smith (alias: "Johnny") score: 0.95
│
└─► Use existing entity ID: "john-smith"

search_entities("Acme")
         │
         ▼
┌─ Match found: acme-corp (alias: "Acme") score: 0.90
│
└─► Use existing entity ID: "acme-corp"
```

---

## UI Components

### Settings > Knowledge

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Settings                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tag Categories                               [+ Add]       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔵 Topic (6 values)                    [Edit] [Del] │   │
│  │ 🟢 Project (2 values, custom allowed)  [Edit] [Del] │   │
│  │ 🟡 Status (4 values)                   [Edit] [Del] │   │
│  │ 🔴 Priority (3 values)                 [Edit] [Del] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Entity Types                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ Person    ☑ Place    ☑ Organization              │   │
│  │ ☑ Project   ☑ Concept  ☑ Event                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Statistics                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 24 Notes  •  18 Memories  •  42 Entities           │   │
│  │ Top tags: project:lucy (15), topic:work (12)       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tag Category Editor Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Tag Category: Topic                           [Save]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Name: [Topic                    ]                          │
│  Description: [Subject matter of the content    ]           │
│  Color: [🔵 Blue ▼]                                         │
│  ☐ Allow AI to create new values                            │
│                                                             │
│  Values:                                      [+ Add Value] │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ finance   - Finance                          [×]    │   │
│  │ health    - Health                           [×]    │   │
│  │ technology - Technology                      [×]    │   │
│  │ travel    - Travel                           [×]    │   │
│  │ personal  - Personal                         [×]    │   │
│  │ work      - Work                             [×]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Entity Browser (Separate Page or Tab)

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Graph                          [Search: _____]   │
├─────────────────────────────────────────────────────────────┤
│  Filter: [All Types ▼]  [All Tags ▼]           42 entities │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 👤 John Smith                              12 links  │  │
│  │    Person • Aliases: John, JS                        │  │
│  │    Senior engineer at Acme Corp                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 🏢 Acme Corp                                8 links  │  │
│  │    Organization • Aliases: Acme                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 📍 Paris                                    5 links  │  │
│  │    Place                                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Load More]                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Add Infrastructure
- Create knowledge config file with default categories
- Create index file (empty)
- Add new tools without breaking existing ones

### Phase 2: Backward Compatibility
- Existing memories/notes with old-style tags continue to work
- On access, attempt to normalize tags to new format
- Add `entities: []` field to existing items

### Phase 3: Gradual Enhancement
- New saves validate tags
- AI prompted to use new entity workflow
- Index builds incrementally as items are accessed/saved

---

## File Changes Summary

### New Files
- `renderer/src/lib/tools/integrations/knowledge/index.ts` - Integration definition
- `renderer/src/lib/tools/integrations/knowledge/tools.ts` - Tool implementations
- `renderer/src/lib/tools/integrations/knowledge/types.ts` - TypeScript types
- `renderer/src/lib/tools/integrations/knowledge/validation.ts` - Tag validation
- `renderer/src/lib/tools/integrations/knowledge/matching.ts` - Entity matching
- `renderer/src/lib/tools/integrations/knowledge/index-manager.ts` - Graph index operations
- `renderer/src/components/settings/KnowledgeSettings.tsx` - Settings UI
- `renderer/src/components/settings/TagCategoryEditor.tsx` - Tag editor modal
- `renderer/src/components/knowledge/EntityBrowser.tsx` - Entity list view
- `renderer/src/app/api/knowledge/route.ts` - API endpoints

### Modified Files
- `renderer/src/lib/tools/integrations/index.ts` - Register knowledge integration
- `renderer/src/lib/tools/integrations/memory/tools.ts` - Add validation
- `renderer/src/lib/tools/integrations/notes/tools.ts` - Add validation
- `renderer/src/lib/db/schema.ts` - Optional: add knowledge config table
- `renderer/src/components/settings/SettingsPanel.tsx` - Add Knowledge tab

---

## Success Criteria

1. **Tag Control**: AI cannot create tags outside vocabulary (unless `allowCustom`)
2. **Entity Dedup**: Running `search_entities("John")` returns existing "John Smith" entity
3. **Graph Queries**: Can find all notes mentioning a person or tagged with a project
4. **UI Management**: Can add/edit/delete tag categories and values in settings
5. **Backward Compatible**: Existing memories/notes continue to work
