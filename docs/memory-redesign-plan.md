# Memory System Redesign Plan

## Problem Statement

Current memory system has too much friction:
- 8 memory types to choose from (fact, decision, preference, project, person, concept, procedure, reference)
- Agent must manually construct `[[wiki links]]`
- Rigid note structure with required sections
- No automatic relationship detection
- No versioning/supersession tracking

## Inspiration: Supermemory.ai

Supermemory's approach:
- **Documents → Memories** (simple input/output model)
- **Three relationship types**:
  - `updates` - new info replaces old (tracks `isLatest`)
  - `extends` - adds to existing without invalidating
  - `derives` - auto-detected connections via pattern analysis
- **Semantic search** instead of keyword matching
- **Auto-generates connections** through pattern analysis

## Proposed Changes

### 1. Flatten Structure

**Before:**
```
Memory/
├── Facts/
├── Decisions/
├── Preferences/
├── Projects/
├── People/
├── Concepts/
├── Procedures/
└── References/
```

**After:**
```
Memory/
├── User prefers dark mode in all IDEs.md
├── Decided to use REST over GraphQL.md
├── Sarah is the frontend lead.md
└── Lucy App uses Electron + Next.md
```

Use tags instead of folder-based types.

### 2. Simplified Frontmatter

**Before:**
```yaml
---
created: 2024-01-15T10:30:00Z
updated: 2024-01-15T10:30:00Z
type: decision
tags:
  - api
  - architecture
source: lucy-agent
---
```

**After:**
```yaml
---
created: 2024-01-15
tags: [api, architecture, decision]
updates: Memory/Old API decision.md  # optional - what this supersedes
---
```

### 3. Simplified Note Format

**Before:**
```markdown
---
[frontmatter]
---

# REST vs GraphQL for API

## Content

Decided to use REST...

## Context

Discussed during planning...

## Related

- [[REST]]
- [[GraphQL]]

---
*Memory managed by Lucy*
```

**After:**
```markdown
---
created: 2024-01-15
tags: [decision, api]
---

Decided to use [[REST]] over [[GraphQL]] for the [[Lucy App]] API.
Simpler caching and team familiarity were the main factors.

Context: Planning session on 2024-01-15.
```

### 4. Single Unified Tool

Replace `memory_search`, `memory_add`, `memory_update` with one `memory` tool:

```typescript
const memoryTool = {
  name: "memory",
  inputSchema: z.object({
    action: z.enum(["save", "find", "update"]),

    // For save/update
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
    updates: z.string().optional(), // Path to memory this replaces

    // For find
    query: z.string().optional(),
  }),
};
```

### 5. Auto-Linking System

See detailed explanation below.

### 6. Auto-Capture Patterns

Agent proactively saves when detecting:

| User says | Memory type |
|-----------|-------------|
| "I prefer X", "I like X", "I always use X" | preference |
| "Let's use X", "We decided", "Going with X" | decision |
| "I work at X", "My project is X" | context |
| "[Name] is my...", "Talk to [Name] about..." | person |
| "Remember that...", "Don't forget..." | explicit save |

---

## Linking: Agent-Driven Conventions (Simplified)

### Why Not Auto-Linking?

Auto-linking has a bootstrap problem:
```
Memory 1: "Sarah likes REST"     → Links to nothing (empty registry)
Memory 2: "Used REST for API"    → Could link to Memory 1, but how?
Memory 3: "Sarah reviewed API"   → Should link to 1 and 2, but 1 never gets updated
```

Old notes never get backfilled. The graph stays broken.

**Complex solutions (registry, scanning, injection) add overhead for marginal benefit.**

### The Simple Solution: Teach the Agent Conventions

LLMs understand Obsidian format natively. Just teach conventions:

| Convention | Meaning | Example |
|------------|---------|---------|
| `[[@Name]]` | Person | `[[@Sarah]]`, `[[@John Smith]]` |
| `[[#Name]]` | Project | `[[#Lucy App]]`, `[[#Client Portal]]` |
| `[[Term]]` | Concept/Topic | `[[REST]]`, `[[TypeScript]]`, `[[API Design]]` |

### Why This Works

**Obsidian allows links to non-existent notes.** This is the key insight.

```
Memory 1: "Talked to [[@Sarah]] about [[REST]]"
          → @Sarah.md doesn't exist yet - that's OK
          → REST.md doesn't exist yet - that's OK
          → Links are valid, just "unresolved"

Memory 2: "[[@Sarah]] prefers [[REST]] over [[GraphQL]]"
          → Same [[@Sarah]] link - connects to same node
          → Same [[REST]] link - connects to same node

Later: Create "@Sarah.md" note with her details
          → Backlinks from Memory 1 and 2 automatically appear
          → Graph view shows all connections
```

**No registry. No auto-linking. No complexity. Just conventions.**

### The Agent's Mental Model

When saving a memory, agent thinks:

1. **Who** is involved? → `[[@Person]]`
2. **What project** is this about? → `[[#Project]]`
3. **What concepts/topics** are mentioned? → `[[Concept]]`

