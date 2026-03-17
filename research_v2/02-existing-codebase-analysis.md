# Existing Codebase Analysis: Memory, Knowledge, and Skill Systems

_Date: 2026-03-16_
_Scope: Full inventory of Lucy's memory/knowledge/skill architecture — what exists, what's planned, how context flows_

---

## 1. Architecture Overview (Three-Layer Split)

Lucy's agent intelligence surface is divided into three layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Harness** | `.pi/extensions/` | Pi SDK hooks — controls what the model sees (prompt injection, memory loop, compaction) |
| **Plumbing** | `src/runtime/` + `src/gateway/` | Process management, HTTP API, SSE streaming, auth — pure infrastructure |
| **Config** | `PROMPT.md` + `.agents/` | Identity definition, accumulated state, skills, knowledge |

The runtime (`src/runtime/core/`) embeds the Pi SDK directly (no subprocess). The gateway (`src/gateway/core/`) wraps it with Hono HTTP routes. Extensions (webui, telegram, landing page) plug into the gateway.

---

## 2. Current Memory Architecture

### 2.1 The Memory Loop

The memory system is a cycle driven by Pi SDK session lifecycle hooks:

```
User conversation
       |
       v
Pi SDK session runs (context accumulates)
       |
       v
Context hits token threshold
       |
       v
Pi SDK fires `session_before_compact` event
       |
       v
.pi/extensions/continuity/index.ts catches the event
       |
       v
Serializes messages-to-be-summarized into text
       |
       v
Runs ContinuitySkill.reflect() — the 3-phase pipeline:
  Phase 1: Classifier LLM call (extract memories, classify into 7 types)
  Phase 2: Scorer LLM call (assign confidence 0.0-1.0 with evidence)
  Phase 3: Generator LLM call (produce curiosity questions from gaps)
       |
       v
Writes results to:
  .agents/memory/MEMORY.md   (structured memories by type)
  .agents/memory/questions.md (pending curiosity questions)
  .agents/memory/reflections/ (JSON logs of each reflection run)
       |
       v
On next agent start (`before_agent_start` event):
  .pi/extensions/continuity/index.ts reads MEMORY.md + questions.md
  Appends them to the system prompt
       |
       v
Agent starts with injected memory context
```

### 2.2 Continuity Extension (`.pi/extensions/continuity/`)

**Entry point:** `index.ts` — a Pi extension that hooks two events:

1. **`before_agent_start`** — Reads `.agents/memory/MEMORY.md` and `.agents/memory/questions.md`, appends their contents to the system prompt with framing prefixes:
   - Memories: _"Recalled memories from previous sessions. Use them as background knowledge."_
   - Questions: _"Questions generated from past reflections. Ask when the moment feels right -- don't force them."_

2. **`session_before_compact`** — When Pi SDK compacts the session, this hook serializes the about-to-be-compacted conversation into text and runs the Continuity Framework's `reflect()` pipeline on it. The compaction summary is currently a placeholder (`"Custom Summary to be implemented"`).

**ContinuitySkill** (`src/index.js`):
- Wraps the Continuity Framework with configuration defaults
- Memory directory: `~/.agents/memory` (overridable via `CONTINUITY_MEMORY_DIR`)
- Minimum 5 user messages before reflection triggers
- Provides `reflect()`, `questions()`, `status()`, `greet()`, `resolve()` methods
- Session hooks: `onSessionStart()` (surface questions), `onSessionEnd()` (trigger reflection)

### 2.3 Continuity Framework (`.pi/extensions/continuity/src/framework/`)

A self-contained framework originally designed as an npm package (`continuity-framework`). Components:

**Orchestrator** (`src/orchestrator.js`):
- Coordinates the 3-phase reflection pipeline
- Each phase can use either LLM sub-agent calls (via `sendMessage` callback) or local fallback heuristics
- Currently uses the `createSendMessage` adapter from `llm-call.js` — direct OpenRouter API calls, bypassing Pi SDK entirely
- Default model: `anthropic/claude-sonnet-4`
- Phases: classify → score → generate questions

