# PRD: Memory & Continuity System

> Replace the current Obsidian-based entity/fact memory tool with a database-backed structured memory system inspired by the Continuity Framework.

**Status**: Draft
**Last updated**: 2026-02-11

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Current State](#2-current-state)
3. [Target Architecture](#3-target-architecture)
4. [Database Schema](#4-database-schema)
5. [Phase 1 — MemoryStore Interface & Postgres Implementation](#5-phase-1--memorystore-interface--postgres-implementation)
6. [Phase 2 — Memory Service & API](#6-phase-2--memory-service--api)
7. [Phase 3 — Tool Registration & Migration](#7-phase-3--tool-registration--migration)
8. [Phase 4 — Memory Extraction Pipeline](#8-phase-4--memory-extraction-pipeline)
9. [Phase 5 — Context Injection into Chat](#9-phase-5--context-injection-into-chat)
10. [Phase 6 — Memory Connections & Graph](#10-phase-6--memory-connections--graph)
11. [Phase 7 — Questions & Curiosity Loop](#11-phase-7--questions--curiosity-loop)
12. [Phase 8 — Identity Document](#12-phase-8--identity-document)
13. [Phase 9 — Automatic Extraction & Background Jobs](#13-phase-9--automatic-extraction--background-jobs)
14. [Phase 10 — Frontend: Memory Management Page](#14-phase-10--frontend-memory-management-page)
15. [Phase 11 — Admin Settings & Configuration](#15-phase-11--admin-settings--configuration)
16. [API Routes Summary](#16-api-routes-summary)
17. [Frontend Views Summary](#17-frontend-views-summary)
18. [Open Questions & Decisions](#18-open-questions--decisions)
19. [Appendix: File Change Map](#19-appendix-file-change-map)

---

## 1. Motivation

The current memory system stores knowledge in Obsidian markdown files via an external integration. This has limitations:

- **External dependency**: Requires Obsidian configured and running
- **No structure**: Entity/fact model is flat; no confidence scoring, no typed categories, no provenance
- **No connections**: Wiki-links exist but there's no queryable graph
- **No extraction pipeline**: The AI decides ad-hoc what to remember; no systematic reflection
- **No continuity**: Each session starts fresh; no mechanism to surface pending questions or build on prior knowledge
- **Single-user only**: Obsidian vault is local; doesn't work for cloud multi-user

The goal is to move memory into Postgres, add structure (types, confidence, connections), and enable a reflection pipeline that extracts knowledge from conversations automatically.

### Why Not Use `continuity-framework` (npm)?

The continuity framework (`memory-ledger-protocol/continuity/`) is available as an npm package. We evaluated installing it directly but decided against it because:

1. **Hardcoded storage**: `ContinuityFramework` always instantiates its own `MemoryStore` internally (`this.store = new MemoryStore(config)`). No dependency injection — cannot pass a custom Postgres-backed store.
2. **File-only**: The built-in `MemoryStore` reads/writes markdown files. Multi-user Postgres is not supported.
3. **No userId**: The entire interface is single-user; no `userId` parameter on any method.

**What we take from it** (reference, not dependency):
- The `MemoryStore` interface shape (method names, parameters, return types)
- The extraction pipeline concept (classify → score → generate questions)
- The memory format (7 types, confidence tiers, `supersedes`, `source_memory_ids`)
- The reflection loop (extract after session, surface questions at session start)
- The orchestrator structure (`continuity/src/index.js`, `continuity/src/orchestrator.js`)

**What we build ourselves**:
- `MemoryStore` TypeScript interface (extended with `userId` and connections)
- `PostgresMemoryStore` implementation (Drizzle + our schema)
- Services (extraction, context retrieval, questions, identity)
- API routes, tool registration, frontend

This gives us full control over storage backends, multi-user support, and the flexibility to add Postgres-specific features (graph queries via CTEs, full-text search, etc.) while keeping the door open for alternative stores in the future.

---

## 2. Current State

### Memory Tool (`backend/src/lib/tools/modules/memory/index.ts`)

- Three actions: `save`, `find`, `update`
- Two memory kinds: `entity` (hub profiles) and `fact` (specific knowledge about entities)
- Storage: Obsidian vault via `ObsidianClient` integration
- Search: Keyword search across Obsidian + past conversations (via `conversationsIntegration`)
- Frontmatter: `created`, `kind`, `tags`, `aliases`, `entity`, `updates`
- No confidence scoring, no typed categories, no graph queries

### Chat Service (`backend/src/lib/services/chat/chat.service.ts`)

- `executeTurn()` → persist user message → `prepareChat()` → `streamText()`
- System prompt injected via `prependSystemPrompt()`
- No memory context injection currently (memories only accessible via tool calls during conversation)

### Tool Architecture (`backend/src/lib/tools/`)

- `ToolModule` pattern: module declares `integrationId` → `BuiltinToolProvider` finds matching integration → calls `createClient()` → passes client into `createTools(client)`
- Current memory module: `integrationId: "obsidian"` → receives `ObsidianClient`
- Tool registration: single array `allToolModules[]` in `modules/index.ts`

### Settings UI (`renderer/src/components/settings/`)

- Existing tabs: General, Models, System Prompts, Quick Actions, MCP Servers
- Pattern: each settings section has a list component + editor component

### Database (`backend/src/lib/db/schema.ts`)

- Postgres via Drizzle ORM
- All tables have `userId` FK for multi-user
- Existing tables: users, sessions, agents, items, systemPrompts, quickActions, plans, planSteps, settings, mcpServers, sessionMcpServers, integrations

---

## 3. Target Architecture

### 3.1 Layer Separation

Four distinct layers. The critical principles are: **the tool layer is a thin, swappable registration**; **services hold all business logic**; **the MemoryStore interface is the storage boundary**.

```
┌─────────────────────────────────────────────────────────────┐
│                     TOOL LAYER                              │
│  Thin registration only. Defines what the AI sees.          │
│  Delegates all work to the service layer.                   │
│                                                             │
│  tools/modules/continuity/index.ts                          │
│    defineTool("continuity") {                               │
│      - input schema (what args the AI can pass)             │
│      - description (how the AI understands the tool)        │
│      - execute: parse args → call service → format output   │
│    }                                                        │
│                                                             │
│  Can be swapped independently:                              │
│    - "memory" tool (current, entity/fact, Obsidian)         │
│    - "continuity" tool (new, typed/scored, Postgres)        │
│    - or both registered simultaneously during migration     │
│                                                             │
│  Registered via allToolModules[] in modules/index.ts        │
└─────────────────────┬───────────────────────────────────────┘
                      │ calls
┌─────────────────────▼───────────────────────────────────────┐
│                   SERVICE LAYER                             │
│  All business logic. No AI awareness. No storage awareness. │
│                                                             │
│  services/memory/                                           │
│    ├── memory.service.ts          CRUD, dedup, supersede    │
│    ├── extraction.service.ts      Classify→Score→Question   │
│    ├── context-retrieval.service.ts  Ranking, graph walk    │
│    ├── question.service.ts        Curiosity loop            │
│    └── identity.service.ts        Self-model generation     │
│                                                             │
│  Also called by:                                            │
│    - ChatService (context injection into system prompt)     │
│    - API routes (REST endpoints for frontend)               │
│    - Background jobs (auto-extraction on session archive)   │
└─────────────────────┬───────────────────────────────────────┘
                      │ calls
┌─────────────────────▼───────────────────────────────────────┐
│               MEMORY STORE INTERFACE                        │
│  Storage abstraction. Services never touch DB/files         │
│  directly — they go through this interface.                 │
│                                                             │
│  storage/memory-store.interface.ts                          │
│                                                             │
│  Memory operations:                                         │
│    ├── loadMemories(userId, filters?) → Memory[]            │
│    ├── addMemories(userId, memories[]) → Memory[]           │
│    ├── updateMemory(userId, id, data) → Memory              │
│    ├── deleteMemory(userId, id) → void                      │
│    ├── searchMemories(userId, query, opts?) → Memory[]      │
│    ├── touchMemory(userId, id) → void                       │
│    └── supersedeMemory(userId, oldId, newMemory) → Memory   │
│                                                             │
│  Evidence operations:                                       │
│    ├── addEvidence(userId, memoryId, evidence) → Evidence   │
│    └── getEvidence(userId, memoryId) → Evidence[]           │
│                                                             │
│  Connection operations:                                     │
│    ├── addConnections(userId, connections[]) → Connection[]  │
│    ├── getConnections(userId, memoryId) → Connection[]      │
│    ├── getGraph(userId, memoryId, depth) → GraphResult      │
│    └── deleteConnection(userId, connectionId) → void        │
│                                                             │
│  Question operations:                                       │
│    ├── loadQuestions(userId, filters?) → Question[]          │
│    ├── addQuestion(userId, question, sourceMemoryIds[])     │
│    │     → Question                                         │
│    ├── resolveQuestion(userId, id, resolution) → Question   │
│    ├── getQuestionsToSurface(userId, limit) → Question[]    │
│    └── deleteQuestion(userId, id) → void                    │
│                                                             │
│  Identity operations:                                       │
│    ├── loadIdentity(userId) → IdentityDocument | null       │
│    ├── updateIdentity(userId, content) → IdentityDocument   │
│    └── listIdentityVersions(userId) → IdentityDocument[]    │
│                                                             │
│  Reflection operations:                                     │
│    ├── saveReflection(userId, reflection) → Reflection      │
│    └── loadReflections(userId, limit?) → Reflection[]       │
│                                                             │
│  Stats:                                                     │
│    └── getStats(userId) → MemoryStats                       │
│                                                             │
│  Modeled after continuity framework's MemoryStore           │
│  (memory-ledger-protocol/continuity/src/memory-store.js)    │
│  but extended with userId (multi-user), connections,        │
│  evidence, and typed returns.                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ implements
┌─────────────────────▼───────────────────────────────────────┐
│             STORAGE IMPLEMENTATIONS (swappable)             │
│                                                             │
│  storage/                                                   │
│    ├── postgres-memory-store.ts   ← DEFAULT (Phase 1)       │
│    │     Uses Drizzle ORM against Postgres tables.          │
│    │     Full query power, graph CTEs, multi-user.          │
│    │                                                        │
│    ├── file-memory-store.ts       ← OPTIONAL (future)       │
│    │     Markdown files with JSON metadata in HTML          │
│    │     comments (same format as continuity framework).    │
│    │     Human-readable, editable in any text editor.       │
│    │                                                        │
│    └── hybrid-memory-store.ts     ← OPTIONAL (future)       │
│          Postgres source of truth + markdown file export.   │
│          User can browse files; edits go through API.       │
│                                                             │
│  Future:                                                    │
│    ├── mlp-memory-store.ts        (blockchain/IPFS)         │
│    └── sqlite-memory-store.ts     (desktop offline)         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Tool Registration & Swappability

The current pattern:

```typescript
// modules/index.ts — single registration point
export const allToolModules: AnyToolModule[] = [
  notesModule,
  memoryModule,    // ← current: Obsidian entity/fact
  planModule,
];
```

During migration, both tools can coexist:

```typescript
export const allToolModules: AnyToolModule[] = [
  notesModule,
  memoryModule,       // ← old: keep working during transition
  continuityModule,   // ← new: "continuity" tool, backed by services
  planModule,
];
```

After migration, swap out:

```typescript
export const allToolModules: AnyToolModule[] = [
  notesModule,
  continuityModule,   // ← replaces memoryModule entirely
  planModule,
];
```

The tool module itself is thin — ~50 lines that define input schema + description + a handler that calls `MemoryService.getInstance()`. All logic stays in services.

**Important**: The new tool module does NOT need an `integrationId`. The current pattern (`ToolModule.integrationId` → `Integration.createClient()` → inject into `createTools(client)`) exists for external services (Obsidian, Todoist). The continuity system uses internal Postgres — no external client needed. The tool module imports services directly via `getMemoryService()` singleton, same as `planModule` works today.

### 3.3 Who Calls What

```
AI (during chat)  ──→  Tool ("continuity")  ──→  MemoryService  ──→  MemoryStore interface
                                                                           │
Frontend UI       ──→  API Route /api/memories  ──→  MemoryService  ──→  MemoryStore interface
                                                                           │
ChatService       ──→  ContextRetrievalService  ──→  MemoryStore interface │
(prepareChat)          (injects into prompt)                               │
                                                                           ▼
Background Job    ──→  ExtractionService  ──→  MemoryService  ──→  PostgresMemoryStore
(session archive)                               QuestionService    (or FileMemoryStore,
                                                                    or HybridMemoryStore)
```

Four different callers, one service layer, one storage interface. The storage backend is chosen at initialization (config/env) and can be swapped without touching services or tools.

### 3.4 Key Principles

1. **Storage-agnostic**: Services talk to a `MemoryStore` interface, never directly to DB or files. Default implementation is Postgres, but file-based and hybrid are future options.
2. **Multi-user**: Every store method takes `userId`. Storage implementations enforce scoping.
3. **Structured**: 7 memory types, 4 confidence tiers, typed connections.
4. **Provenance**: Every memory links to the conversation that created it.
5. **Queryable graph**: Explicit connection model enables traversal.
6. **Gradual extraction**: Start manual (user-triggered), evolve to automatic.
7. **Backward compatible**: Existing memory tool continues working during migration.
8. **Tool as thin registration**: Build services first, register tool last.
9. **Aligned with continuity framework**: Interface mirrors `MemoryStore` from `memory-ledger-protocol/continuity/src/memory-store.js`, extended with `userId`, connections, and evidence.

---

## 4. Database Schema

All tables added to `backend/src/lib/db/schema.ts`. Tables are introduced incrementally per phase.

### 4.1 `memories` (Phase 1)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | `mem_` prefix + nanoid |
| `user_id` | `text` FK → users | Required |
| `type` | `text` enum | `fact`, `preference`, `relationship`, `principle`, `commitment`, `moment`, `skill` |
| `content` | `text` | The actual memory statement |
| `confidence_score` | `real` | 0.0–1.0 |
| `confidence_level` | `text` enum | `explicit`, `implied`, `inferred`, `speculative` |
| `tags` | `jsonb` | `string[]` |
| `scope` | `text` | Nullable. `global`, `project:<name>`, or custom |
| `status` | `text` enum | `active`, `archived`, `pending_review`. Default `active` |
| `superseded_by` | `text` FK → memories | Nullable. Points to the memory that replaced this one |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |
| `last_accessed_at` | `timestamp` | Updated on retrieval (for recency ranking) |

**Indexes**: `(user_id)`, `(user_id, type)`, `(user_id, scope)`, `(user_id, status)`, `(superseded_by)`

### 4.2 `memory_evidence` (Phase 1)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `memory_id` | `text` FK → memories (CASCADE) | |
| `source_type` | `text` enum | `session`, `item`, `manual` |
| `source_id` | `text` | session.id, item.id, or null for manual |
| `excerpt` | `text` | Source quote (max ~200 chars) |
| `created_at` | `timestamp` | |

**Indexes**: `(memory_id)`, `(source_id)`

### 4.3 `memory_connections` (Phase 6)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `from_memory_id` | `text` FK → memories (CASCADE) | |
| `to_memory_id` | `text` FK → memories (CASCADE) | |
| `relationship_type` | `text` enum | `relates_to`, `contradicts`, `refines`, `supports`, `context_for` |
| `strength` | `real` | 0.0–1.0 |
| `created_at` | `timestamp` | |

**Unique constraint**: `(from_memory_id, to_memory_id, relationship_type)`
**Indexes**: `(from_memory_id)`, `(to_memory_id)`

### 4.4 `questions` (Phase 7)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | `q_` prefix |
| `user_id` | `text` FK → users | |
| `content` | `text` | The question text |
| `context` | `text` | Why this question was generated |
| `curiosity_type` | `text` enum | `gap`, `implication`, `clarification`, `exploration`, `connection` |
| `curiosity_score` | `real` | 0.0–1.0 |
| `timing` | `text` enum | `next_session`, `when_relevant`, `low_priority` |
| `scope` | `text` | Nullable, same as memories |
| `status` | `text` enum | `pending`, `resolved` |
| `answer` | `text` | Nullable, filled on resolve |
| `resolved_at` | `timestamp` | Nullable |
| `created_at` | `timestamp` | |

**Indexes**: `(user_id, status)`, `(user_id, scope)`, `(user_id, timing)`

### 4.5 `question_memory_links` (Phase 7)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `question_id` | `text` FK → questions (CASCADE) | |
| `memory_id` | `text` FK → memories (CASCADE) | |
| `link_type` | `text` enum | `triggered_by`, `answered_by` |
| `created_at` | `timestamp` | |

**Indexes**: `(question_id)`, `(memory_id)`

### 4.6 `identity_documents` (Phase 8)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `user_id` | `text` FK → users | |
| `version` | `integer` | Auto-incrementing per user |
| `content` | `jsonb` | `{ values, capabilities, growthNarrative, keyRelationships }` |
| `is_active` | `boolean` | Only one active per user |
| `generated_at` | `timestamp` | |

**Indexes**: `(user_id, is_active)`

### 4.7 `reflections` (Phase 4)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `user_id` | `text` FK → users | |
| `session_id` | `text` FK → sessions | Which session was reflected on |
| `memories_extracted` | `integer` | Count |
| `questions_generated` | `integer` | Count |
| `model_used` | `text` | Which model ran the extraction |
| `metadata` | `jsonb` | Full extraction job details |
| `created_at` | `timestamp` | |

**Indexes**: `(user_id)`, `(session_id)`

### 4.8 `memory_settings` (Phase 11)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `user_id` | `text` FK → users (UNIQUE) | One row per user |
| `auto_extract` | `boolean` | Enable auto-extraction on session archive. Default `false` |
| `auto_save_threshold` | `real` | Confidence above this auto-saves. Default `0.8` |
| `default_scope` | `text` | Default scope for new memories. Default `global` |
| `max_context_memories` | `integer` | Max memories injected into chat. Default `20` |
| `questions_per_session` | `integer` | Max questions surfaced at session start. Default `3` |
| `extraction_model` | `text` | Model ID for extraction. Nullable (uses cheapest) |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**Indexes**: `(user_id)`

---

## 5. Phase 1 — MemoryStore Interface & Postgres Implementation

> Define the storage abstraction and implement it for Postgres. This is the foundation everything builds on.

### 5.1 TypeScript Types

**File**: `backend/src/lib/memory/types.ts`

Define all shared types used across the interface, services, and implementations:

```typescript
// Memory types
export const memoryTypes = ["fact", "preference", "relationship", "principle", "commitment", "moment", "skill"] as const;
export type MemoryType = (typeof memoryTypes)[number];

export const confidenceLevels = ["explicit", "implied", "inferred", "speculative"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const memoryStatuses = ["active", "archived", "pending_review"] as const;
export type MemoryStatus = (typeof memoryStatuses)[number];

// Connection types
export const relationshipTypes = ["relates_to", "contradicts", "refines", "supports", "context_for"] as const;
export type RelationshipType = (typeof relationshipTypes)[number];

// Question types
export const curiosityTypes = ["gap", "implication", "clarification", "exploration", "connection"] as const;
export type CuriosityType = (typeof curiosityTypes)[number];

export const questionTimings = ["next_session", "when_relevant", "low_priority"] as const;
export type QuestionTiming = (typeof questionTimings)[number];

export const questionStatuses = ["pending", "resolved"] as const;
export type QuestionStatus = (typeof questionStatuses)[number];

// Data shapes
export interface Memory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  tags: string[];
  scope: string | null;
  status: MemoryStatus;
  supersededBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

export interface MemoryEvidence {
  id: string;
  memoryId: string;
  sourceType: "session" | "item" | "manual";
  sourceId: string | null;
  excerpt: string;
  createdAt: Date;
}

export interface MemoryConnection { ... }
export interface Question { ... }
export interface QuestionMemoryLink { ... }
export interface IdentityDocument { ... }
export interface Reflection { ... }
export interface MemoryStats { ... }

// Input shapes (for create/update)
export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  tags?: string[];
  scope?: string;
  status?: MemoryStatus;
}

export interface MemoryFilters {
  type?: MemoryType | MemoryType[];
  scope?: string;
  status?: MemoryStatus;
  minConfidence?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// ... similar input/filter types for questions, connections, etc.
```

### 5.2 MemoryStore Interface

**File**: `backend/src/lib/memory/storage/memory-store.interface.ts`

```typescript
export interface MemoryStore {
  // Initialization
  init(): Promise<void>;

  // Memory CRUD
  loadMemories(userId: string, filters?: MemoryFilters): Promise<Memory[]>;
  addMemories(userId: string, memories: CreateMemoryInput[]): Promise<Memory[]>;
  updateMemory(userId: string, id: string, data: Partial<CreateMemoryInput>): Promise<Memory>;
  deleteMemory(userId: string, id: string): Promise<void>;
  searchMemories(userId: string, query: string, opts?: SearchOptions): Promise<Memory[]>;
  touchMemory(userId: string, id: string): Promise<void>;
  supersedeMemory(userId: string, oldId: string, newMemory: CreateMemoryInput): Promise<Memory>;

  // Evidence
  addEvidence(userId: string, memoryId: string, evidence: CreateEvidenceInput): Promise<MemoryEvidence>;
  getEvidence(userId: string, memoryId: string): Promise<MemoryEvidence[]>;

  // Connections
  addConnections(userId: string, connections: CreateConnectionInput[]): Promise<MemoryConnection[]>;
  getConnections(userId: string, memoryId: string): Promise<MemoryConnection[]>;
  getGraph(userId: string, memoryId: string, depth: number): Promise<GraphResult>;
  deleteConnection(userId: string, connectionId: string): Promise<void>;

  // Questions
  loadQuestions(userId: string, filters?: QuestionFilters): Promise<Question[]>;
  addQuestion(userId: string, question: CreateQuestionInput, sourceMemoryIds: string[]): Promise<Question>;
  resolveQuestion(userId: string, id: string, resolution: QuestionResolution): Promise<Question>;
  getQuestionsToSurface(userId: string, limit: number): Promise<Question[]>;
  deleteQuestion(userId: string, id: string): Promise<void>;

  // Identity
  loadIdentity(userId: string): Promise<IdentityDocument | null>;
  updateIdentity(userId: string, content: IdentityContent): Promise<IdentityDocument>;
  listIdentityVersions(userId: string): Promise<IdentityDocument[]>;

  // Reflections
  saveReflection(userId: string, reflection: CreateReflectionInput): Promise<Reflection>;
  loadReflections(userId: string, limit?: number): Promise<Reflection[]>;

  // Stats
  getStats(userId: string): Promise<MemoryStats>;
}
```

### 5.3 PostgresMemoryStore — Phase 1 Scope

**File**: `backend/src/lib/memory/storage/postgres-memory-store.ts`

Implements the `MemoryStore` interface using Drizzle ORM against the Postgres tables.

**Phase 1 implements only memory + evidence methods** (the rest throw `NotImplementedError` until their phase):

| Method | Phase 1 | Later Phase |
|--------|---------|-------------|
| `init()` | Yes (no-op for Postgres, tables exist via migration) | |
| `loadMemories()` | Yes | |
| `addMemories()` | Yes | |
| `updateMemory()` | Yes | |
| `deleteMemory()` | Yes | |
| `searchMemories()` | Yes (ILIKE on content + tags) | Phase 5: add full-text search |
| `touchMemory()` | Yes | |
| `supersedeMemory()` | Yes | |
| `addEvidence()` | Yes | |
| `getEvidence()` | Yes | |
| `addConnections()` | | Phase 6 |
| `getConnections()` | | Phase 6 |
| `getGraph()` | | Phase 6 |
| `deleteConnection()` | | Phase 6 |
| `loadQuestions()` | | Phase 7 |
| `addQuestion()` | | Phase 7 |
| `resolveQuestion()` | | Phase 7 |
| `getQuestionsToSurface()` | | Phase 7 |
| `deleteQuestion()` | | Phase 7 |
| `loadIdentity()` | | Phase 8 |
| `updateIdentity()` | | Phase 8 |
| `listIdentityVersions()` | | Phase 8 |
| `saveReflection()` | | Phase 4 |
| `loadReflections()` | | Phase 4 |
| `getStats()` | Yes (partial — memory counts only) | Expand per phase |

### 5.4 Schema Changes

Add `memories` and `memory_evidence` tables to `backend/src/lib/db/schema.ts` (see Section 4.1, 4.2).

Run `npm run db:push` to apply.

### 5.5 Store Factory

**File**: `backend/src/lib/memory/storage/index.ts`

```typescript
import { PostgresMemoryStore } from "./postgres-memory-store";
import type { MemoryStore } from "./memory-store.interface";

let instance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!instance) {
    // Future: switch on env var for different backends
    instance = new PostgresMemoryStore();
  }
  return instance;
}
```

### 5.6 Deliverables

- [x] `backend/src/lib/memory/types.ts` — all type definitions
- [x] `backend/src/lib/memory/storage/memory-store.interface.ts` — full interface
- [x] `backend/src/lib/memory/storage/postgres-memory-store.ts` — Postgres impl (memory + evidence methods)
- [x] `backend/src/lib/memory/storage/index.ts` — store factory
- [x] `backend/src/lib/db/schema.ts` — add `memories` + `memory_evidence` tables
- [x] Drizzle migration applied

### 5.7 Verification

- Can create memories via `PostgresMemoryStore.addMemories()` directly
- Can load/filter/search/supersede/delete
- Can add and retrieve evidence
- Unimplemented methods throw clear errors
- All queries scoped by `userId`

---

## 6. Phase 2 — Memory Service & API

> Wrap the store with business logic and expose via REST API.

### 6.1 Memory Service

**File**: `backend/src/lib/memory/memory.service.ts`

Singleton (`getMemoryService()`). Wraps `MemoryStore` with business logic:

- `create(userId, input, evidence?)` — validates input, generates `mem_` ID, calls store, optionally adds evidence
- `getById(userId, id)` — loads memory + evidence, calls `touchMemory`
- `list(userId, filters)` — delegates to store with validated filters
- `search(userId, query)` — calls store `searchMemories` + optionally `conversationsIntegration` (parallel, like current tool)
- `update(userId, id, data)` — validates, delegates to store
- `supersede(userId, oldId, newInput)` — creates new memory, marks old as superseded
- `delete(userId, id)` — delegates to store
- `getStats(userId)` — delegates to store

Deduplication: on `create`, search for existing memories with similar content. If found, return a warning (not blocking — let the caller decide to supersede or proceed).

### 6.2 API Routes

**File**: `backend/src/app/api/memories/route.ts`

```typescript
// GET /api/memories — list with filters
// Query params: type, scope, status, minConfidence, tags, search, limit, offset

// POST /api/memories — create memory manually
// Body: { type, content, confidenceScore, confidenceLevel, tags?, scope?, evidence? }
```

**File**: `backend/src/app/api/memories/[id]/route.ts`

```typescript
// GET /api/memories/:id — get memory with evidence
// PATCH /api/memories/:id — update memory
// DELETE /api/memories/:id — delete memory
```

All routes use `requireAuth` → extract `userId`. Follow existing patterns from `backend/src/app/api/sessions/route.ts`.

### 6.3 Deliverables

- [x] `backend/src/lib/memory/memory.service.ts`
- [x] `backend/src/lib/memory/index.ts` — exports `getMemoryService()`
- [x] `backend/src/app/api/memories/route.ts`
- [x] `backend/src/app/api/memories/[id]/route.ts`

### 6.4 Verification

- `curl` GET/POST/PATCH/DELETE against `/api/memories` with Bearer token
- Filters work (type, scope, search)
- Dedup warning on similar create
- 401 on missing/invalid token
- Cannot access another user's memories

---

## 7. Phase 3 — Tool Registration & Migration

> Register the new continuity tool and migrate existing Obsidian memories.

### 7.1 Continuity Tool Module

**File**: `backend/src/lib/tools/modules/continuity/index.ts`

Thin module — no `integrationId`, imports `getMemoryService()` directly:

```typescript
export const continuityModule = defineToolModule({
  id: "continuity",
  name: "Continuity",
  description: "Structured memory with confidence scoring",
  integrationId: null, // No external integration needed

  createTools: () => [
    defineTool({
      name: "continuity",
      description: `Store and recall structured knowledge about the user.

ACTIONS:
- "save": Store a new memory with type and confidence
- "find": Search memories and past conversations
- "update": Modify an existing memory
- "supersede": Replace an outdated memory with a new version

MEMORY TYPES: fact, preference, relationship, principle, commitment, moment, skill
CONFIDENCE: explicit (0.95-1.0), implied (0.70-0.94), inferred (0.40-0.69), speculative (0.00-0.39)`,

      inputSchema: z.object({
        action: z.enum(["save", "find", "update", "supersede"]),
        // save
        type: z.enum(memoryTypes).optional(),
        content: z.string().optional(),
        confidenceScore: z.number().min(0).max(1).optional(),
        confidenceLevel: z.enum(confidenceLevels).optional(),
        tags: z.array(z.string()).optional(),
        scope: z.string().optional(),
        // find
        query: z.string().optional(),
        // update
        memoryId: z.string().optional(),
        // supersede
        oldMemoryId: z.string().optional(),
      }),

      source: { type: "builtin", moduleId: "continuity" },

      execute: async (args, context) => {
        const service = getMemoryService();
        // Route to service methods based on action
        // Format output for AI consumption
      },
    }),
  ],
});
```

### 7.2 Registration

**File**: `backend/src/lib/tools/modules/index.ts`

Add `continuityModule` to `allToolModules[]`. Keep `memoryModule` during transition.

**Note**: `BuiltinToolProvider.refresh()` iterates integrations to find modules. Since `continuityModule` has no `integrationId`, we need a small change to `BuiltinToolProvider` to also load modules with `integrationId: null` directly (without needing an integration). Alternative: give `continuityModule` a dummy "internal" integration that's always configured.

### 7.3 Obsidian Migration Script

**File**: `backend/scripts/migrate-obsidian-memories.ts`

One-time script to import existing Obsidian memories:

1. Read all `Memory/**/*.md` from configured Obsidian vault path
2. Parse frontmatter (`kind`, `tags`, `created`, `entity`, `updates`)
3. Map `kind: entity` → type `fact` (brief profiles become facts)
4. Map `kind: fact` → infer type from tags/content using simple heuristics
5. Set `confidenceLevel: explicit`, `confidenceScore: 0.95` for all imports
6. Set `scope: global`
7. Create evidence records with `sourceType: manual`, `excerpt: "Imported from Obsidian"`
8. Tag all with `source:obsidian_import`
9. Log results: N imported, N skipped (duplicates)

### 7.4 Deliverables

- [x] `backend/src/lib/tools/modules/continuity/index.ts`
- [x] `backend/src/lib/tools/modules/index.ts` — add continuityModule
- [x] `backend/src/lib/tools/providers/builtin.ts` — handle null integrationId
- [ ] `backend/scripts/migrate-obsidian-memories.ts` — deferred (not critical)

### 7.5 Verification

- AI can call `continuity` tool with `action: "save"` and memories appear in Postgres
- AI can call `continuity` tool with `action: "find"` and get results
- Both `memory` (Obsidian) and `continuity` (Postgres) tools work simultaneously
- Migration script imports existing memories correctly

---

## 8. Phase 4 — Memory Extraction Pipeline

> Systematically extract memories from conversations via LLM analysis.

### 8.1 Extraction Service

**File**: `backend/src/lib/memory/extraction.service.ts`

Singleton (`getExtractionService()`). Core method:

```typescript
async extract(userId: string, sessionId: string, options?: ExtractionOptions): Promise<ExtractionResult>
```

**Process**:
1. Load all items for session's root agent via `ItemService`
2. Format as conversation transcript (role + content, optionally tool calls)
3. Load existing user memories via `MemoryStore.loadMemories()` (for dedup + connection suggestions)
4. Build extraction prompt (see 8.2)
5. Call LLM (configurable model — cheap by default)
6. Parse structured JSON response
7. Return `ExtractionResult` (NOT auto-saved):

```typescript
interface ExtractionResult {
  memories: ExtractedMemory[];    // With type, content, confidence, evidence, suggestedConnections
  questions: ExtractedQuestion[]; // With content, context, curiosityType, sourceMemoryIndices
  metadata: {
    sessionId: string;
    messagesAnalyzed: number;
    modelUsed: string;
    durationMs: number;
  };
}
```

### 8.2 Extraction Prompt

Single LLM call (not three separate agents — simpler, cheaper):

```
You are analyzing a conversation to extract structured memories about the user.

## Existing Memories (do not duplicate these)
{existingMemories — formatted as type + content + id}

## Conversation Transcript
{transcript}

## Instructions

Analyze the conversation and output JSON with two arrays: "memories" and "questions".

### Memories
For each piece of memorable information:
- type: fact | preference | relationship | principle | commitment | moment | skill
- content: Clear, concise single statement
- confidenceScore: 0.0-1.0
- confidenceLevel: explicit (0.95-1.0) | implied (0.70-0.94) | inferred (0.40-0.69) | speculative (0.00-0.39)
- evidence: Direct quote from conversation (max 200 chars)
- tags: Array of categorization tags
- existingMemoryId: If this updates/contradicts an existing memory, its ID (to supersede)
- suggestedConnections: Array of { existingMemoryId, relationshipType } for related memories

### Questions
For each knowledge gap or follow-up:
- content: Natural question (not clinical)
- context: Why this question emerged from the conversation
- curiosityType: gap | implication | clarification | exploration | connection
- curiosityScore: 0.0-1.0 (how important to ask)
- timing: next_session | when_relevant | low_priority
- sourceMemoryIndices: Which extracted memories (by index) triggered this question

Output ONLY valid JSON. No explanation.
```

### 8.3 Confirm Endpoint

**Route**: `POST /api/memories/extract`

Triggers extraction, returns results for review.

**Route**: `POST /api/memories/extract/confirm`

Saves approved items:

```typescript
// Input
{
  sessionId: string;
  approvedMemories: Array<ExtractedMemory & { approved: boolean; edited?: Partial<CreateMemoryInput> }>;
  approvedQuestions: Array<ExtractedQuestion & { approved: boolean }>;
}
```

Process:
1. For each approved memory: call `MemoryService.create()` with evidence linked to session
2. For memories with `existingMemoryId`: call `MemoryService.supersede()`
3. For each approved question: call `MemoryStore.addQuestion()` with `sourceMemoryIds`
4. Save reflection log via `MemoryStore.saveReflection()`

### 8.4 Schema Changes

Add `reflections` table (Section 4.7).

### 8.5 Frontend

**Reflect Button**: Add to session header/menu. Calls `POST /api/memories/extract`.

**Extraction Review Modal** (`renderer/src/components/memory/ExtractionReview.tsx`):
- Cards for each extracted memory: type badge, content, confidence, evidence quote
- Checkbox to approve/reject each
- Inline edit for content/type/confidence before saving
- Section for generated questions with approve/reject
- "Save approved" → calls confirm endpoint

### 8.6 Deliverables

- [x] `backend/src/lib/memory/extraction.service.ts`
- [x] `backend/src/lib/db/schema.ts` — add `reflections` table
- [x] `backend/src/lib/memory/storage/postgres-memory-store.ts` — implement `saveReflection`, `loadReflections`
- [x] `backend/src/app/api/memories/extract/route.ts`
- [x] `backend/src/app/api/memories/extract/confirm/route.ts`
- [x] `renderer/src/lib/api/client.ts` — add extraction methods
- [x] `renderer/src/components/memory/ExtractionReview.tsx`
- [ ] Session header: "Reflect" button wiring — component exists, not yet wired

### 8.7 Verification

- Trigger extraction for a session → get structured JSON with memories + questions
- Approve some, reject some → approved saved to DB, rejected discarded
- Supersede suggestions work (old memory marked, new one created)
- Reflection log saved with metadata
- Evidence links point to correct session

---

## 9. Phase 5 — Context Injection into Chat

> The AI always has relevant memories in context, without needing tool calls.

### 9.1 Context Retrieval Service

**File**: `backend/src/lib/memory/context-retrieval.service.ts`

Core method:

```typescript
async getRelevantMemories(userId: string, sessionId: string, options?: ContextOptions): Promise<ContextResult>
```

Algorithm:
1. Extract keywords from the last N user messages in session
2. `searchMemories(userId, keywords)` — direct content match
3. Scope filtering: prefer matching scope > `global` > other scopes
4. Recency boost: recently accessed memories rank higher
5. Confidence filter: exclude `speculative` (<0.4) by default
6. Dedup and rank by composite score (relevance × confidence × recency)
7. Return top N (configurable, default 20)
8. `touchMemory()` on all returned memories

Returns:
```typescript
interface ContextResult {
  memories: Memory[];
  // questions and identity added in later phases
}
```

### 9.2 Chat Service Modification

**File**: `backend/src/lib/services/chat/chat.service.ts`

Modify `prepareChat()`:

1. After loading system prompt, call `contextRetrievalService.getRelevantMemories(userId, sessionId)`
2. Format as system prompt section:
   ```
   ## What I Remember

   [fact] You work at Sofomo building SnapCap (confidence: 0.98)
   [preference] You prefer concise, direct communication (confidence: 0.95)
   [principle] Never commit directly to main branch (confidence: 1.0)
   ```
3. Append after user's system prompt, before conversation messages

The memory tool remains available for explicit save/search — this injection provides passive context.

### 9.3 Deliverables

- [x] `backend/src/lib/memory/context-retrieval.service.ts`
- [x] `backend/src/lib/services/chat/chat.service.ts` — modify `prepareChat()`

### 9.4 Verification

- Start a new session → AI references user's stored memories without being asked
- AI doesn't hallucinate memories that don't exist
- `last_accessed_at` updates on memories that were injected
- Performance: context retrieval adds <200ms to chat start

---

## 10. Phase 6 — Memory Connections & Graph

> Enable memory-to-memory relationships and graph traversal.

### 10.1 Schema Changes

Add `memory_connections` table (Section 4.3).

### 10.2 Store Implementation

Implement in `PostgresMemoryStore`:
- `addConnections()` — bulk insert with unique constraint handling
- `getConnections()` — all edges from/to a memory
- `getGraph()` — recursive CTE for N-hop traversal:

```sql
WITH RECURSIVE graph AS (
  SELECT id, content, type, 0 as depth
  FROM memories WHERE id = $1 AND user_id = $2
  UNION
  SELECT m.id, m.content, m.type, g.depth + 1
  FROM memories m
  JOIN memory_connections mc ON mc.to_memory_id = m.id
  JOIN graph g ON mc.from_memory_id = g.id
  WHERE g.depth < $3 AND mc.strength > 0.3
)
SELECT * FROM graph WHERE depth > 0;
```

- `deleteConnection()` — by connection ID

### 10.3 Context Retrieval Enhancement

Update `ContextRetrievalService.getRelevantMemories()`:
- After keyword match, expand via `getGraph(memoryId, 1)` for each matched memory
- Include graph-connected memories in ranking (with distance penalty)

### 10.4 Extraction Enhancement

Update extraction prompt to suggest connections to existing memories. On confirm, create connections via `addConnections()`.

### 10.5 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/memories/:id/connections` | Create connection |
| `GET` | `/api/memories/:id/connections` | Get connections |
| `GET` | `/api/memories/:id/graph` | Get graph (query: depth) |
| `DELETE` | `/api/memories/connections/:id` | Delete connection |

### 10.6 Frontend

**Memory Detail**: Show connected memories as list. Allow manual add/remove.

**Graph Visualization** (optional): `MemoryGraph.tsx` using `@xyflow/react` or `d3-force`. Nodes = memories (colored by type), edges = connections (thickness = strength).

### 10.7 Deliverables

- [x] `backend/src/lib/db/schema.ts` — add `memory_connections`
- [x] `backend/src/lib/memory/storage/postgres-memory-store.ts` — implement connection methods
- [x] `backend/src/lib/memory/context-retrieval.service.ts` — graph expansion
- [x] `backend/src/lib/memory/extraction.service.ts` — connection suggestions in prompt
- [x] `backend/src/app/api/memories/[id]/connections/route.ts`
- [x] `backend/src/app/api/memories/[id]/graph/route.ts`
- [x] `backend/src/app/api/memories/connections/[id]/route.ts`
- [ ] `renderer/src/components/memory/MemoryGraph.tsx` (optional, deferred)

### 10.8 Verification

- Create connections manually via API → appear in memory detail
- Extraction suggests connections → saved on confirm
- Context retrieval follows 1-hop connections
- Graph endpoint returns correct depth-limited results

---

## 11. Phase 7 — Questions & Curiosity Loop

> Generate questions from memory gaps, link them to memories, surface to users.

### 11.1 Schema Changes

Add `questions` and `question_memory_links` tables (Sections 4.4, 4.5).

### 11.2 Store Implementation

Implement in `PostgresMemoryStore`:
- `loadQuestions()` — with filters (status, scope, timing)
- `addQuestion()` — insert question + `question_memory_links` for `sourceMemoryIds`
- `resolveQuestion()` — set answer + `resolved_at`, optionally link to answering memory
- `getQuestionsToSurface()` — pending questions, ordered by `curiosity_score` DESC, limited
- `deleteQuestion()` — cascade deletes links

### 11.3 Question Service

**File**: `backend/src/lib/memory/question.service.ts`

- `getPendingForSession(userId, scope?, limit?)` — wraps `getQuestionsToSurface`
- `resolve(userId, id, answer, answeringMemoryId?)` — wraps store + creates `answered_by` link

### 11.4 Context Injection Enhancement

Update context retrieval to include top pending questions:

```
## What I Remember
[fact] ... (confidence: 0.98)

## Things I've Been Wondering
- How is the migration project progressing?
- What drew you to healthcare tech?
```

### 11.5 Extraction Integration

The extraction pipeline (Phase 4) already generates questions. Now they're actually persisted:
- On `extract/confirm`, approved questions saved via `addQuestion()` with `sourceMemoryIds` mapped from extraction indices to real memory IDs

### 11.6 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/questions` | List (filters: status, scope, timing) |
| `GET` | `/api/questions/:id` | Detail with linked memories |
| `PATCH` | `/api/questions/:id` | Resolve (set answer) |
| `DELETE` | `/api/questions/:id` | Delete |

### 11.7 Frontend

**QuestionsList** (`renderer/src/components/memory/QuestionsList.tsx`):
- Grouped by timing: next_session, when_relevant, low_priority
- Each: question text, context, curiosity badge, linked memory chips
- Actions: resolve (with answer), dismiss, snooze

**Session Start Card** (`renderer/src/components/session/SessionStartQuestions.tsx`):
- On new session with no messages, show pending `next_session` questions
- Subtle card alongside quick actions

### 11.8 Deliverables

- [x] `backend/src/lib/db/schema.ts` — add `questions`, `question_memory_links`
- [x] `backend/src/lib/memory/storage/postgres-memory-store.ts` — implement question methods
- [x] `backend/src/lib/memory/question.service.ts`
- [x] `backend/src/lib/memory/context-retrieval.service.ts` — add questions to context
- [x] `backend/src/app/api/questions/route.ts`
- [x] `backend/src/app/api/questions/[id]/route.ts`
- [x] `renderer/src/hooks/useQuestions.ts` — implemented in Phase 10
- [x] `renderer/src/components/memory/QuestionsTab.tsx` — implemented in Phase 10
- [ ] `renderer/src/components/session/SessionStartQuestions.tsx` — deferred
- [x] `renderer/src/lib/api/client.ts` — question methods added in Phase 10

### 11.9 Verification

- Extraction generates questions → confirm saves with `source_memory_ids`
- Questions appear in context injection
- Session start shows pending questions
- Resolve question → marked resolved, linked to answering memory
- Cannot access another user's questions

---

## 12. Phase 8 — Identity Document

> Synthesized self-model that evolves with accumulated memories.

### 12.1 Schema Changes

Add `identity_documents` table (Section 4.6).

### 12.2 Store Implementation

Implement in `PostgresMemoryStore`:
- `loadIdentity()` — get active document for user
- `updateIdentity()` — create new version, set as active, deactivate previous
- `listIdentityVersions()` — all versions for user

### 12.3 Identity Service

**File**: `backend/src/lib/memory/identity.service.ts`

- `getActive(userId)` — wraps store
- `generate(userId)` — loads all memories, sends to LLM with synthesis prompt, saves new version
- `listVersions(userId)` — wraps store

**Synthesis prompt**:
```
Given these memories about a user, synthesize an identity document.

## Memories
{memories grouped by type}

Output JSON:
{
  "values": ["Value statement 1", ...],
  "capabilities": ["Capability 1", ...],
  "growthNarrative": "Paragraph describing evolution...",
  "keyRelationships": [
    { "name": "Name", "nature": "Description of relationship" }
  ]
}
```

### 12.4 Context Injection Enhancement

Prepend active identity document to the memory context section (before individual memories):

```
## Identity
Values: Precision over verbosity. Respect for codebase conventions.
Growth: Started with SnapCap-specific context, expanded to multi-repo...

## What I Remember
[fact] ...
```

### 12.5 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/identity` | Get active identity |
| `POST` | `/api/identity/generate` | Generate new version from memories |
| `GET` | `/api/identity/history` | List all versions |

### 12.6 Frontend

**IdentityView** (`renderer/src/components/memory/IdentityView.tsx`):
- Display: values, capabilities, growth narrative, relationships
- "Regenerate" button
- Version history dropdown

### 12.7 Deliverables

- [x] `backend/src/lib/db/schema.ts` — add `identity_documents`
- [x] `backend/src/lib/memory/storage/postgres-memory-store.ts` — implement identity methods
- [x] `backend/src/lib/memory/identity.service.ts`
- [x] `backend/src/lib/memory/context-retrieval.service.ts` — prepend identity
- [x] `backend/src/app/api/identity/route.ts`
- [x] `backend/src/app/api/identity/generate/route.ts`
- [x] `backend/src/app/api/identity/history/route.ts`
- [x] `renderer/src/components/memory/IdentityTab.tsx` — implemented in Phase 10

### 12.8 Verification

- Generate identity from 20+ memories → coherent document
- Identity appears in chat context injection
- Version history shows previous versions
- Regenerate creates new version, old deactivated

---

## 13. Phase 9 — Automatic Extraction & Background Jobs

> Remove manual trigger; extract memories automatically after sessions end.

### 13.1 Job Queue Setup

Use `pg-boss` (Postgres-native, no Redis):

**File**: `backend/src/lib/jobs/queue.ts`
- Initialize pg-boss on backend startup
- Job types: `memory-extract`, `identity-generate`

### 13.2 Triggers

**Session archive hook**: When session status → `archived`, queue extraction:
```typescript
await pgBoss.send('memory-extract', { sessionId, userId });
```

**Periodic identity regeneration**: Weekly cron via pg-boss schedule.

### 13.3 Job Handlers

**File**: `backend/src/lib/jobs/handlers/memory-extract.ts`

1. Load session transcript
2. Run `ExtractionService.extract(userId, sessionId)`
3. Apply auto-save threshold (from `memory_settings`):
   - Above threshold → auto-save via `MemoryService.create()`
   - Below threshold → save with `status: "pending_review"`
4. Save reflection log

**File**: `backend/src/lib/jobs/handlers/identity-generate.ts`

1. Run `IdentityService.generate(userId)`

### 13.4 Notification

After auto-extraction, create a lightweight notification:
- UI badge/toast: "3 new memories extracted — Review"
- Click → navigate to memory list filtered by `status: pending_review`

(If no notification system exists yet, a simple `memory_notifications` table or polling endpoint suffices.)

### 13.5 Deliverables

- [ ] `backend/src/lib/jobs/queue.ts` — pg-boss setup
- [ ] `backend/src/lib/jobs/handlers/memory-extract.ts`
- [ ] `backend/src/lib/jobs/handlers/identity-generate.ts`
- [ ] `backend/src/lib/services/session/session.service.ts` — queue job on archive
- [ ] Notification mechanism (TBD)

### 13.6 Verification

- Archive a session → extraction job runs within 1 minute
- High-confidence memories auto-saved, low-confidence marked `pending_review`
- Reflection log created with job metadata
- Weekly identity regeneration fires on schedule

---

## 14. Phase 10 — Frontend: Memory Management Page

> Dedicated page for browsing, filtering, and managing all memory data.

### 14.1 Memory Page

**Route**: `/memories` (`renderer/src/app/memories/page.tsx`)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Memories                                [+ New] [Reflect]│
├─────────────┬───────────────────────────────────────────┤
│ [Memories]  │                                           │
│ [Questions] │  Main content area                        │
│ [Identity]  │  (changes based on selected tab)          │
│ [Stats]     │                                           │
├─────────────┤                                           │
│ Filters     │                                           │
│             │                                           │
│ Type        │                                           │
│ □ fact      │                                           │
│ □ preference│                                           │
│ □ ...       │                                           │
│             │                                           │
│ Scope       │                                           │
│ [global ▾]  │                                           │
│             │                                           │
│ Confidence  │                                           │
│ [>=0.5 ━━]  │                                           │
│             │                                           │
│ Status      │                                           │
│ ○ active    │                                           │
│ ○ archived  │                                           │
│ ○ pending   │                                           │
└─────────────┴───────────────────────────────────────────┘
```

**Sub-views**:
- **Memories tab**: Filterable list with type badge, content, confidence, scope, tags. Click to expand/edit. Bulk actions.
- **Questions tab**: `QuestionsList` from Phase 7.
- **Identity tab**: `IdentityView` from Phase 8.
- **Stats tab**: Memory counts by type, confidence distribution, recent reflections, question stats.

### 14.2 API Client & Hooks

**File**: `renderer/src/lib/api/client.ts` — add all memory/question/identity methods (if not already added per phase).

**File**: `renderer/src/hooks/useMemories.ts`
- `useMemories(filters)` — list with SWR
- `useMemory(id)` — detail
- `useCreateMemory()`, `useUpdateMemory()`, `useDeleteMemory()` — mutations

### 14.3 Deliverables

- [x] `renderer/src/app/(main)/settings/memory/page.tsx` — page with 3 tabs (Memories, Questions, Identity)
- [x] `renderer/src/components/memory/MemoriesTab.tsx` — filter bar + memory list
- [x] `renderer/src/components/memory/MemoryRow.tsx` — expandable row with inline edit/delete
- [x] `renderer/src/components/memory/CreateMemoryDialog.tsx` — modal form for manual creation
- [x] `renderer/src/components/memory/QuestionsTab.tsx` — question list with resolve/delete
- [x] `renderer/src/components/memory/IdentityTab.tsx` — identity doc view + regenerate + version history
- [x] `renderer/src/components/memory/StatsTab.tsx` — counts by type/status/confidence (on Dashboard)
- [x] `renderer/src/hooks/useMemories.ts` — React Query hooks for memory CRUD
- [x] `renderer/src/hooks/useQuestions.ts` — React Query hooks for questions
- [x] `renderer/src/hooks/useIdentity.ts` — React Query hooks for identity
- [x] `renderer/src/types/memory.ts` — frontend types mirroring backend
- [x] `renderer/src/lib/api/client.ts` — memory/question/identity API methods
- [x] `renderer/src/lib/query/keys.ts` — added memories, questions, identity key factories
- [x] `renderer/src/components/sidebar/Sidebar.tsx` — added "Memory" nav item
- [x] `renderer/src/app/(main)/dashboard/page.tsx` — added Memory Stats section
- [ ] `renderer/src/components/memory/MemoryGraph.tsx` — graph visualization (optional, deferred)
- [ ] `renderer/src/components/session/SessionStartQuestions.tsx` — session start questions card (deferred)

### 14.4 Verification

- Navigate to Settings → Memory → see all memories with filters
- Filter by type/status/confidence/search → list updates
- Click memory → expand → edit inline or delete
- Create new memory via + button → appears in list
- Questions tab: list, resolve with answer, delete
- Identity tab: view document, regenerate, see version history
- Dashboard: Memory Stats section shows counts by type/status/confidence

---

## 15. Phase 11 — Admin Settings & Configuration

> User-facing configuration for the memory system.

### 15.1 Schema Changes

Add `memory_settings` table (Section 4.8).

### 15.2 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/memory-settings` | Get user's memory settings (or defaults) |
| `PATCH` | `/api/memory-settings` | Update settings |

### 15.3 Settings Tab

**File**: `renderer/src/components/settings/MemorySettings.tsx`

Add to existing Settings view as new tab.

| Setting | Control | Description |
|---------|---------|-------------|
| Auto-extract | Toggle | Auto-extract on session archive |
| Auto-save threshold | Slider (0.0–1.0) | Confidence above this auto-saves |
| Default scope | Text/select | Default scope for new memories |
| Max context memories | Number (1–50) | Memories injected into chat context |
| Questions per session | Number (0–10) | Questions surfaced at session start |
| Extraction model | Select | Model for extraction (default: cheapest) |

### 15.4 Deliverables

- [ ] `backend/src/lib/db/schema.ts` — add `memory_settings`
- [ ] `backend/src/app/api/memory-settings/route.ts`
- [ ] `renderer/src/components/settings/MemorySettings.tsx`
- [ ] `renderer/src/components/settings/index.ts` — add export
- [ ] Wire settings into `ExtractionService` and `ContextRetrievalService`

### 15.5 Verification

- Settings page shows defaults
- Change settings → persisted
- Auto-extract toggle affects session archive behavior
- Max context memories affects chat injection count

---

## 16. API Routes Summary

| Method | Route | Phase |
|--------|-------|-------|
| `GET` | `/api/memories` | 2 |
| `GET` | `/api/memories/:id` | 2 |
| `POST` | `/api/memories` | 2 |
| `PATCH` | `/api/memories/:id` | 2 |
| `DELETE` | `/api/memories/:id` | 2 |
| `POST` | `/api/memories/extract` | 4 |
| `POST` | `/api/memories/extract/confirm` | 4 |
| `POST` | `/api/memories/:id/connections` | 6 |
| `GET` | `/api/memories/:id/connections` | 6 |
| `GET` | `/api/memories/:id/graph` | 6 |
| `DELETE` | `/api/memories/connections/:id` | 6 |
| `GET` | `/api/questions` | 7 |
| `GET` | `/api/questions/:id` | 7 |
| `PATCH` | `/api/questions/:id` | 7 |
| `DELETE` | `/api/questions/:id` | 7 |
| `GET` | `/api/identity` | 8 |
| `POST` | `/api/identity/generate` | 8 |
| `GET` | `/api/identity/history` | 8 |
| `GET` | `/api/memory-settings` | 11 |
| `PATCH` | `/api/memory-settings` | 11 |

All routes: `requireAuth` → `userId` scoped.

---

## 17. Frontend Views Summary

| Component | Location | Phase | Status |
|-----------|----------|-------|--------|
| `ExtractionReview` modal | `components/memory/ExtractionReview.tsx` | 4 | Done |
| `MemoriesTab` | `components/memory/MemoriesTab.tsx` | 10 | Done |
| `MemoryRow` | `components/memory/MemoryRow.tsx` | 10 | Done |
| `CreateMemoryDialog` | `components/memory/CreateMemoryDialog.tsx` | 10 | Done |
| `QuestionsTab` | `components/memory/QuestionsTab.tsx` | 10 | Done |
| `IdentityTab` | `components/memory/IdentityTab.tsx` | 10 | Done |
| `StatsTab` | `components/memory/StatsTab.tsx` | 10 | Done (on Dashboard) |
| `SessionStartQuestions` | `components/session/SessionStartQuestions.tsx` | 7 | Deferred |
| `MemoryGraph` | `components/memory/MemoryGraph.tsx` | 10 | Deferred (optional) |
| `/settings/memory` page | `app/(main)/settings/memory/page.tsx` | 10 | Done |
| `MemorySettings` | `components/settings/MemorySettings.tsx` | 11 | TODO |
| `useMemories` hook | `hooks/useMemories.ts` | 10 | Done |
| `useQuestions` hook | `hooks/useQuestions.ts` | 10 | Done |
| `useIdentity` hook | `hooks/useIdentity.ts` | 10 | Done |

---

## 18. Open Questions & Decisions

### D1: Storage Backend

**Decision**: PostgresMemoryStore first. FileMemoryStore and HybridMemoryStore are future options enabled by the interface abstraction. No work needed now.

### D2: Extraction Model

**Options**:
1. Use user's configured default model (could be expensive)
2. Hardcode cheapest model
3. User-configurable in memory settings

**Recommendation**: Option 3 with default to cheapest available.

### D3: Memory Approval UX

**For manual "Reflect" (Phase 4)**: Blocking modal — user reviews and approves.
**For auto-extraction (Phase 9)**: Auto-save above threshold, `pending_review` below. Non-blocking.

### D4: Desktop Offline

**Decision**: Cloud-only for now. Desktop requires cloud connection for auth/chat already. Revisit with `SQLiteMemoryStore` if offline mode is prioritized.

### D5: Vector Embeddings

**Decision**: Skip. Add pgvector in a future phase if keyword + graph retrieval proves insufficient.

### D6: Memory Decay

**Decision**: Manual archiving via `status: "archived"`. No automatic time-based decay.

### D7: Continuity Framework Package

**Decision**: Option B — build our own implementation referencing the continuity framework's interface and patterns. The npm package cannot be used due to hardcoded file storage, no DI for custom stores, and no multi-user support.

---

## 19. Appendix: File Change Map

### Phase 1 — MemoryStore Interface & Postgres
```
backend/src/lib/memory/types.ts                              # NEW — all type definitions
backend/src/lib/memory/storage/memory-store.interface.ts     # NEW — full interface
backend/src/lib/memory/storage/postgres-memory-store.ts      # NEW — Postgres impl (memory + evidence)
backend/src/lib/memory/storage/index.ts                      # NEW — store factory
backend/src/lib/db/schema.ts                                 # MODIFY — add memories, memory_evidence
```

### Phase 2 — Memory Service & API
```
backend/src/lib/memory/memory.service.ts                     # NEW
backend/src/lib/memory/index.ts                              # NEW — exports
backend/src/app/api/memories/route.ts                        # NEW
backend/src/app/api/memories/[id]/route.ts                   # NEW
```

### Phase 3 — Tool Registration & Migration
```
backend/src/lib/tools/modules/continuity/index.ts            # NEW — tool module
backend/src/lib/tools/modules/index.ts                       # MODIFY — add continuityModule
backend/src/lib/tools/providers/builtin.ts                   # MODIFY — handle null integrationId
backend/scripts/migrate-obsidian-memories.ts                 # NEW — one-time migration
```

### Phase 4 — Extraction Pipeline
```
backend/src/lib/memory/extraction.service.ts                 # NEW
backend/src/lib/db/schema.ts                                 # MODIFY — add reflections
backend/src/lib/memory/storage/postgres-memory-store.ts      # MODIFY — impl reflection methods
backend/src/app/api/memories/extract/route.ts                # NEW
backend/src/app/api/memories/extract/confirm/route.ts        # NEW
renderer/src/components/memory/ExtractionReview.tsx           # NEW
renderer/src/lib/api/client.ts                               # MODIFY — add extraction methods
```

### Phase 5 — Context Injection
```
backend/src/lib/memory/context-retrieval.service.ts          # NEW
backend/src/lib/services/chat/chat.service.ts                # MODIFY — inject memory context
```

### Phase 6 — Connections & Graph
```
backend/src/lib/db/schema.ts                                 # MODIFY — add memory_connections
backend/src/lib/memory/storage/postgres-memory-store.ts      # MODIFY — impl connection methods
backend/src/lib/memory/context-retrieval.service.ts          # MODIFY — graph expansion
backend/src/lib/memory/extraction.service.ts                 # MODIFY — connection suggestions
backend/src/app/api/memories/[id]/connections/route.ts       # NEW
backend/src/app/api/memories/[id]/graph/route.ts             # NEW
backend/src/app/api/memories/connections/[id]/route.ts       # NEW
renderer/src/components/memory/MemoryGraph.tsx                # NEW (optional)
```

### Phase 7 — Questions
```
backend/src/lib/db/schema.ts                                 # MODIFY — add questions, question_memory_links
backend/src/lib/memory/storage/postgres-memory-store.ts      # MODIFY — impl question methods
backend/src/lib/memory/question.service.ts                   # NEW
backend/src/lib/memory/context-retrieval.service.ts          # MODIFY — include questions
backend/src/app/api/questions/route.ts                       # NEW
backend/src/app/api/questions/[id]/route.ts                  # NEW
renderer/src/hooks/useQuestions.ts                            # NEW
renderer/src/components/memory/QuestionsList.tsx              # NEW
renderer/src/components/session/SessionStartQuestions.tsx     # NEW
renderer/src/lib/api/client.ts                               # MODIFY — add question methods
```

### Phase 8 — Identity
```
backend/src/lib/db/schema.ts                                 # MODIFY — add identity_documents
backend/src/lib/memory/storage/postgres-memory-store.ts      # MODIFY — impl identity methods
backend/src/lib/memory/identity.service.ts                   # NEW
backend/src/lib/memory/context-retrieval.service.ts          # MODIFY — prepend identity
backend/src/app/api/identity/route.ts                        # NEW
backend/src/app/api/identity/generate/route.ts               # NEW
backend/src/app/api/identity/history/route.ts                # NEW
renderer/src/components/memory/IdentityView.tsx               # NEW
```

### Phase 9 — Background Jobs
```
backend/src/lib/jobs/queue.ts                                # NEW — pg-boss setup
backend/src/lib/jobs/handlers/memory-extract.ts              # NEW
backend/src/lib/jobs/handlers/identity-generate.ts           # NEW
backend/src/lib/services/session/session.service.ts          # MODIFY — queue on archive
```

### Phase 10 — Memory Management Page
```
renderer/src/app/memories/page.tsx                           # NEW
renderer/src/app/memories/layout.tsx                         # NEW
renderer/src/components/memory/MemoryList.tsx                 # NEW
renderer/src/components/memory/MemoryEditor.tsx               # NEW
renderer/src/components/memory/MemoryStats.tsx                # NEW
renderer/src/hooks/useMemories.ts                            # NEW
renderer/src/lib/api/client.ts                               # MODIFY — memory CRUD methods
```

### Phase 11 — Settings
```
backend/src/lib/db/schema.ts                                 # MODIFY — add memory_settings
backend/src/app/api/memory-settings/route.ts                 # NEW
renderer/src/components/settings/MemorySettings.tsx           # NEW
renderer/src/components/settings/index.ts                    # MODIFY — add export
```

---

## 20. Implementation Notes (from Phases 1–2)

Practical learnings discovered during implementation. Future phase developers should read this.

### 20.1 Drizzle `real` Import

`drizzle-orm/pg-core` doesn't export `real` by default in most examples. Any phase adding float/real columns (e.g., `memory_connections.strength`, `questions.curiosity_score`) must add `real` to the import from `drizzle-orm/pg-core` in `schema.ts`.

### 20.2 No `getById` on MemoryStore Interface

The `MemoryStore` interface has `loadMemories(filters)` but no direct single-record lookup by ID. `MemoryService.getById()` imports `db` and `schema` directly for a targeted query. Future services (QuestionService, IdentityService) will face the same pattern. Two options:
1. Accept that services can access `db` directly for simple lookups alongside using the store
2. Add `getById(userId, id)` methods to the interface (breaking change to all implementations)

Current choice: option 1. Keep the store interface focused on filtered/bulk operations.

### 20.3 Store vs Service Boundary

- **Store**: Pure CRUD against Postgres tables. No validation, no side effects, no ID generation.
- **Service**: Validation, ID prefix generation (`mem_`, `q_`, etc.), dedup checks, `touchMemory` side effects, evidence attachment on create, error wrapping.

Future services (ExtractionService, QuestionService, IdentityService) should follow the same split.

### 20.4 Next.js 15 Async Route Params

Next.js 15 uses `params: Promise<{ id: string }>` (async params). All `[id]` route handlers must declare:
```typescript
interface RouteParams {
  params: Promise<{ id: string }>;
}
```
And destructure with `const { id } = await params;`.

### 20.5 Service Registration

New services should be added to `backend/src/lib/services/index.ts` for consistent imports via `@/lib/services`. However, the memory module also has its own barrel at `backend/src/lib/memory/index.ts` — routes can import from either. Pick one and be consistent per module.

### 20.6 Internal Tool Modules (No integrationId) — DONE

~~The existing `ToolModule` pattern requires `integrationId` to find an external client.~~ **Already implemented in Phase 3.** Changes made:
- `ToolModule.integrationId` is now `string | null` in `types.ts`
- `BuiltinToolProvider.refresh()` has a second loop that loads modules with `integrationId === null`, calling `createTools(null)`
- `getToolModulesByIntegration()` skips null-integration modules to avoid false matches
- The continuity module uses `defineToolModule<null>({ integrationId: null, ... })`

Any future internal modules should follow this same pattern.

### 20.7 Continuity Tool — Context Access

The tool's `execute` function receives `ToolExecutionContext` which provides `userId` and `sessionId`. The tool uses `sessionId` as evidence source when saving memories (via `CreateEvidenceInput.sourceId`). Phase 4's extraction service will also need `sessionId` to link reflections.

### 20.8 Completed File Inventory (Phases 1-3)

New files created:
```
backend/src/lib/memory/types.ts                              # All type definitions
backend/src/lib/memory/storage/memory-store.interface.ts     # Full MemoryStore interface
backend/src/lib/memory/storage/postgres-memory-store.ts      # Postgres implementation (memory + evidence)
backend/src/lib/memory/storage/index.ts                      # Store factory singleton
backend/src/lib/memory/memory.service.ts                     # Service layer with business logic
backend/src/lib/memory/index.ts                              # Barrel exports
backend/src/app/api/memories/route.ts                        # GET (list/search) + POST (create)
backend/src/app/api/memories/[id]/route.ts                   # GET + PATCH + DELETE
backend/src/lib/tools/modules/continuity/index.ts            # AI tool module (save/find/update/supersede)
```

Modified files:
```
backend/src/lib/db/schema.ts                                 # Added memories + memory_evidence tables
backend/src/lib/services/index.ts                            # Added memory exports
backend/src/lib/tools/types.ts                               # integrationId: string | null
backend/src/lib/tools/providers/builtin.ts                   # Internal module loading
backend/src/lib/tools/modules/index.ts                       # Added continuityModule
```

### 20.9 Phase 4 Learnings

#### 20.9.1 `generateObject` over raw JSON parsing

Used Vercel AI SDK's `generateObject()` with a Zod schema instead of `generateText()` + manual JSON parse. This gives:
- Automatic structured output enforcement (the LLM returns valid JSON matching the schema)
- Type safety from Zod → TypeScript inference
- No need for try/catch JSON parsing or retry loops

Requires `ai` and `zod` packages (both already in backend deps).

#### 20.9.2 `ModelConfig` requires full object

`getLanguageModel()` expects a full `ModelConfig` (id, name, provider, modelId, maxContextTokens). The extraction service constructs this from the simpler `{ provider, modelId }` input. Future services that call LLMs will face the same — consider adding a `getLanguageModelSimple(provider, modelId)` helper if this pattern repeats.

#### 20.9.3 Questions not persisted in Phase 4

The confirm endpoint counts approved questions but does NOT save them to the database — the `questions` table doesn't exist yet (Phase 7). The `questionsGenerated` count in the reflection log tracks intent. Phase 7 will wire `addQuestion()` into the confirm flow.

#### 20.9.4 Transcript is messages-only

The extraction service filters items to `type === "message"` for the transcript. Tool calls and reasoning items are excluded to keep the prompt focused and cheaper. If future extraction needs tool context (e.g., "user asked to search for X"), expand `formatTranscript()` to include tool_call items.

#### 20.9.5 Completed File Inventory (Phase 4)

New files:
```
backend/src/lib/memory/extraction.service.ts                 # LLM extraction + confirm logic
backend/src/app/api/memories/extract/route.ts                # POST trigger
backend/src/app/api/memories/extract/confirm/route.ts        # POST save approved
renderer/src/components/memory/ExtractionReview.tsx           # Review modal UI
```

Modified files:
```
backend/src/lib/db/schema.ts                                 # Added reflections table
backend/src/lib/memory/storage/postgres-memory-store.ts      # Implemented saveReflection, loadReflections
renderer/src/lib/api/client.ts                               # Added extractMemories, confirmExtraction methods
```

### 20.10 Phase 5 Learnings — Context Injection

#### 20.10.1 Context Retrieval Algorithm

`ContextRetrievalService.getRelevantMemories()` implements:
1. Keyword extraction from last N user messages (stop-word filtering, frequency ranking)
2. `searchMemories()` for content matches + supplement with recent high-confidence memories
3. Graph expansion (1-hop via `getGraph()`, added in Phase 6) with 0.7x distance penalty
4. Composite scoring: `confidence × 0.5 + recency × 0.3 + scopeBoost × 0.4`
5. Content-based dedup (word overlap > 0.8 threshold)
6. Fire-and-forget `touchMemory()` on all returned memories

#### 20.10.2 Non-breaking Chat Integration

Memory injection in `ChatService.prepareChat()` is wrapped in try/catch — if memory retrieval fails, chat continues without memories. The memory section is appended after the user's system prompt.

#### 20.10.3 formatMemoryContext Signature

`formatMemoryContext()` accepts a `ContextResult` object (not just `Memory[]`). It renders:
- `## Identity` section (if identity document exists, Phase 8)
- `## What I Remember` section (memories with type + confidence)
- `## Things I've Been Wondering` section (pending questions, Phase 7)

Returns `null` if all sections are empty.

#### 20.10.4 Completed File Inventory (Phase 5)

New files:
```
backend/src/lib/memory/context-retrieval.service.ts          # Context retrieval + formatting
```

Modified files:
```
backend/src/lib/services/chat/chat.service.ts                # Memory injection in prepareChat()
```

### 20.11 Phase 6 Learnings — Connections & Graph

#### 20.11.1 Recursive CTE for Graph Traversal

`PostgresMemoryStore.getGraph()` uses raw SQL with a recursive CTE traversing `memory_connections` in both directions (from/to), capped at depth 5, filtering `strength > 0.3`. Returns `GraphResult { nodes, edges }`.

#### 20.11.2 Connection Ownership Verification

All connection operations verify userId ownership by joining through the `memories` table — connections themselves don't have a userId column.

#### 20.11.3 Extraction Connection Suggestions

The extraction prompt now instructs the LLM to suggest `suggestedConnections` on each memory. The confirm endpoint persists these via `store.addConnections()` (non-fatal on error).

#### 20.11.4 Completed File Inventory (Phase 6)

New files:
```
backend/src/app/api/memories/[id]/connections/route.ts       # POST + GET
backend/src/app/api/memories/[id]/graph/route.ts             # GET with depth param
backend/src/app/api/memories/connections/[id]/route.ts       # DELETE
```

Modified files:
```
backend/src/lib/db/schema.ts                                 # Added memory_connections table
backend/src/lib/memory/storage/postgres-memory-store.ts      # Implemented connection methods
backend/src/lib/memory/context-retrieval.service.ts          # Graph expansion in retrieval
backend/src/lib/memory/extraction.service.ts                 # Connection suggestions in prompt
```

### 20.12 Phase 7 Learnings — Questions & Curiosity Loop

#### 20.12.1 Questions Now Persisted in Extraction

~~The confirm endpoint counts approved questions but does NOT save them~~ **Fixed in Phase 7.** `ExtractionService.confirm()` now calls `store.addQuestion()` for each approved question, mapping `sourceMemoryIndices` to real memory IDs via an index→ID map built during the same confirm call.

#### 20.12.2 QuestionService Scope-Aware Surfacing

`QuestionService.getPendingForSession()` first fetches scope-matched pending questions, then fills remaining slots from top unscoped questions. This ensures relevant questions surface first.

#### 20.12.3 Completed File Inventory (Phase 7)

New files:
```
backend/src/lib/memory/question.service.ts                   # QuestionService singleton
backend/src/app/api/questions/route.ts                       # GET (list with filters)
backend/src/app/api/questions/[id]/route.ts                  # GET + PATCH + DELETE
```

Modified files:
```
backend/src/lib/db/schema.ts                                 # Added questions + question_memory_links tables
backend/src/lib/memory/storage/postgres-memory-store.ts      # Implemented question methods
backend/src/lib/memory/extraction.service.ts                 # Question persistence in confirm()
backend/src/lib/memory/context-retrieval.service.ts          # Questions in context injection
backend/src/lib/memory/index.ts                              # Added QuestionService exports
```

### 20.13 Phase 8 Learnings — Identity Document

#### 20.13.1 Identity Generation via LLM

`IdentityService.generate()` loads all active memories, groups by type, sends to LLM via `generateObject()` with a Zod schema matching `IdentityContent`. Uses a cheap model (gpt-4o-mini). Saves new version and deactivates all previous.

#### 20.13.2 Version Management

`PostgresMemoryStore.updateIdentity()` finds max version for user via SQL, deactivates all previous documents, then inserts a new one with version+1. Only one document is active per user at a time.

#### 20.13.3 Completed File Inventory (Phase 8)

New files:
```
backend/src/lib/memory/identity.service.ts                   # IdentityService singleton
backend/src/app/api/identity/route.ts                        # GET active identity
backend/src/app/api/identity/generate/route.ts               # POST generate new version
backend/src/app/api/identity/history/route.ts                # GET version history
```

Modified files:
```
backend/src/lib/db/schema.ts                                 # Added identity_documents table
backend/src/lib/memory/storage/postgres-memory-store.ts      # Implemented identity methods
backend/src/lib/memory/context-retrieval.service.ts          # Identity in context injection
backend/src/lib/memory/index.ts                              # Added IdentityService exports
```

### 20.14 What the Next Developer Needs to Know

1. **DB schema not yet pushed** — Run `cd backend && npm run db:push` against a Postgres instance to create all tables (memories, memory_evidence, memory_connections, reflections, questions, question_memory_links, identity_documents). No migration files were generated; using Drizzle push.

2. **Old memory tool still registered** — `memoryModule` (Obsidian-based) is still in `allToolModules` alongside `continuityModule`. Remove it when ready to cut over.

3. **No tests written** — Phases 1-8 focused on implementation. Consider adding tests for `PostgresMemoryStore`, `MemoryService`, `ExtractionService`, `ContextRetrievalService`, `QuestionService`, and `IdentityService`.

4. **ExtractionReview component not yet wired** — The `<ExtractionReview>` modal component exists but isn't imported/rendered anywhere yet. A "Reflect" button in the session header should open it with the session's ID.

5. **Extraction exports not in barrel** — `ExtractionService` and `getExtractionService` are imported directly from `@/lib/memory/extraction.service` in routes. Add to `@/lib/memory/index.ts` and `@/lib/services/index.ts` if you want consistent barrel imports.

6. **All store methods implemented** — `PostgresMemoryStore` has no more `NotImplementedError` stubs. All memory, evidence, connection, question, identity, and reflection methods are live.

7. **Context injection is live** — `ChatService.prepareChat()` automatically injects memories, questions, and identity into the system prompt. This is non-blocking (try/catch wrapped).

8. **Phase 9 dependency** — Background jobs (pg-boss) need to be set up. The extraction and identity services are ready to be called from job handlers.

### 20.15 Phase 10 Learnings — Memory Management UI

#### 20.15.1 Route Location

Memory management lives at `/settings/memory` (not `/memories`), fitting the existing settings pattern in the sidebar. Stats tab was moved to `/dashboard` per UX decision.

#### 20.15.2 API Client Type Casting

The `APIClient.request<T>()` returns `Promise<T>` but internally returns `Record<string, unknown>`. Hooks need `as unknown as Promise<ConcreteType>` double-cast for strict TypeScript. This is a known trade-off of the generic client approach.

#### 20.15.3 React Query Pattern

All hooks follow the same pattern as `useSessions`: `useQuery` for reads, `useMutation` for writes, `invalidateQueries` on success. Query keys use factory functions from `keys.ts` for proper cache invalidation.

#### 20.15.4 Inline Editing

Memory editing uses inline expand (not a modal or separate page). The `MemoryRow` component manages edit state locally with `useState`. On save, it calls the parent's `onUpdate` callback.

#### 20.15.5 Completed File Inventory (Phase 10)

New files:
```
renderer/src/types/memory.ts                               # Frontend types (dates as strings)
renderer/src/hooks/useMemories.ts                          # React Query hooks for memory CRUD
renderer/src/hooks/useQuestions.ts                         # React Query hooks for questions
renderer/src/hooks/useIdentity.ts                          # React Query hooks for identity
renderer/src/app/(main)/settings/memory/page.tsx           # Page with 3 tabs
renderer/src/components/memory/MemoriesTab.tsx             # Filter bar + memory list
renderer/src/components/memory/MemoryRow.tsx               # Expandable row with inline edit
renderer/src/components/memory/CreateMemoryDialog.tsx      # Manual memory creation modal
renderer/src/components/memory/QuestionsTab.tsx            # Question list with resolve/delete
renderer/src/components/memory/IdentityTab.tsx             # Identity doc view + regenerate
renderer/src/components/memory/StatsTab.tsx                # Stats by type/status/confidence
```

Modified files:
```
renderer/src/lib/api/client.ts                             # Added 11 memory/question/identity methods
renderer/src/lib/query/keys.ts                             # Added memories, questions, identity keys
renderer/src/components/sidebar/Sidebar.tsx                # Added "Memory" nav item
renderer/src/app/(main)/dashboard/page.tsx                 # Added Memory Stats section
```
