---
status: "accepted"
date: 2026-02-18
decision-makers: "Kuba Szwajka"
---

# Replace fixed memory extraction with agent-config-driven reflection

## Context and Problem Statement

The current memory reflection system (`auto-reflection.service.ts` + `extraction.service.ts`) uses a hardcoded prompt with `generateObject()` to extract memories and questions from conversation windows. It runs as a single LLM call — no tool use, no multi-turn reasoning, no user configurability beyond model selection and thresholds.

Lucy already has a full agent config system (configs with system prompts, models, and tool assignments) and a ChatService capable of running agents with tools. How should we rework memory reflection to leverage the existing agent infrastructure so users can configure the reflection behavior themselves?

## Decision Drivers

* Memory reflection should be configurable — users should choose the system prompt, model, and available tools for reflection via the command center UI
* The agent should be able to use tools (read existing memories for dedup, create/update/supersede memories, create questions) rather than producing a structured JSON blob
* Multi-turn reasoning allows the agent to inspect existing memories before deciding what to extract, producing better dedup
* Reuse existing infrastructure (ChatService, agent configs, sessions) rather than maintaining a parallel execution path
* The reflection agent's session serves as a complete audit trail, replacing the `reflections` table

## Considered Options

* **Option A: Agent-config-driven reflection via ChatService** — add `reflectionAgentConfigId` to memory settings, run reflection as a real agent session
* **Option B: Keep fixed prompt, add tool-use via generateText** — add tools to the extraction call but keep the hardcoded prompt
* **Option C: Status quo** — keep the current `generateObject()` approach

## Decision Outcome

Chosen option: **Option A — Agent-config-driven reflection via ChatService**, because it fully leverages existing agent infrastructure, gives users complete control over reflection behavior, and provides richer audit trails through persisted sessions.

### Consequences

* Good, because users can customize the reflection agent's prompt, model, and tools from the UI
* Good, because multi-turn tool use enables smarter dedup (agent reads existing memories before creating new ones)
* Good, because reflection sessions serve as audit trail — no need for the `reflections` table
* Good, because `autoSaveThreshold` is eliminated — the agent decides what to persist directly
* Bad, because reflection is heavier (creates a session + agent records per run instead of a single LLM call)
* Bad, because if no `reflectionAgentConfigId` is set, reflection cannot run (requires user setup)
* Neutral, because `ExtractionService` stays for manual extraction via the API (not removed)

## Implementation Plan

### Phase 1: Schema + Settings

* **`backend/src/lib/db/schema.ts`**:
  - Add `reflectionAgentConfigId` column to `memory_settings` table — nullable FK to `agentConfigs`
  - Remove `autoSaveThreshold` column from `memory_settings`
  - Remove `extractionModel` column from `memory_settings` (model comes from agent config now)

* **`backend/src/lib/memory/settings.ts`**:
  - Update defaults: remove `autoSaveThreshold` and `extractionModel`
  - Add `reflectionAgentConfigId: null` to defaults

* **`backend/src/app/api/memory-settings/route.ts`**:
  - Accept `reflectionAgentConfigId` in PATCH
  - Validate that the referenced config exists and belongs to the user
  - Remove `autoSaveThreshold` and `extractionModel` from validation

### Phase 2: Agent Execution in Auto-Reflection

* **`backend/src/lib/memory/auto-reflection.service.ts`**:
  - Replace the `ExtractionService.extract()` + auto-confirm flow
  - Load `reflectionAgentConfigId` from memory settings; if null, skip (log warning)
  - Create a temporary session + root agent using the config (via `SessionService.create()` or direct repo call)
  - Build the user message: plain-text transcript of the unreflected conversation window (same formatting as today)
  - Run the agent via `ChatService` non-streaming (`generateText`, not `streamText`) — same pattern planned for delegate agents (Phase 4 notes)
  - After agent completes, advance the reflection window (`lastReflectionItemCount`) as today
  - Remove all `ExtractionService.extract()` and `ExtractionService.confirm()` calls from auto-reflection path
  - Keep concurrency control (session mutex) and `autoExtract` gate unchanged

* **Patterns to follow**:
  - Delegate agent execution pattern from Phase 4 design notes: `ChatService.prepareChat()` → `generateText()` with tools
  - Singleton service pattern for any new service
  - `userId` passed as method parameter

* **Patterns to avoid**:
  - Do NOT create a special "memory agent" type or flag on `agentConfigs` — it's a regular config, referenced by setting
  - Do NOT stream the reflection — it's background work, use `generateText`
  - Do NOT inject existing memories into the system prompt — the agent reads them via tools

### Phase 3: Frontend

* **Memory settings UI** (desktop renderer):
  - Add agent config picker/dropdown for "Reflection Agent"
  - Remove `autoSaveThreshold` and `extractionModel` controls
  - Show empty state / prompt if no configs exist yet

### Phase 4: Cleanup

* **Remove `autoSaveThreshold`** from all code paths (settings types, API validation, auto-reflection logic)
* **Remove `extractionModel`** from all code paths
* **Stop writing to `reflections` table** from auto-reflection (table can stay for now — manual extraction may still use it)
* **Update memory settings types** in `backend/src/lib/memory/types.ts`

### Affected Paths

* `backend/src/lib/db/schema.ts` — memory_settings table
* `backend/src/lib/memory/settings.ts` — defaults
* `backend/src/lib/memory/types.ts` — settings types
* `backend/src/lib/memory/auto-reflection.service.ts` — core change
* `backend/src/app/api/memory-settings/route.ts` — API
* `desktop/renderer/src/` — memory settings UI component (find via grep for memory settings)

### Dependencies

* No new packages required
* Depends on ChatService supporting non-streaming execution (if not already implemented for delegation, this ADR introduces it)

### Configuration

* No new env vars
* User must create an agent config and assign it as the reflection agent in memory settings

### Migration

* Incremental: existing `autoExtract` users won't have a `reflectionAgentConfigId` set — auto-reflection will skip with a warning until they configure one
* `autoSaveThreshold` and `extractionModel` columns can be dropped in a migration after deploy
* `reflections` table stays — no data migration needed

### Verification

- [ ] `reflectionAgentConfigId` column exists on `memory_settings` with FK to `agentConfigs`
- [ ] PATCH `/api/memory-settings` accepts and validates `reflectionAgentConfigId`
- [ ] Auto-reflection creates a session + agent when triggered with a configured reflection agent
- [ ] The reflection agent receives the unreflected conversation window as its user message
- [ ] The reflection agent's system prompt comes from the assigned agent config
- [ ] The reflection agent can use tools (read memories, create memories, etc.) as configured
- [ ] Reflection window advances after agent completes (same as before)
- [ ] No entries written to `reflections` table from auto-reflection path
- [ ] Auto-reflection skips gracefully when `reflectionAgentConfigId` is null
- [ ] `autoSaveThreshold` and `extractionModel` removed from settings types and API
- [ ] Frontend memory settings shows agent config picker

## More Information

* The `ExtractionService` is NOT removed — it remains available for manual extraction via the `/api/memories/extract` route. A future ADR may address converting manual extraction to the agent pattern as well.
* The `reflections` table is not dropped — it may still be written to by manual extraction. Consider dropping it in a future cleanup if manual extraction also moves to agents.
* Revisit this decision if reflection sessions create too much DB bloat (many short-lived sessions). Reflection sessions are identifiable by their agent's `agentConfigId` matching the user's `reflectionAgentConfigId` setting.