**MemoryStore** (`src/memory-store.js`):
- Markdown-based file I/O — no database
- Files: `MEMORY.md` (memories grouped by type), `questions.md` (checklist format with JSON metadata in HTML comments), `identity.md` (self-model), `reflections/` (JSON logs)
- Memory types: fact, preference, relationship, principle, commitment, moment, skill
- Dedup by exact content match (case-insensitive)
- Search by type, tags, or minimum confidence

**LLM Call** (`src/llm-call.js`):
- Thin wrapper around OpenRouter API (direct `fetch`, not Pi SDK)
- Used for sub-agent calls during reflection
- Temperature: 0.3, max tokens: 4096

**Sub-Agent Prompts** (`src/framework/agents/`):
- Each sub-agent has a `SOUL.md` (role definition) and `prompts/*.md` (task template with `{{variables}}`)
- **Classifier**: Extracts memories from conversation, classifies into 7 types, uses a decision tree, flags uncertainty
- **Scorer**: Assigns confidence scores (0.0-1.0) with 4 tiers (explicit/implied/inferred/speculative), source attribution, decay rates
- **Generator**: Produces curiosity questions in 5 categories (gap/implication/clarification/exploration/connection), with timing and sensitivity

**JSON Schemas** (`src/framework/schemas/`):
- `memory-types.schema.json`, `confidence.schema.json`, `curiosity-question.schema.json`, `reflection-job.schema.json`
- Define structured output contracts for each phase

### 2.4 Prompt Context Extension (`.pi/extensions/prompt-context-environment.ts`)

Separate from continuity. Injects current time and timezone into the system prompt on every `before_agent_start` event. Format: `## Context\n\n- Time: Monday, March 16, 2026, 21:30 (Europe/Warsaw)`

### 2.5 System Prompt (`PROMPT.md`)

Root-level file loaded by `DefaultResourceLoader` on runtime init. Defines:
- Lucy's identity, purpose, personality, values, anti-patterns
- The skill/knowledge system architecture
- Knowledge node format (YAML frontmatter + wikilinks in prose)
- Rules: no orphan nodes, max 100 lines per node, root at `[[kuba]]`
- Self-extension protocol: recognize gap → install → test → document as skill → use

### 2.6 Memory Data State

**Current state:** The `.agents/memory/` directory does NOT exist yet. No `MEMORY.md`, `questions.md`, or `identity.md` files are present. The continuity extension is wired up but has not yet produced output — either because compaction hasn't triggered, or because the system was recently restructured.

The Pi session data does exist at `.pi/sessions/--app--/` with a ~459KB JSONL file from March 15.

---

## 3. Skill System

### 3.1 Architecture

Skills live in `.agents/skills/`. Two tiers:

1. **Skills** (`name/SKILL.md`) — Always-discoverable entry points. Name and description loaded at startup. These are capabilities.

2. **Knowledge nodes** (`knowledge/*.md`) — Deep graph of connected markdown files. Not auto-loaded. Discovered via `[[wikilinks]]` or grep.

### 3.2 Current Skills

| Skill | Path | Purpose |
|-------|------|---------|
| **kuba** | `.agents/skills/kuba/SKILL.md` | Root knowledge node. Kuba's identity, stack, projects, thinking style. Everything connects here. |
| **browse** | `.agents/skills/browse/SKILL.md` | Web search (Tavily API) and page fetching (Playwright fallback). CLI: `search` and `fetch` commands. Has its own `node_modules/` (violates CLAUDE.md guidance). |
| **telegram-notify** | `.agents/skills/telegram-notify/SKILL.md` | Send async messages to Kuba via Telegram. CLI-based. Used for reflection summaries, insights, proactive notifications. |

### 3.3 Current Knowledge Nodes