```markdown
---
created: 2024-01-15
tags: [decision, api]
---

Discussed API approach with [[@Sarah]] for [[#Lucy App]].
Decided [[REST]] over [[GraphQL]] - simpler caching.
Related to [[API Design]] principles we established.
```

### Entity Notes (Created On-Demand)

When enough context accumulates, agent creates dedicated notes:

**@Sarah.md:**
```markdown
---
created: 2024-01-20
tags: [person, frontend, team]
---

# @Sarah

Frontend lead. Works Mon-Thu, remote Fridays.

## Preferences
- Prefers [[React]] over [[Vue]]
- Likes [[TypeScript]] strict mode

## Projects
- Lead on [[#Lucy App]]
- Previously worked on [[#Client Portal]]
```

**#Lucy App.md:**
```markdown
---
created: 2024-01-10
tags: [project, active]
---

# #Lucy App

Desktop app built with [[Electron]] + [[Next.js]].

## Team
- [[@Sarah]] - Frontend
- [[@Mike]] - Backend

## Key Decisions
- Using [[REST]] API (see [[REST vs GraphQL decision]])
- [[SQLite]] for local storage
```

### Graph Emerges Naturally

```
                    [[REST]]
                   /        \
    [[@Sarah]] ──────── [[#Lucy App]]
         \                  /
          \                /
           [[API Design]]
```

Every mention of `[[REST]]` across all memories connects to the same node.
Every mention of `[[@Sarah]]` connects to the same node.

**The graph builds itself through consistent naming.**

### Conventions Summary

| Prefix | Use For | Creates |
|--------|---------|---------|
| `@` | People | `@Name.md` in vault |
| `#` | Projects | `#Project.md` in vault |
| (none) | Concepts, decisions, topics | `Concept.md` in vault |

### Agent Instructions

Include in system prompt:

```
When saving memories, use Obsidian wiki-link conventions:
- People: [[@Name]] (e.g., [[@Sarah]], [[@John Smith]])
- Projects: [[#Project]] (e.g., [[#Lucy App]], [[#Client Portal]])
- Concepts: [[Topic]] (e.g., [[REST]], [[TypeScript]], [[API Design]])

Links can point to notes that don't exist yet. Obsidian handles this.
Use consistent naming - [[REST]] not [[rest]] or [[REST API]].
The graph builds through repeated mentions across memories.

---

## Relationship Tracking

### Updates Relationship

When new information supersedes old:

```yaml
---
created: 2024-06-01
tags: [preference, runtime]
updates: Memory/Prefers Node over Deno.md
---

Now prefers [[Bun]] over [[Node.js]] for new projects.
Faster startup and better TypeScript support.
```

**On search:**
- If a memory has `updates` field, the old memory is considered outdated
- Search results prioritize memories that aren't superseded
- Can still access old memories for historical context

### Extends Relationship

When adding to existing knowledge without invalidating it:

```yaml
---
created: 2024-06-01
tags: [person, sarah]
extends: Memory/Sarah is frontend lead.md
---

Additional context about [[@Sarah]]:
- Prefers React over Vue
- Available Mon-Thu, works from home Fridays
```

**On search:**
- Both memories are valid and returned
- Extended memory might be shown together with parent

### Derives Relationship (Auto-Generated)

System detects shared links/tags:

```
Memory A: "Decided to use [[REST]] for [[#LucyApp]]"
Memory B: "[[REST]] has better caching than [[GraphQL]]"

Derived relationship: A relates to B (shared: REST)
```

This happens at search time, not storage time.

---

## Implementation Phases

### Phase 1: Simplify Structure
- [ ] Remove type folders, use flat `Memory/` folder
- [ ] Simplify frontmatter (remove `type`, `source`, `updated`)
- [ ] Simplify note format (remove rigid sections)
- [ ] Update tool descriptions with linking conventions

### Phase 2: Simplify Tools
- [ ] Merge `memory_search`, `memory_add`, `memory_update` into single `memory` tool
- [ ] Remove wiki-link validation (agent handles it via conventions)
- [ ] Add `updates` field support in frontmatter

### Phase 3: Agent Prompting
- [ ] Add linking conventions to system prompt
- [ ] Add auto-capture patterns (preferences, decisions, context)
- [ ] Test agent's adherence to conventions

### Phase 4: Entity Notes (Optional)
- [ ] Add ability for agent to create entity notes (@Person, #Project)
- [ ] Consider periodic "consolidation" where agent reviews orphan links

---

## Open Questions

1. **Semantic search**: Current implementation uses Obsidian's text search. Should we add vector embeddings for semantic search? (Adds complexity but improves recall)

2. **Naming consistency**: How to handle `[[REST]]` vs `[[REST API]]` vs `[[rest]]`? Agent discipline + periodic cleanup?

3. **Entity note triggers**: When should agent create a dedicated @Person or #Project note vs just linking?

4. **Updates relationship**: Should search deprioritize superseded memories, or just show the chain?

5. **Vault location**: Keep in `Memory/` folder or spread throughout vault?
