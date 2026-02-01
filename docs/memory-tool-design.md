# Memory Tool Design

## Overview

A Memory tool that uses Obsidian as persistent storage, leveraging its graph-based linking system for knowledge retrieval and relationship building.

---

## Tool Interface

### 1. `memory_search`

Search for existing memories by content, tags, or relationships.

```typescript
interface MemorySearchParams {
  query: string;           // Natural language or keyword search
  tags?: string[];         // Filter by tags (e.g., ["project", "decision"])
  linked_to?: string;      // Find memories linked to a specific topic
  date_range?: {
    from?: string;         // ISO date
    to?: string;
  };
  limit?: number;          // Max results (default: 10)
}

interface MemorySearchResult {
  memories: Memory[];
  total_count: number;
}
```

### 2. `memory_add`

Create a new memory note in the vault.

```typescript
interface MemoryAddParams {
  title: string;           // Memory title (becomes filename)
  content: string;         // Main content (markdown)
  tags: string[];          // Categorization tags
  links: string[];         // Related topics to link via [[wiki links]]
  memory_type: MemoryType; // Classification
  context?: string;        // Optional context about when/why this was stored
}

type MemoryType =
  | "fact"           // Factual information
  | "decision"       // Decision made with rationale
  | "preference"     // User preference
  | "project"        // Project-related knowledge
  | "person"         // Information about a person
  | "concept"        // Abstract concept or idea
  | "procedure"      // How to do something
  | "reference";     // External reference or resource
```

### 3. `memory_update`

Update an existing memory.

```typescript
interface MemoryUpdateParams {
  title: string;           // Identify memory by title
  updates: {
    content?: string;      // New content (replaces existing)
    append?: string;       // Append to existing content
    tags?: {
      add?: string[];
      remove?: string[];
    };
    links?: {
      add?: string[];
      remove?: string[];
    };
  };
}
```

---

## Obsidian Vault Structure

```
Vault/
├── Memory/
│   ├── Facts/
│   ├── Decisions/
│   ├── Preferences/
│   ├── Projects/
│   ├── People/
│   ├── Concepts/
│   ├── Procedures/
│   └── References/
├── Topics/                 # Hub notes for major topics
│   ├── [[Programming]].md
│   ├── [[Work]].md
│   └── ...
└── _templates/
    └── memory-template.md
```

---

## Memory Note Template

Each memory is stored as a markdown file with this structure:

```markdown
---
created: {{date}}
updated: {{date}}
type: {{memory_type}}
tags:
  - {{tag1}}
  - {{tag2}}
source: lucy-agent
---

# {{title}}

## Content

{{content}}

## Context

{{context}}

## Related

- [[Topic1]]
- [[Topic2]]
- [[Related Memory]]

---
*Memory managed by Lucy*
```

---

## Wiki Link Conventions

**IMPORTANT: All memories MUST use wiki links to build the knowledge graph.**

### Linking Rules

1. **Topic Links**: Always link to broad topic hubs
   ```markdown
   This relates to [[Programming]] and [[JavaScript]]
   ```

2. **Person Links**: Use `@` prefix convention
   ```markdown
   Discussed with [[@John Smith]] about the architecture
   ```

3. **Project Links**: Use `#` prefix convention
   ```markdown
   Part of [[#Lucy App]] development
   ```

4. **Cross-Memory Links**: Link related memories directly
   ```markdown
   See also [[Decision - API Design 2024-01]]
   ```

5. **Bidirectional Awareness**: When adding a link, consider if the target should link back

### Link Syntax

| Type | Syntax | Example |
|------|--------|---------|
| Basic | `[[Note]]` | `[[JavaScript]]` |
| Aliased | `[[Note\|Display]]` | `[[JavaScript\|JS]]` |
| Heading | `[[Note#Section]]` | `[[API Design#Authentication]]` |
| Block | `[[Note^block-id]]` | `[[Meeting Notes^action-items]]` |

---

## Tool Descriptions (for AI)

### memory_search

```
Search the knowledge base for relevant memories. Use this to:
- Recall past decisions and their rationale
- Find user preferences before making suggestions
- Look up project context and history
- Discover related information via the link graph

Returns memories with their content, tags, and connections.
Always search before adding to avoid duplicates.
```

### memory_add

```
Store a new memory in the knowledge base.

REQUIRED STRUCTURE:
- Title: Clear, searchable title
- Content: The information to remember
- Tags: At least 2-3 relevant tags for categorization
- Links: MUST include [[wiki links]] to related topics, people, or concepts
- Type: Classify the memory type appropriately

WIKI LINK REQUIREMENTS:
- Every memory MUST link to at least one topic using [[Topic Name]]
- Link to people using [[@Person Name]]
- Link to projects using [[#Project Name]]
- Link to related existing memories when relevant

Example content with proper linking:
"Discussed [[API Design]] patterns with [[@Sarah]].
Decided to use [[REST]] over [[GraphQL]] for [[#Lucy App]]
due to simpler caching. See [[Decision - Tech Stack 2024]]."
```

### memory_update

```
Update an existing memory with new information or corrections.

Use this to:
- Append new learnings to existing knowledge
- Correct outdated information
- Add new links as relationships are discovered
- Update tags for better organization

When appending, maintain the existing structure and wiki link conventions.
```

---

## Example Interactions

### Adding a Memory

**Input:**
```json
{
  "title": "Decision - Database Choice for Lucy",
  "content": "Chose [[SQLite]] with [[Drizzle ORM]] for [[#Lucy App]]. Rationale: desktop app needs embedded DB, no server dependency. [[@Kuba]] prefers type-safe ORMs. Alternative considered: [[PostgreSQL]] but adds deployment complexity.",
  "tags": ["decision", "database", "architecture"],
  "links": ["SQLite", "Drizzle ORM", "#Lucy App", "@Kuba", "PostgreSQL"],
  "memory_type": "decision",
  "context": "Initial architecture planning phase"
}
```

**Created Note:** `Memory/Decisions/Decision - Database Choice for Lucy.md`

### Searching Memories

**Input:**
```json
{
  "query": "database",
  "tags": ["decision"],
  "linked_to": "#Lucy App"
}
```

**Returns:** All decision memories about databases linked to the Lucy App project.

---

## Implementation Notes

### Obsidian Integration

The tool should use one of:
1. **Obsidian Local REST API** plugin (if installed)
2. **Direct file system access** to the vault folder
3. **Obsidian MCP server** (if available)

### Search Implementation

1. **Full-text search**: Search file contents
2. **Tag search**: Parse frontmatter YAML
3. **Link search**: Parse `[[...]]` patterns
4. **Graph traversal**: Follow links to find related content

### Deduplication

Before adding, search for:
- Exact title match
- Similar content (fuzzy match)
- Same topic + recent date

Suggest updating existing memory instead of creating duplicate.