| Node | Path | Content |
|------|------|---------|
| **lucy** | `knowledge/lucy.md` | Lucy's own history and architecture overview |
| **kuba-personal** | `knowledge/kuba-personal.md` | Kuba's personal interests, age, cooking, fitness, career origin |
| **kuba-ai-workflow** | `knowledge/kuba-ai-workflow.md` | How Kuba ships code with AI — two loops (spec then implement), sub-agents |
| **ralph** | `knowledge/ralph.md` | Kuba's agentic workflow runner |
| **mydancedna** | `knowledge/mydancedna.md` | Kuba's dancer directory startup |

### 3.4 How Skills Work

- Skills are CLI scripts invoked via `node path/to/cli.js command --args`
- The agent discovers skills from SKILL.md frontmatter (name + description)
- Skills are executed by the Pi SDK's tool system (the agent uses bash/shell tools to invoke them)
- Knowledge nodes are passive — the agent reads them via file read tools when following wikilinks
- The graph is rooted at `[[kuba]]` — every node must connect to the existing graph (no orphans rule)
- Promotion path: knowledge node used often enough → promote to skill with its own directory

---

## 4. Legacy Memory System (`.legacy/`)

The original Next.js app had a database-backed memory system. Key architectural decisions preserved in `docs/decisions/`:

### 4.1 ADR-0004: Split continuity into memory_read and memory_write tools
- Status: proposed
- Split single `continuity` tool into read-only (`find`, `list`) and write (`save`, `update`, `supersede`, `delete`, `resolve_question`) tools
- Allowed granting agents read-only memory access
- Removed Obsidian-backed memory module

### 4.2 ADR-0005: Agent-driven memory reflection
- Status: implemented
- Replaced hardcoded `generateObject()` extraction with agent-config-driven reflection
- Reflection agent runs as a real agent session with tool access (read existing memories, create new ones)
- Multi-turn reasoning enables smarter dedup
- Reflection sessions serve as audit trail (replaced reflections table)
- User-configurable: pick system prompt, model, and tools for reflection via UI

### 4.3 ADR-0012: Replace memory list with tag-based retrieval
- Status: proposed
- Replaced brute-force `list` (dump all memories) with `list_tags` (browse tags first, then query)
- Forces associative retrieval instead of context-dumping
- Modeled on human memory: recall topics first, then specific memories by association

### 4.4 Legacy Data Model

```
PostgreSQL schema:
- memories table with: id, userId, type, content, confidence, tags (jsonb), status, source_quote, context
- reflections table (audit logs)
- memory_settings table (per-user config: reflectionAgentConfigId, autoExtract flag)
- questions table (curiosity questions from reflection)
```

The legacy system used `MemoryService` (singleton), `MemoryStore` interface with Postgres implementation, tag-based search, and auto-reflection triggered by conversation activity.

**None of this legacy database-backed code exists in the current codebase.** The `.legacy/` directory is archived reference only. The current system uses flat markdown files.

---

## 5. Context Flow: How Knowledge Reaches the Agent

### 5.1 Startup Flow

```
1. Gateway starts (src/gateway/core/src/index.ts)
   |
2. initRuntime() creates AgentRuntime
   |
3. AgentRuntime.init() (src/runtime/core/src/runtime/agent-runtime.ts):
   a. Reads PI_MODEL env var, creates model via pi-ai
   b. Creates DefaultResourceLoader with:
      - cwd: process.cwd()
      - agentDir: PI_CODING_AGENT_DIR env var (default: undefined → Pi defaults)
      - appendSystemPrompt: contents of PROMPT.md
   c. ResourceLoader.reload() — loads Pi's built-in system prompt + appends PROMPT.md
   d. SessionManager.continueRecent() — picks up latest session
   e. createAgentSession() — creates Pi SDK session with model, resourceLoader, sessionManager
   |
4. Pi SDK loads extensions from .pi/extensions/:
   a. prompt-context-environment.ts registers before_agent_start hook
   b. continuity/index.ts registers before_agent_start + session_before_compact hooks
   |
5. Extensions run registered init logic, skill is created
```

