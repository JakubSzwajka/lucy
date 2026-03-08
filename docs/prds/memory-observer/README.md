---
status: draft
date: 2026-03-07
author: kuba
gh-issue: null
---

# Memory Observer

## Problem

Agent conversations are ephemeral. Each session starts from zero — the agent has no memory of past interactions, preferences discovered, or facts established. The `agents-memory` plugin has hooks wired (`onRunComplete`, `prepareContext`) but no actual observation, extraction, or storage logic. There's nothing watching conversations and learning from them.

## Proposed Solution

Build an async observation loop inside `agents-memory` that:

1. **Watches** conversation JSONL files (`.agents-data/items/{agentId}.jsonl`)
2. **Tracks** a cursor per agent so it only processes new items
3. **Extracts** structured observations via LLM (type, confidence, gate, category)
4. **Stores** observations as append-only JSONL
5. **Synthesizes** a `memory.md` that gets injected into future sessions via `prepareContext`

All file-based. No database, no vector store, no external services beyond the LLM call.

### File layout

```
.agents-data/
  items/                      # existing conversation logs
    {agentId}.jsonl
  memory/
    cursor.json               # { "agents": { "<agentId>": <lineOffset> } }
    observations.jsonl        # extracted observations (append-only)
    memory.md                 # curated summary injected into sessions
```

### Observation schema

Each line in `observations.jsonl`:

```json
{
  "id": "uuid",
  "ts": 1709395200,
  "agentId": "source-agent-id",
  "sessionId": "source-session-id",
  "type": "fact | preference | principle | skill | relationship",
  "content": "User prefers file-based storage over databases",
  "confidence": 0.88,
  "gate": "allow | hold",
  "category": "string",
  "supersededBy": null
}
```

- **gate=discard** observations are never written
- **gate=hold** stored but excluded from `memory.md` synthesis
- **gate=allow** feeds into `memory.md`

## Key Cases

- **First run** — no cursor, no observations. Observer scans all existing sessions, extracts, writes initial `memory.md`.
- **After a conversation** — `onRunComplete` triggers. Observer reads new items from cursor, extracts, appends, optionally re-synthesizes `memory.md`.
- **No new content** — cursor is current, observer is a no-op.
- **LLM extraction fails** — cursor does NOT advance. Next run retries same items. Failure is logged, never fatal.
- **prepareContext** — reads `memory.md` from disk, returns it as a system prompt section.

## Incremental Phases

### Phase 1: Observe + Store
- Wire `onRunComplete` to read new items from the triggering agent's JSONL
- Format items as transcript, send to LLM with extraction prompt
- Parse response, append `gate=allow|hold` observations to `observations.jsonl`
- Persist cursor

### Phase 2: Recall via memory.md
- After observation, synthesize `memory.md` from all `gate=allow` observations
- Wire `prepareContext` to read `memory.md` and inject as system prompt section

### Phase 3: Refinement
- Time-decay scoring (older observations fade during synthesis)
- Supersession detection (new observation contradicts old)
- Hold-to-allow promotion (held observations confirmed by repetition)

## Out of Scope

- Vector embeddings or semantic search
- Graph connections between memories
- Multi-user / multi-tenant support
- UI for memory management
- Real-time streaming observation (post-run only)
- Question tracking or identity synthesis
- Swappable memory plugin backends (future)

## Decisions

- **Extraction model** — configured in `lucy.config.json` under `agents-memory.modelId`. Uses the runtime's `ModelProvider` to resolve it.
- **Synthesis cadence** — after every observation run. No separate schedule.
- **memory.md size cap** — max 50 facts (configurable via `agents-memory.maxFacts`, default 50). Oldest/lowest-confidence facts get pruned when over limit.

## References

- [Joel Hooks — The Agent Memory System](https://joelclaw.com/the-memory-system.md) — external spec that inspired the write-gate and observation pipeline
- [Lucy legacy memory system](../../.legacy/src/lib/server/memory/) — reference implementation with graph, questions, identity synthesis
- [agents-memory plugin](../../agents-memory/) — current thin plugin shell to build on
- [agents-runtime data model](../../agents-runtime/README.md#data-model) — Session:Agent:Items relationships
