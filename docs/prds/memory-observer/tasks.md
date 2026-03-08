---
prd: memory-observer
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Memory Observer

> Phases 1+2: Wire observation loop that extracts memories from conversations and synthesizes memory.md for injection into future sessions.

## Task List

- [x] **1. Define config types and load from lucy.config.json** — add `agents-memory` config shape with `modelId` and `maxFacts`
- [x] **2. Define observation types** — observation schema, cursor schema, and file path constants
- [x] **3. Build transcript formatter** — convert Item[] to a plaintext transcript string for LLM input
- [x] **4. Build extraction prompt + response parser** — LLM prompt that outputs structured observations, parser that validates the response
- [x] **5. Build cursor tracker** — read/write cursor.json to track last-processed line per agent
- [x] **6. Build observation store** — append observations to JSONL, read all observations back
- [x] **7. Wire the observation loop** — orchestrate: read cursor, read new items, extract, store, advance cursor `[blocked by: 3, 4, 5, 6]`
- [x] **8. Build memory.md synthesizer** — LLM pass that compresses allow-gated observations into memory.md with maxFacts cap `[blocked by: 6]`
- [x] **9. Wire prepareContext to read memory.md** — replace static initialMemory with file-based memory.md read
- [x] **10. Wire onRunComplete to trigger observation + synthesis** — connect the loop to the plugin hook `[blocked by: 1, 7, 8, 9]`
- [x] **11. Smoke test** — extend or add a smoke test that verifies observation extraction and memory.md injection

---

### 1. Define config types and load from lucy.config.json
<!-- status: done -->

Add a typed config interface for the `agents-memory` section in `lucy.config.json`. Fields: `modelId` (required string — which model to use for extraction/synthesis) and `maxFacts` (optional number, default 50). Load this in the plugin's `onInit` hook from the existing `loadConfig()` utility or from the plugin config passed by the runtime.

**Files:** `agents-memory/src/types.ts`, `agents-runtime/src/config/types.ts`, `lucy.config.example.json`
**Depends on:** —
**Validates:** `lucy.config.json` with `"agents-memory": { "modelId": "..." }` is loadable and typed

---

### 2. Define observation types
<!-- status: done -->

Create the `Observation` interface (id, ts, agentId, sessionId, type, content, confidence, gate, category, supersededBy) and `CursorState` interface ({ agents: Record<string, number> }). Define constants for file paths (`memory/cursor.json`, `memory/observations.jsonl`, `memory/memory.md`) relative to the data directory.

**Files:** `agents-memory/src/types.ts`
**Depends on:** —
**Validates:** Types importable and used in subsequent tasks

---

### 3. Build transcript formatter
<!-- status: done -->

Function that takes `Item[]` and returns a plaintext string suitable for LLM extraction. Format each item as a line: `[role/type] content`. Skip tool_call args and tool_result raw output — summarize them as "Called {toolName}" / "Result: {truncated output}". Keep it compact so the extraction prompt has room.

**Files:** `agents-memory/src/transcript.ts`
**Depends on:** —
**Validates:** Given a mix of message/tool_call/tool_result items, produces a readable transcript string

---

### 4. Build extraction prompt + response parser
<!-- status: done -->

Write the system prompt that instructs the LLM to extract observations from a transcript. Each observation must include: type (fact/preference/principle/skill/relationship), content, confidence (0-1), gate (allow/hold/discard), and category. Output format: JSON array. Build a parser that validates the response shape and drops malformed entries rather than throwing.

**Files:** `agents-memory/src/extract.ts`
**Depends on:** —
**Validates:** Given a sample transcript string, prompt + parser produce valid Observation[] with correct fields

---

### 5. Build cursor tracker
<!-- status: done -->

Two functions: `readCursor(dataDir)` returns `CursorState` (or empty default if file missing), and `writeCursor(dataDir, state)` writes it atomically. The cursor value per agent is the line count already processed in that agent's items JSONL.

**Files:** `agents-memory/src/cursor.ts`
**Depends on:** 2
**Validates:** Write then read round-trips correctly; missing file returns default state

---

### 6. Build observation store
<!-- status: done -->

Two functions: `appendObservations(dataDir, observations[])` appends to `observations.jsonl` (one JSON line per observation), and `readObservations(dataDir)` reads all back. Ensure directory is created on first write. Assign UUID ids and timestamps at write time.

**Files:** `agents-memory/src/store.ts`
**Depends on:** 2
**Validates:** Append then read round-trips; empty file returns []

---

### 7. Wire the observation loop
<!-- status: done -->

Orchestration function `observe(deps, config)` that: reads cursor, lists sessions, for each session with new items reads the JSONL from the cursor offset, formats as transcript, calls extraction LLM, filters out gate=discard, appends to store, advances cursor. Takes `ModelProvider` from runtime deps and `modelId` from config to get the language model. Wraps the whole thing in try/catch — failure logs and returns without advancing cursor.

**Files:** `agents-memory/src/observe.ts`
**Depends on:** 3, 4, 5, 6
**Validates:** After running against a session with items, observations.jsonl has entries and cursor.json is advanced

---

### 8. Build memory.md synthesizer
<!-- status: done -->

Function that reads all `gate=allow` observations, sends them to LLM with a synthesis prompt ("compress these into a concise memory document, max N facts, most important and recent first"), and writes the result to `memory/memory.md`. If observations exceed `maxFacts`, drop oldest/lowest-confidence before sending to LLM. Called after every observation run.

**Files:** `agents-memory/src/synthesize.ts`
**Depends on:** 6
**Validates:** Given observations in the store, produces a readable memory.md file

---

### 9. Wire prepareContext to read memory.md
<!-- status: done -->

Update the plugin's `prepareContext` to read `memory/memory.md` from the data directory. If the file exists, return it as a `MemoryContextRecord`. If not, fall back to the existing `initialMemory` / `getContext` config path. This replaces the static config-driven memory with the live observed memory.

**Files:** `agents-memory/src/plugin.ts`
**Depends on:** —
**Validates:** With a memory.md on disk, `prepareContext` returns its content as a system prompt section

---

### 10. Wire onRunComplete to trigger observation + synthesis
<!-- status: done -->

In the plugin's `onRunComplete`, call the observation loop then the synthesizer. Needs access to runtime deps (for `ModelProvider` and `ItemStore`) — capture these from `onInit` which receives `deps`. The observation + synthesis run is fire-and-forget (don't block the runtime), but log errors. Also pass the triggering `sessionId`/`agentId` so the observer can scope to just that session's new items rather than scanning all.

**Files:** `agents-memory/src/plugin.ts`
**Depends on:** 1, 7, 8, 9
**Validates:** After a run completes, observations.jsonl and memory.md are updated; next session's system prompt includes memory

---

### 11. Smoke test
<!-- status: done -->

Extend the existing runtime smoke test or create a new one that: creates a session, sends a message with a memorable fact ("my favorite language is TypeScript"), triggers onRunComplete, then starts a new session and verifies the memory.md content appears in the system prompt via prepareContext.

**Files:** `agents-runtime/scripts/smoke-test.ts` or `agents-memory/scripts/smoke-test.ts`
**Depends on:** 10
**Validates:** End-to-end: conversation → observation → memory.md → injection into next session