### 5.2 Per-Message Flow

```
1. User sends message via HTTP POST /api/chat
   |
2. Gateway calls runtime.sendMessageStreaming(message)
   |
3. Pi SDK fires before_agent_start:
   a. prompt-context-environment.ts: appends current time to system prompt
   b. continuity/index.ts: reads MEMORY.md + questions.md, appends to system prompt
   |
4. Pi SDK runs agent loop:
   - System prompt = Pi defaults + PROMPT.md + time context + memory context + questions
   - User message = the chat input
   - Agent can use tools (bash, file read/write, etc.) — including invoking skills via CLI
   |
5. Agent responds, possibly using tools, multiple turns
   |
6. If context hits token threshold → Pi SDK triggers compaction:
   a. continuity/index.ts session_before_compact fires
   b. Serializes conversation, runs 3-phase reflection pipeline
   c. Writes extracted memories/questions to .agents/memory/
   d. Returns compaction summary (currently placeholder)
   |
7. Session continues with compacted context
```

### 5.3 Knowledge Discovery Flow

```
Agent needs information:
  |
  ├── SKILL.md frontmatter (always loaded at startup via Pi SDK tool discovery)
  │   → Agent knows skill names + descriptions
  │
  ├── Agent reads a SKILL.md → finds [[wikilinks]]
  │   → Resolves: .agents/skills/name/SKILL.md or .agents/skills/knowledge/name.md
  │
  ├── Agent follows links, reads knowledge nodes
  │   → Each node may contain more [[wikilinks]] → graph traversal
  │
  └── Agent can also grep/find in .agents/skills/ to discover content
```

---

## 6. What Was Planned But Not Built

### 6.1 Heartbeat / Event-Driven Activation (PRD: `docs/prds/heartbeat-events/`)

**Status:** Draft PRD, not implemented.

**Concept:** The agent should wake up autonomously on a timer (configurable interval, e.g. 30 min), not only when a user sends a message. Heartbeat ticks would trigger reflection, memory review, task checking, or proactive messages.

**Key design elements:**
- Event-driven interface on runtime (user message = just one event type)
- Composable prompt sections (different instructions per event type)
- Heartbeat output routing (some results go to user, some are internal state changes)
- Suppression during active conversation

**Why it matters for memory:** Heartbeats are the intended trigger for regular reflection — not just on compaction. Without them, memory reflection only fires when token limits are hit, which is infrequent and unpredictable.

### 6.2 Memory Extension as Runtime Package

**From CLAUDE.md architecture diagram:**
```
src/runtime/extensions/memory/ - Memory observer (package: agents-memory)
```

This directory does NOT exist. The memory system was planned to live in `src/runtime/extensions/memory/` as a proper runtime extension package (`agents-memory`). Instead, it currently lives in `.pi/extensions/continuity/` as a Pi SDK extension — which is the correct layer per the harness architecture decision, but the original plan was different.

### 6.3 Identity System

The Continuity Framework includes an `identity.md` file concept — a self-model with:
- Core values
- Growth narrative
- Capabilities
- Key relationships

The `MemoryStore` has full `loadIdentity()`, `saveIdentity()`, `updateIdentity()` methods. The `ContinuityFramework` exposes `getIdentity()` and `updateIdentity()`. But the identity file is never written to by the current system — no part of the pipeline produces identity updates. The `.agents/memory/` directory doesn't even exist yet.

### 6.4 Structured Compaction Summary

The `session_before_compact` hook returns a placeholder summary:
```
"Custom Summary to be implemented. As soon as you will hit one, notify Kuba."
```

Pi SDK supports structured summaries (Goal / Constraints / Progress / Key Decisions / Next Steps / Critical Context). This is noted as a Pi advantage in `docs/findings/harness-convergence-analysis.md` but not implemented.

### 6.5 Database-Backed Memory (Legacy)

