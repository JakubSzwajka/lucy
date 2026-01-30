# Knowledge Module

Local knowledge graph for storing facts and people. Used by AI agents to remember information across sessions.

## Architecture

```
knowledge/
├── index.ts          # Entry point, exports integration + public API
├── tools.ts          # AI-facing tools (save_fact, remember_person, etc.)
├── storage.ts        # Entity CRUD operations (filesystem abstraction)
├── types.ts          # TypeScript types + defaults
├── utils.ts          # Shared utilities (Levenshtein, tokenize)
├── config.service.ts # Manages knowledge.yaml (tag categories, entity types)
├── index-manager.ts  # Graph index (tags, relations, cooccurrence)
├── matching.ts       # Fuzzy entity search
└── validation.ts     # Tag validation and normalization
```

## Data Flow

```
AI Tool Call
    ↓
tools.ts (business logic)
    ↓
storage.ts (CRUD)
    ├── filesystem service (YAML read/write)
    └── index-manager.ts (update indexes)
```

## File Responsibilities

### tools.ts (14KB)
AI-facing tool definitions. Each tool:
- Validates input
- Calls storage service
- Returns structured response

**Tools:**
- Facts: `save_fact`, `recall_fact`, `search_facts`, `delete_fact`
- People: `remember_person`, `get_person`, `update_person`, `search_people`, `list_people`, `forget_person`
- Graph: `find_related`, `get_memory_stats`

### storage.ts (3.3KB)
Abstracts entity persistence. Handles:
- YAML serialization
- File read/write/delete
- Index updates on save/delete

```typescript
interface EntityStorage {
  exists(id: string): boolean
  get(id: string): Promise<Entity | null>
  getAll(): Promise<Entity[]>
  getByType(type: string): Promise<Entity[]>
  save(entity: Entity): Promise<void>
  delete(id: string): Promise<boolean>
}
```

### types.ts (2.9KB)
All TypeScript interfaces:
- `Entity` - unified entity model
- `TagCategory`, `TagValue` - tag system
- `EntityType` - fact, person
- `GraphIndex`, `GraphStats` - index structures
- `DEFAULT_*` - default configurations

### config.service.ts (3.9KB)
Manages `memory/config/knowledge.yaml`:
- Tag categories (add/update/delete)
- Tag values within categories
- Entity type enable/disable

Used by Settings UI panel.

### index-manager.ts (9.8KB)
Maintains `memory/index.yaml`:
- `tagIndex`: tag → entity IDs
- `relations`: bidirectional entity links
- `cooccurrence`: connection counts

Provides:
- `updateEntityTags()` - reindex on tag change
- `updateEntityRelations()` - update bidirectional links
- `removeEntity()` - clean removal from all indexes
- `findRelated()` - get connected entities
- `getStats()` - graph statistics

### matching.ts (4.4KB)
Fuzzy entity search using:
- Levenshtein distance (character similarity)
- Token overlap (word-level Jaccard)
- Bonus for exact/prefix/contains matches

Exports:
- `searchEntities()` - main search function
- `nameToId()` - generate URL-safe ID
- `findDuplicateEntity()` - prevent duplicates

### utils.ts (1KB)
Shared string utilities:
- `levenshteinDistance()` - edit distance between strings
- `levenshteinSimilarity()` - normalized 0-1 similarity
- `tokenize()` - split string into lowercase words

### validation.ts (4.5KB)
Tag validation against config:
- Parse `category:value` format
- Auto-resolve shorthand (`lucy` → `project:lucy`)
- Suggest corrections for typos

## Storage Layout

```
memory/
├── config/
│   └── knowledge.yaml    # Tag categories + entity types
├── entities/
│   ├── fact-user_name.yaml
│   ├── fact-favorite_color.yaml
│   └── person-john-doe.yaml
└── index.yaml            # Tag + relation indexes
```

## Entity Format

```yaml
id: person-john-doe
type: person
name: John Doe
aliases:
  - Johnny
  - JD
description: College friend
tags:
  - project:startup
relations:
  - fact-johns_birthday
createdAt: 2024-01-15T10:00:00.000Z
updatedAt: 2024-01-15T10:00:00.000Z
```

## Optimization Opportunities

1. **Index rebuilding**: Currently no way to rebuild index from entities if corrupted. Could add `rebuildIndex()` method.

2. **Caching**: `storage.getAll()` reads all files every call. Could add LRU cache.

3. **Batch operations**: No batch save/delete. Each operation is individual file write.

## Adding New Entity Types

1. Add type to `memory/config/knowledge.yaml`:
   ```yaml
   entityTypes:
     - id: company
       name: Company
       icon: building
       enabled: true
   ```

2. Update `NAMED_ENTITY_TYPES` in `types.ts`

3. Add tools in `tools.ts` following the person pattern

## Testing

Services use singleton pattern. Call `clearCache()` on services between tests:
```typescript
getKnowledgeConfigService().clearCache()
getIndexManager().clearCache()
```