The legacy system had PostgreSQL-backed memory with:
- Proper search (tag-based retrieval per ADR-0012)
- Memory CRUD via tools
- Agent-driven reflection via ChatService (ADR-0005)
- Confidence scoring and decay
- Per-user settings

None of this was ported to the current system. The current system uses flat markdown files with no search beyond grep, no CRUD tools for the agent, and no decay mechanism.

### 6.6 Memory Read/Write Tools for the Agent

In the legacy system, the agent could actively read and write memories via tools (`memory_read`, `memory_write` per ADR-0004). In the current system, the agent has no dedicated memory tools — memories are only extracted passively during compaction. The agent can read/write files in `.agents/` using general file tools, but there's no structured memory API.

### 6.7 Research Document

The heartbeat PRD references `docs/research/2026-03-14-context-memory-harness.md` — described in MEMORY.md as "Deep research on context engineering, memory systems, agent harnesses (Anthropic, Manus, Ars Contexta, MemGPT, etc.)". This file does not exist in the current codebase.

---

## 7. Design Principles (Extracted from Decisions and Memory)

### 7.1 Memory as Session Handoff

From `project_session_boundary.md`: "Memory IS the session handoff mechanism." The core problem is that single sessions cause token explosion. The solution is virtual session breaks — externalize state to files, start fresh, reload from files. Memory must be good enough to maintain continuity across session boundaries.

### 7.2 Respect the Pipeline Complexity

From `feedback_continuity_skill.md`: Don't simplify the 3-phase continuity pipeline (classify/score/generate). It's a deliberate research exploration, not premature engineering. Work with the existing architecture rather than flattening it.

### 7.3 Harness vs. Plumbing Boundary

The harness (what the model sees) belongs in `.pi/extensions/`. The plumbing (HTTP, streaming, auth) belongs in `src/`. Config (identity, accumulated state) belongs in `PROMPT.md` + `.agents/`. This three-layer split is intentional and should be maintained.

### 7.4 Multi-Role Agent

Lucy serves multiple roles (personal assistant, coding agent, research agent). Architecture decisions should not over-optimize for any single role. Role differences are primarily in prompt architecture (what context to inject, what memory to surface), not code architecture.

### 7.5 Self-Extension

From `PROMPT.md`: The agent should recognize capability gaps, install tools, write CLI wrappers, and document them as skills. Skills grow through use. The loop: recognize gap → check if self-installable → install & test → create SKILL.md → use it.

---

## 8. Gaps and Observations

### 8.1 Memory Is Not Running

The `.agents/memory/` directory doesn't exist. No MEMORY.md, no questions.md, no reflections. The continuity extension is wired but hasn't produced output. Possible reasons:
- Compaction hasn't triggered yet (session not long enough)
- The `ContinuitySkill` constructor calls `new ContinuitySkill()` but `init()` is never called before `reflect()` — the code at line 72 of `src/index.js` calls `this._ensureInit()` which throws if `init()` wasn't called. However, the Pi extension's `session_before_compact` handler calls `skill.reflect()` directly without calling `skill.init()` first. This is likely a bug.

### 8.2 No Active Memory Writing

The agent has no tools to actively create, update, or delete memories during a conversation. Memory creation is purely passive (compaction-triggered reflection). This is a step backward from the legacy system where the agent had `memory_write` tools.

### 8.3 Knowledge Graph Is Sparse

Only 5 knowledge nodes exist. The graph has limited depth. The system is designed for organic growth but hasn't been used enough to accumulate significant knowledge.

### 8.4 Compaction Summary Is Broken

The `session_before_compact` hook returns a hardcoded placeholder string instead of a real summary. When compaction fires, the agent loses context quality.

### 8.5 Reflection Makes Direct API Calls

The continuity framework's `llm-call.js` calls OpenRouter directly via `fetch`, completely bypassing Pi SDK's model system. This means reflection costs aren't tracked in session stats, the model used for reflection may differ from the main agent's model, and there's no abort/cancellation support.

### 8.6 No Decay Mechanism

Confidence decay rates are defined in types.js (e.g., preference: 0.1, commitment: 0.2) but no code ever applies decay. Memories don't age out or lose confidence over time.

### 8.7 Browse Skill Has Local Dependencies

`.agents/skills/browse/` has its own `package.json` and `node_modules/`, which violates the guidance in CLAUDE.md that says to add deps to the project root instead.

---

## 9. File Index

### Core Memory System
- `.pi/extensions/continuity/index.ts` — Pi extension entry point (hooks)
- `.pi/extensions/continuity/src/index.js` — ContinuitySkill class
- `.pi/extensions/continuity/src/local-storage.js` — File I/O for sessions
- `.pi/extensions/continuity/src/framework/src/index.js` — ContinuityFramework class
- `.pi/extensions/continuity/src/framework/src/orchestrator.js` — 3-phase reflection pipeline
- `.pi/extensions/continuity/src/framework/src/memory-store.js` — Markdown memory I/O
- `.pi/extensions/continuity/src/framework/src/llm-call.js` — Direct OpenRouter API calls
- `.pi/extensions/continuity/src/framework/src/types.js` — Type definitions, constants, validators

### Sub-Agent Definitions
- `.pi/extensions/continuity/src/framework/agents/classifier/SOUL.md` — Classifier role
- `.pi/extensions/continuity/src/framework/agents/classifier/prompts/classify.md` — Classification prompt
- `.pi/extensions/continuity/src/framework/agents/scorer/SOUL.md` — Scorer role
- `.pi/extensions/continuity/src/framework/agents/scorer/prompts/score.md` — Scoring prompt
- `.pi/extensions/continuity/src/framework/agents/generator/SOUL.md` — Generator role
- `.pi/extensions/continuity/src/framework/agents/generator/prompts/generate.md` — Question generation prompt

### JSON Schemas
- `.pi/extensions/continuity/src/framework/schemas/memory-types.schema.json`
- `.pi/extensions/continuity/src/framework/schemas/confidence.schema.json`
- `.pi/extensions/continuity/src/framework/schemas/curiosity-question.schema.json`
- `.pi/extensions/continuity/src/framework/schemas/reflection-job.schema.json`

### Context Injection
- `.pi/extensions/prompt-context-environment.ts` — Time/timezone injection

### System Prompt
- `PROMPT.md` — Lucy's identity, personality, skill system rules

### Skills
- `.agents/skills/kuba/SKILL.md` — Root knowledge node
- `.agents/skills/browse/SKILL.md` — Web search/fetch
- `.agents/skills/telegram-notify/SKILL.md` — Telegram messaging

### Knowledge Graph
- `.agents/skills/knowledge/lucy.md`
- `.agents/skills/knowledge/kuba-personal.md`
- `.agents/skills/knowledge/kuba-ai-workflow.md`
- `.agents/skills/knowledge/ralph.md`
- `.agents/skills/knowledge/mydancedna.md`

### Runtime
- `src/runtime/core/src/runtime/agent-runtime.ts` — Pi SDK session wrapper
- `src/runtime/core/src/types/domain.ts` — History entries, session info types

### Gateway
- `src/gateway/core/src/index.ts` — Server bootstrap
- `src/gateway/core/src/routes/session.ts` — Session info + new session endpoints
- `src/gateway/core/src/routes/chat.ts` — Chat endpoint

### Design Documents
- `docs/decisions/0004-split-continuity-into-memory-read-and-memory-write-tools.md`
- `docs/decisions/0005-agent-driven-memory-reflection.md`
- `docs/decisions/0012-replace-memory-list-with-tag-based-retrieval.md`
- `docs/findings/harness-convergence-analysis.md`
- `docs/prds/heartbeat-events/README.md`
- `docs/prds/pi-sdk-migration/README.md`
- `docs/prds/new-session/README.md`
