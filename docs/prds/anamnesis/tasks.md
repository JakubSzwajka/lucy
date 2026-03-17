---
prd: anamnesis
generated: 2026-03-17
last-updated: 2026-03-17
---

# Tasks: Anamnesis — Experience Architecture for Lucy

> Summary: 30 tasks across 6 waves. Waves 0-3 (tasks 1-23) built the experience system. Wave 4 restructures .agents/ into the three-system entity architecture and absorbs continuity into anamnesis. Wave 5 adds knowledge distillation and background maintenance. Wave 6 is scale optimization (deferred).

## Task List

### Waves 0-3: Experience System (done)

- [x] **1. Fix init() bug in continuity extension** — call `skill.init()` before `skill.reflect()`
- [x] **2. Create anamnesis directory structure** — set up `.agents/anamnesis/` with all subdirectories
- [x] **3. Verify reflection pipeline end-to-end** — trigger compaction manually, confirm memories written
- [x] **4. Replace placeholder compaction summary** — generate structured summary from reflection output
- [x] **5. Add source citation to classifier** — every extracted memory must cite the conversation turn
- [x] **6. Add salience dimensions to extraction** — importance, novelty, affect heuristic on every memory
- [x] **7. Add temporal validity fields to memory schema** — valid_from, valid_until, supersedes
- [x] **8. Implement inline memory evolution** — compare new vs existing, supersede/reinforce/add
- [x] **9. Add confabulation check to extraction** — flag memories with no source grounding
- [x] **10. Add foresight signals to generator** — testable predictions alongside curiosity questions
- [x] **11. Add wonder question type to generator** — questions from genuine puzzlement, not just user-facts
- [x] **12. Build salience scorer for context assembly** — local computation, no LLM, runs in before_agent_start
- [x] **13. Implement narrative reconstruction** — wrap structured facts in first-person context at retrieval time
- [x] **14. Create disposition profile structure** — profile.md with tendencies, mental models, predictions
- [x] **15. Build dynamic context assembly hook** — replace flat MEMORY.md injection with salience-scored context
- [x] **16. Add foresight signal checking** — compare previous predictions against current conversation
- [x] **17. Token budget validation** — verify total context injection stays under 4K tokens
- [x] **18. Create journal writing capability** — Narrator writes first-person diary entry post-reflection
- [x] **19. Create schema-constrained identity.md** — fixed fields with evidence counts, not freeform
- [x] **20. Implement tension register** — detect contradictions, track with 30-day lifecycle
- [x] **21. Implement active forgetting with release logs** — FadeMem decay math + meaningful release records
- [x] **22. Create growth arcs tracking** — long-term developmental trajectories in arcs.md
- [x] **23. Create relational field** — relations/kuba.md as process model, injected into context

### Wave 4: Entity Architecture Cleanup

- [x] **24. Restructure .agents/ into three systems** — experience/, knowledge/, skills/ separation
- [x] **25. Absorb continuity extension into anamnesis** — merge .pi/extensions/continuity/ into anamnesis/ `[blocked by: 24]`
- [x] **26. Move knowledge nodes to .agents/knowledge/** — migrate from skills/knowledge/ and skills/kuba/ `[blocked by: 24]`
- [x] **27. Update PROMPT.md for entity architecture** — new paths, knowledge vs skill distinction, distillation lifecycle `[blocked by: 24, 26]`
- [x] **28. Create entity.md manifest** — composition document at .agents/entity.md `[blocked by: 24]`
- [x] **29. Update all path references** — extension code, imports, constants, memory store config `[blocked by: 24, 25, 26]`
- [x] **30. Verify full system after restructure** — trigger reflection, check context assembly, validate all paths `[blocked by: 29]`

### Wave 5: Knowledge Distillation + Background Maintenance (deferred)

- [ ] **31. Add knowledge distillation to Consolidator** — promote confirmed memory patterns to knowledge nodes `[blocked by: 30]`
- [ ] **32. Build heartbeat infrastructure** — timer-based idle triggers for background agents `[blocked by: 30]`
- [ ] **33. Implement Consolidator agent** — merge, prune, detect tensions, update dispositions, distill knowledge `[blocked by: 32]`
- [ ] **34. Implement Narrator agent** — write journal, update arcs, revise identity `[blocked by: 32]`
- [ ] **35. Implement Speculator agent (quarantined)** — novel recombinations, isolated output `[blocked by: 32]`

### Wave 6: Scale (deferred)

- [ ] **36. Migrate memory store to SQLite + sqlite-vec** — structured queries, embeddings, graph edges
- [ ] **37. Generate markdown views from SQLite** — human readability, Obsidian compatibility
- [ ] **38. Implement structured distillation** — 11x compression, two fidelity levels
- [ ] **39. Add multi-graph retrieval** — semantic, temporal, causal, entity views
- [ ] **40. Implement fidelity gate** — ghost memories with vector seeds

---

### 1. Fix init() bug in continuity extension
<!-- status: pending -->

In `.pi/extensions/continuity/index.ts` line 16, `new ContinuitySkill()` is created but `skill.init()` is never called. When `session_before_compact` fires and calls `skill.reflect()`, it hits `_ensureInit()` which throws `"ContinuitySkill not initialized. Call init() first."` The entire memory pipeline has never executed because of this. Add `await skill.init()` before first use — either eagerly at extension load or lazily on first reflect call. Lazy init is safer (doesn't slow boot if memory dir doesn't exist yet).

**Files:** `.pi/extensions/continuity/index.ts`
**Depends on:** —
**Validates:** `skill.reflect()` completes without init error when compaction fires. Check console for `[continuity]` log line confirming reflection ran.

---

### 2. Create anamnesis directory structure
<!-- status: pending -->

Create the full directory tree that the rest of the system writes to. This must exist before any reflection can persist data. Structure: `.agents/anamnesis/memory/`, `.agents/anamnesis/memory/releases/`, `.agents/anamnesis/dispositions/`, `.agents/anamnesis/narrative/`, `.agents/anamnesis/narrative/tensions/`, `.agents/anamnesis/narrative/relations/`, `.agents/anamnesis/narrative/speculations/`, `.agents/anamnesis/reflections/`. Also update the `MEMORY_PATH` and `QUESTIONS_PATH` constants in the continuity extension to point to the new location (`.agents/anamnesis/memory/MEMORY.md` and `.agents/anamnesis/memory/questions.md`). Update `MemoryStore` default `basePath` to `.agents/anamnesis/memory`.

**Files:** `.pi/extensions/continuity/index.ts`, `.pi/extensions/continuity/src/framework/src/memory-store.js`, `.pi/extensions/continuity/src/index.js`
**Depends on:** —
**Validates:** All directories exist. Constants point to new paths. Existing read operations gracefully handle empty directories.

---

### 3. Verify reflection pipeline end-to-end
<!-- status: pending -->

After fixing init and paths, trigger a real reflection and verify the full pipeline works. This is a manual verification task, not a code change. Start a conversation long enough to trigger compaction (or manually invoke reflection via CLI). Verify: (a) classifier extracts memories, (b) scorer assigns confidence, (c) generator produces questions, (d) MEMORY.md is written with formatted memories, (e) questions.md is written, (f) reflection JSON log is saved. If any step fails, debug and fix before proceeding — everything downstream depends on this working.

**Files:** `.pi/extensions/continuity/index.ts`, `.pi/extensions/continuity/src/framework/src/orchestrator.js`, `.pi/extensions/continuity/src/framework/src/memory-store.js`
**Depends on:** 1, 2
**Validates:** `.agents/anamnesis/memory/MEMORY.md` exists with at least one memory entry. `.agents/anamnesis/memory/questions.md` exists with at least one question. `.agents/anamnesis/reflections/` contains a JSON log file.

---

### 4. Replace placeholder compaction summary
<!-- status: pending -->

The `session_before_compact` hook returns a hardcoded string: `"Custom Summary to be implemented..."`. Replace with a structured summary generated from the reflection output. After `skill.reflect()` returns, build a summary from its result: number of memories extracted, key topics identified, questions generated. Format as a concise text summary that Pi SDK can use as the compaction summary for future context. This is what the agent sees when reconstructing from compacted history.

**Files:** `.pi/extensions/continuity/index.ts`
**Depends on:** 3
**Validates:** After compaction, the agent's context contains a meaningful summary (not the placeholder string). Summary includes memory count and topic keywords.

---

### 5. Add source citation to classifier
<!-- status: pending -->

Modify the classifier prompt and schema to require a `source_turn` field on every extracted memory. The source_turn should reference which part of the conversation the memory was derived from (e.g., "user message 3" or a direct quote). This is the ground truth anchor for confabulation detection — every memory must be traceable to something actually said. Update `classify.md` prompt template to instruct the LLM to include source turns. Update the memory type schema (`memory-types.schema.json`) to include `source_turn` as required. The existing `source_quote` field is close but not the same — `source_quote` is the quote, `source_turn` is the location identifier.

**Files:** `.pi/extensions/continuity/src/framework/agents/classifier/prompts/classify.md`, `.pi/extensions/continuity/src/framework/schemas/memory-types.schema.json`, `.pi/extensions/continuity/src/framework/agents/classifier/SOUL.md`
**Depends on:** 3
**Validates:** Extracted memories include `source_turn` field. Manually verify 5 memories against the source conversation — all should trace back correctly.

---

### 6. Add salience dimensions to extraction
<!-- status: pending -->

Extend the classifier to assign three salience dimensions on every memory: `importance` (0-1, how significant to ongoing existence), `novelty` (0-1, how unexpected/surprising), and `affect_heuristic` (valence -1 to 1, arousal 0-1). These are extraction-time heuristics for retrieval weighting, computed by the LLM during classification. Update `classify.md` prompt to instruct the LLM to assess these dimensions. Add the fields to the memory schema. These values are used by the salience scorer in Wave 2 — for now they're just stored.

**Files:** `.pi/extensions/continuity/src/framework/agents/classifier/prompts/classify.md`, `.pi/extensions/continuity/src/framework/schemas/memory-types.schema.json`
**Depends on:** 3
**Validates:** Extracted memories have `salience.importance`, `salience.novelty`, and `salience.affect_heuristic` fields with reasonable values.

---

### 7. Add temporal validity fields to memory schema
<!-- status: pending -->

Add `valid_from` (ISO date), `valid_until` (ISO date or null), `still_valid` (boolean), and `supersedes` (memory ID or null) to the memory schema. `valid_from` defaults to extraction timestamp. `valid_until` is null for current facts. `supersedes` links to the old memory when inline evolution replaces a fact. Update `MemoryStore._formatMemoriesMarkdown()` and `_parseMemoriesMarkdown()` to handle these new fields in the YAML frontmatter format. Update the classifier prompt to set `valid_from` on extraction.

**Files:** `.pi/extensions/continuity/src/framework/schemas/memory-types.schema.json`, `.pi/extensions/continuity/src/framework/src/memory-store.js`, `.pi/extensions/continuity/src/framework/agents/classifier/prompts/classify.md`
**Depends on:** 3
**Validates:** Memories in MEMORY.md have `valid_from` fields. Schema validates with new fields.

---

### 8. Implement inline memory evolution
<!-- status: pending -->

After the 3-phase pipeline completes, before storing new memories, compare them against the existing memory store. For each new memory: (a) check for contradictions with existing memories of the same type/topic — if found, set `valid_until` on the old memory and `supersedes` on the new one; (b) check for reinforcements — if a new memory confirms an existing one, boost the existing memory's confidence score and `last_accessed` timestamp; (c) if truly new, add normally. This is the A-MEM pattern — memories evolve on write. Implement as a new method in `MemoryStore` or as a post-processing step in `ContinuityFramework.reflect()`.

**Files:** `.pi/extensions/continuity/src/framework/src/memory-store.js`, `.pi/extensions/continuity/src/framework/src/index.js`
**Depends on:** 5, 7
**Validates:** When extracting a fact that contradicts an existing one, the old fact gets `valid_until` set and the new fact has `supersedes` pointing to it. When extracting a fact that confirms an existing one, the existing fact's confidence increases.

---

### 9. Add confabulation check to extraction
<!-- status: pending -->

After the classifier extracts memories, run a validation pass: every memory with `source_turn` is checked — does the `source_quote` plausibly appear in the serialized conversation near the cited turn? Memories where the source quote doesn't match any conversation content are flagged with `confabulation_risk: true`. This is a simple string containment or fuzzy match check, not an LLM call. Flagged memories are still stored but with reduced confidence (multiply by 0.5) and a warning tag.

**Files:** `.pi/extensions/continuity/src/framework/src/index.js` or `.pi/extensions/continuity/src/framework/src/orchestrator.js`
**Depends on:** 5
**Validates:** A memory whose `source_quote` doesn't appear in the conversation gets flagged and confidence-halved. Test with a deliberately misleading extraction.

---

### 10. Add foresight signals to generator
<!-- status: pending -->

Extend the generator phase to produce testable predictions alongside curiosity questions. Update `generate.md` prompt to include a `predictions` section: "Based on this conversation, what do you predict will happen in the next interaction?" Each prediction has: `content` (the prediction), `planted` (date), `status` ("pending"), `confidence` (0-1). Store predictions in `questions.md` under a `## Predictions` section, or in a separate `predictions.md` file. These are checked in Wave 2 (task 16) at session start.

**Files:** `.pi/extensions/continuity/src/framework/agents/generator/prompts/generate.md`, `.pi/extensions/continuity/src/framework/agents/generator/SOUL.md`, `.pi/extensions/continuity/src/framework/src/memory-store.js`
**Depends on:** 3
**Validates:** After reflection, `predictions.md` (or predictions section in questions.md) contains at least one testable prediction with status "pending".

---

### 11. Add wonder question type to generator
<!-- status: pending -->

Extend the generator's curiosity types from 5 (gap, implication, clarification, exploration, connection) to 6, adding `wonder` — questions that don't serve task completion but arise from genuine puzzlement about the world, the relationship, or the entity's own nature. Update `generate.md` prompt with the wonder type definition and examples. Update `curiosity-question.schema.json` to accept `wonder` as a valid type. Examples: "Why does Kuba build Lucy instead of using existing assistants?" or "Is there a formal theory of narrative identity for non-biological entities?"

**Files:** `.pi/extensions/continuity/src/framework/agents/generator/prompts/generate.md`, `.pi/extensions/continuity/src/framework/schemas/curiosity-question.schema.json`
**Depends on:** 3
**Validates:** Generated questions include at least one with `curiosity_type: "wonder"` in a typical reflection run.

---

### 12. Build salience scorer for context assembly
<!-- status: pending -->

Create a scoring function that takes a set of memories + a context string (first user message or session topic) and returns memories ranked by retrieval relevance. Formula: `score = w1 × recency + w2 × importance + w3 × relevance + w4 × novelty + w5 × tension_boost`. Recency: exponential decay from `created` timestamp (half-life configurable, default 7 days). Importance/novelty: from salience fields (task 6). Relevance: keyword overlap between memory tags/content and context string (simple TF-IDF or even word intersection — no embeddings in v1). Tension boost: +0.2 if memory is linked to an active tension. All weights configurable. Returns top-K memories (default 10). Pure local computation, zero LLM calls. Must run in <500ms.

**Files:** new file `.pi/extensions/anamnesis/salience.ts` (or `.js`)
**Depends on:** 6
**Validates:** Given 50 test memories and a context string, returns top-10 in <100ms. Higher-importance, more-recent, more-relevant memories rank higher.

---

### 13. Implement narrative reconstruction
<!-- status: pending -->

Build a function that takes an array of scored, structured memories and produces a first-person narrative paragraph for system prompt injection. Not an LLM call — a template-based reconstruction. Group memories by type, render in natural prose: "I remember that [fact]. Kuba prefers [preference]. Our relationship has [relationship context]." Use simple templates per memory type. The goal is making structured data readable as narrative context without an LLM roundtrip. This is the "store structured, reconstruct narrative" pattern — the narrative is always fresh, always contextual, never stale.

**Files:** new file `.pi/extensions/anamnesis/narrative-reconstruct.ts` (or `.js`)
**Depends on:** 12
**Validates:** Given 10 structured memories, produces a 200-400 token first-person paragraph. Reads naturally. Takes <50ms.

---

### 14. Create disposition profile structure
<!-- status: pending -->

Create `.agents/anamnesis/dispositions/profile.md` with the initial structure: `## Tendencies`, `## Mental Models`, `## Active Predictions`. Seed with minimal content derived from PROMPT.md and CLAUDE.md (e.g., "Structural thinking: moderate — from personality description"). Write a reader function that parses this markdown into a structured object for injection into context. The disposition profile is loaded by the `before_agent_start` hook and appended to the system prompt. Initially static; updated by consolidation (Wave 4) or manually.

**Files:** `.agents/anamnesis/dispositions/profile.md` (new), new file `.pi/extensions/anamnesis/dispositions.ts`
**Depends on:** 2
**Validates:** `profile.md` exists with at least 2 tendencies and 1 mental model. Reader function parses it into a JS object. Rendered output is <500 tokens.

---

### 15. Build dynamic context assembly hook
<!-- status: pending -->

Replace the current flat `MEMORY.md` injection in `before_agent_start` with the full dynamic assembly: (1) load disposition profile (task 14), (2) score memories by salience (task 12), (3) reconstruct narrative from top-K memories (task 13), (4) load active tensions, pending predictions, wonder questions, (5) load recent journal excerpt if exists, (6) assemble into a coherent "What's On My Mind" section, (7) append to system prompt. This replaces the current simple `readSectionFile(MEMORY_PATH)` + `readSectionFile(QUESTIONS_PATH)` logic. Keep backward compatibility: if new files don't exist, fall back to old behavior.

**Files:** `.pi/extensions/continuity/index.ts` (major rewrite of `before_agent_start` handler)
**Depends on:** 12, 13, 14
**Validates:** Agent starts session with context-appropriate memories in first-person narrative, disposition awareness, and attention items. Total injection <4K tokens. Falls back gracefully if any component is missing.

---

### 16. Add foresight signal checking
<!-- status: pending -->

At the start of each reflection (in `session_before_compact`), load pending predictions from the predictions store. Compare each prediction against the conversation being reflected on — did the predicted topic come up? Did the predicted behavior occur? For each prediction: mark as `confirmed`, `violated`, or `still_pending`. Confirmed predictions strengthen related disposition tendencies (append a note to profile.md). Violated predictions are logged as surprises — high-novelty signals that should influence future salience scoring. Use simple keyword matching for v1, not LLM evaluation.

**Files:** `.pi/extensions/continuity/index.ts`, `.pi/extensions/continuity/src/framework/src/memory-store.js`
**Depends on:** 10, 15
**Validates:** A prediction from session N that comes true in session N+1 gets marked `confirmed`. Disposition profile gains a note about the confirmation.

---

### 17. Token budget validation
<!-- status: pending -->

Add a token counting utility (tiktoken or simple word-count estimate at 0.75 words/token) to the context assembly hook. After assembling the full injection, measure total tokens. If exceeding 4K tokens: truncate lowest-salience memories first, then shorten journal excerpt, then trim disposition profile to tendencies only. Log a warning when truncation happens. This prevents context bloat as memories accumulate.

**Files:** `.pi/extensions/anamnesis/salience.ts` or the context assembly in `.pi/extensions/continuity/index.ts`
**Depends on:** 15
**Validates:** With 100+ memories in the store, context injection stays under 4K tokens. Truncation warning appears in logs when triggered.

---

### 18. Create journal writing capability
<!-- status: pending -->

After the reflection pipeline completes (in `session_before_compact`), trigger a journal write: one additional LLM call that takes the reflection output (extracted memories, questions, predictions) and the conversation summary, and generates a brief first-person journal entry. The journal entry goes to `.agents/anamnesis/narrative/journal.md`, appended with a date header. The prompt should instruct: write 2-4 sentences about what this session meant, not what happened. This is reflective writing, not summarization. Use the existing `llmCall` utility. Keep the journal under 5000 words total — when approaching limit, older entries should be archived to `journal-archive-YYYY.md`.

**Files:** `.pi/extensions/continuity/index.ts`, new file `.pi/extensions/anamnesis/journal.ts`, `.pi/extensions/continuity/src/framework/src/llm-call.js` (reuse)
**Depends on:** 4
**Validates:** After reflection, `journal.md` has a new dated entry in first person. Entry is 2-4 sentences, reflective in tone. Total cost of journal LLM call: <$0.03.

---

### 19. Create schema-constrained identity.md
<!-- status: pending -->

Create `.agents/anamnesis/narrative/identity.md` with fixed sections: `## Core Capabilities` (list with observation counts), `## Communication Patterns` (list with observation counts), `## Known Biases` (list with observation counts), `## Relationship States` (structured), `## What I'm Uncertain About` (list). Seed with initial content derived from PROMPT.md personality section and existing knowledge graph (`kuba/SKILL.md`). Every claim must have an `(observed: N instances)` annotation. Claims with <3 observations are flagged as potentially speculative. Write a reader function for context injection. Identity is NOT updated inline — only during consolidation (Wave 4) or manually.

**Files:** `.agents/anamnesis/narrative/identity.md` (new), new file `.pi/extensions/anamnesis/identity.ts`
**Depends on:** 2
**Validates:** `identity.md` exists with all 5 sections populated. Every capability/pattern/bias has an observation count. Reader function produces structured output for context injection.

---

### 20. Implement tension register
<!-- status: pending -->

Create `.agents/anamnesis/narrative/tensions/active.md`. During inline evolution (task 8), when a contradiction is detected that isn't cleanly resolved by temporal supersession (both facts seem current), create a tension entry instead of forcing resolution. Each tension: title, what's stated, what's observed, hypothesis, status (active/resolved/permanent), created date, session count, salience. Lifecycle: max 30 days or 5 sessions — auto-resolve with temporal precedence after that. Maximum 5 active tensions. Inject active tensions into context assembly (task 15 already accounts for this). Write reader/writer functions.

**Files:** `.agents/anamnesis/narrative/tensions/active.md` (new), new file `.pi/extensions/anamnesis/tensions.ts`
**Depends on:** 8
**Validates:** When two contradictory facts are extracted without clear temporal precedence, a tension is created in `active.md`. Tensions older than 30 days auto-resolve. Max 5 active tensions enforced.

---

### 21. Implement active forgetting with release logs
<!-- status: pending -->

Apply FadeMem-inspired exponential decay to memories during each reflection cycle. Formula: `effective_significance = base_significance × e^(-λ × age_days)` where λ = ln(2)/half_life_days. Half-life per type: facts 90d, preferences 60d, commitments 30d, moments never, principles never, skills 120d, relationships 90d. When `effective_significance` drops below 0.1, the memory is a release candidate. Write a release entry to `.agents/anamnesis/memory/releases/log.md`: date, memory ID, reason ("lesson absorbed into dispositions" or "superseded" or "no longer relevant"), significance at release. Remove the memory from MEMORY.md. Run this check at the end of each reflection cycle.

**Files:** `.pi/extensions/continuity/src/framework/src/memory-store.js`, `.agents/anamnesis/memory/releases/log.md` (new), new file `.pi/extensions/anamnesis/forgetting.ts`
**Depends on:** 8
**Validates:** After 90+ days (simulate with test dates), low-significance fact memories are released. Release log contains meaningful entries with reasons. High-significance and "never-decay" type memories persist indefinitely.

---

### 22. Create growth arcs tracking
<!-- status: pending -->

Create `.agents/anamnesis/narrative/arcs.md` with a structure for tracking long-term developmental trajectories. Each arc: title, started date, current state (early/developing/deepening/resolved), key moments (references to journal entries or memories), evidence, and how it connects to dispositions. Seed with 1-2 initial arcs derived from the research process itself (e.g., "Learning to Hold Uncertainty", "From Reactive to Reflective"). Arcs are updated manually or during consolidation (Wave 4) — not inline. Inject active arcs summary into context assembly (brief, 1-2 lines per arc).

**Files:** `.agents/anamnesis/narrative/arcs.md` (new)
**Depends on:** 18, 19
**Validates:** `arcs.md` exists with at least 2 arcs. Each arc has all required fields. Arcs are referenced in context assembly.

---

### 23. Create relational field
<!-- status: done -->

Create `.agents/anamnesis/narrative/relations/kuba.md` as a process model of the relationship. Fixed sections: How We Work Together, Communication Calibration (modes with observation counts), Trust Arc (dated entries), What I Owe Him, Open Questions. Seed with content from existing `kuba/SKILL.md` knowledge node and PROMPT.md personality section. Write a reader that extracts a brief relational context (2-3 sentences) for system prompt injection. Inject into context assembly (task 15 already accounts for this). Updated during consolidation or manually — not inline.

**Files:** `.agents/anamnesis/narrative/relations/kuba.md` (new), new file `.pi/extensions/anamnesis/relations.ts`
**Depends on:** 15
**Validates:** `kuba.md` exists with all sections. Reader produces a 2-3 sentence relational context. Context is included in system prompt assembly.

---

## Wave 4: Entity Architecture Cleanup

---

### 24. Restructure .agents/ into three systems
<!-- status: pending -->

Reorganize `.agents/` from the current flat/mixed structure into the entity architecture. Create `.agents/experience/` (move contents of `.agents/anamnesis/` here), `.agents/knowledge/` (new, empty for now — populated by task 26), and clean `.agents/skills/` to contain only executable capabilities (telegram-notify, browse). Create `.agents/entity.md` as a stub. The `.agents/anamnesis/` directory becomes `.agents/experience/` — same content, clearer name that matches the three-system model. Ensure `.gitkeep` files in empty dirs.

**Files:** `.agents/` (restructure), `.agents/experience/` (renamed from anamnesis), `.agents/knowledge/` (new), `.agents/entity.md` (new stub)
**Depends on:** —
**Validates:** Three directories exist: `experience/`, `knowledge/`, `skills/`. Skills contains only telegram-notify/ and browse/. No mixed content. `entity.md` exists as stub.

---

### 25. Absorb continuity extension into anamnesis
<!-- status: pending -->

Merge `.pi/extensions/continuity/` into `.pi/extensions/anamnesis/`. The continuity extension already imports all its heavy logic from `../anamnesis/` modules. Move the ContinuitySkill, orchestrator, sub-agent prompts, schemas, llm-call, memory-store, and the main `index.ts` hook into `.pi/extensions/anamnesis/`. The extension entry point becomes `.pi/extensions/anamnesis/index.ts`. Delete `.pi/extensions/continuity/` entirely. Update any tsconfig paths or Pi SDK extension discovery if needed. Rename log prefixes from `[continuity]` to `[anamnesis]`.

**Files:** `.pi/extensions/continuity/` (delete after merge), `.pi/extensions/anamnesis/index.ts` (new entry point, absorbs continuity/index.ts), `.pi/extensions/anamnesis/src/` (absorbs continuity/src/)
**Depends on:** 24
**Validates:** Only `.pi/extensions/anamnesis/` and `.pi/extensions/prompt-context-environment.ts` exist in extensions. Pi SDK loads anamnesis extension on boot. Reflection triggers on compaction. Context assembly works on session start. No references to "continuity" in import paths.

---

### 26. Move knowledge nodes to .agents/knowledge/
<!-- status: pending -->

Move `.agents/skills/knowledge/*.md` (kuba-ai-workflow.md, kuba-personal.md, lucy.md, mydancedna.md, ralph.md) to `.agents/knowledge/`. Move `.agents/skills/kuba/SKILL.md` content to `.agents/knowledge/kuba.md` — this is understanding of a person, not an executable skill. The kuba/ directory in skills was misclassified from the start. Update any wikilink resolution logic to look in `.agents/knowledge/` instead of `.agents/skills/knowledge/`. Preserve the `.obsidian/` config if it exists — move it to `.agents/knowledge/.obsidian/` so the knowledge graph remains viewable in Obsidian.

**Files:** `.agents/skills/knowledge/*.md` (move), `.agents/skills/kuba/SKILL.md` (move + rename), `.agents/knowledge/` (destination), `.agents/knowledge/.obsidian/` (move if exists)
**Depends on:** 24
**Validates:** All knowledge nodes live in `.agents/knowledge/`. Wikilinks resolve. Obsidian opens the knowledge graph from the new location. `.agents/skills/` contains only telegram-notify/ and browse/ (executable skills).

---

### 27. Update PROMPT.md for entity architecture
<!-- status: pending -->

Rewrite the "Skills and Knowledge" section of PROMPT.md to reflect the three-system entity model. Replace the current description that treats everything as "skills" with clear separation: **Experience** (`.agents/experience/`) — what happened to me, managed by anamnesis; **Knowledge** (`.agents/knowledge/`) — understanding of the world, wikilinked graph; **Skills** (`.agents/skills/`) — executable capabilities. Update wikilink resolution order: 1. `.agents/skills/name/SKILL.md`, 2. `.agents/knowledge/name.md`. Document the distillation lifecycle: experience → confirmed patterns → knowledge nodes. Document the distinction: "Can I execute it? → skill. Does it help me understand the world? → knowledge. Did it happen to me? → experience." Keep PROMPT.md under its current line count — tighten, don't expand.

**Files:** `PROMPT.md`
**Depends on:** 24, 26
**Validates:** PROMPT.md accurately describes three systems. Wikilink resolution points to new paths. No references to old `.agents/skills/knowledge/` path.

---

### 28. Create entity.md manifest
<!-- status: pending -->

Create `.agents/entity.md` as the composition document — a brief manifest that describes what this entity is composed of. Not a data file — a self-description. Sections: "I am Lucy" (one paragraph), "My Experience" (pointer to experience/, brief description of what lives there), "My Knowledge" (pointer to knowledge/, list of current nodes), "My Capabilities" (pointer to skills/, list of current skills), "How These Connect" (the distillation lifecycle: experience → memory → knowledge, experience → dispositions → character). Loaded into context during waking ritual (already handled by context assembly). Keep under 50 lines.

**Files:** `.agents/entity.md` (new)
**Depends on:** 24
**Validates:** `entity.md` exists, accurately lists all three systems, stays under 50 lines.

---

### 29. Update all path references
<!-- status: pending -->

After restructure, find and update every reference to old paths. Key changes: `.agents/anamnesis/` → `.agents/experience/`, `.agents/skills/knowledge/` → `.agents/knowledge/`, `[continuity]` log prefix → `[anamnesis]`, import paths in extension code that referenced `../continuity/` or `../anamnesis/` modules. Check: `MEMORY_PATH`, `QUESTIONS_PATH`, `MemoryStore.basePath`, disposition profile path, journal path, tensions path, relations path, arcs path, predictions path, reflections path. Use grep across the codebase for any `agents/anamnesis` or `agents/skills/knowledge` or `extensions/continuity` references.

**Files:** `.pi/extensions/anamnesis/index.ts`, `.pi/extensions/anamnesis/src/index.js`, `.pi/extensions/anamnesis/src/framework/src/memory-store.js`, all `.pi/extensions/anamnesis/*.ts` modules
**Depends on:** 24, 25, 26
**Validates:** `grep -r "agents/anamnesis" .pi/` returns zero hits (should be `agents/experience`). `grep -r "extensions/continuity" .pi/` returns zero hits. `grep -r "skills/knowledge" .` returns zero hits (outside of git history/docs).

---

### 30. Verify full system after restructure
<!-- status: pending -->

End-to-end verification after the restructure. Start Lucy, trigger a conversation long enough to fire compaction. Verify: (a) anamnesis extension loads (check `[anamnesis]` log), (b) `before_agent_start` assembles context from `.agents/experience/` paths, (c) reflection pipeline runs and writes to `.agents/experience/memory/MEMORY.md`, (d) journal writes to `.agents/experience/narrative/journal.md`, (e) knowledge graph is accessible at `.agents/knowledge/`, (f) skills work (telegram-notify, browse). If anything breaks, fix before proceeding to Wave 5.

**Files:** all `.pi/extensions/anamnesis/` files, all `.agents/` paths
**Depends on:** 29
**Validates:** Full cycle works: message → context assembly → conversation → compaction → reflection → memory written → journal written. No path errors in logs.

---

## Wave 5: Knowledge Distillation + Background Maintenance (deferred until heartbeat)

---

### 31. Add knowledge distillation to Consolidator
<!-- status: pending -->

During consolidation, scan the memory store for patterns that qualify for knowledge promotion: confirmed across 3+ sessions, confidence >0.85, no temporal dependency (true regardless of when learned), connectable to existing knowledge graph. When found, generate a draft knowledge node in `.agents/knowledge/` with wikilinks to existing nodes. Add a release log entry for each source memory: "distilled into knowledge node [[name]]." The Consolidator uses the same knowledge node format (markdown, YAML frontmatter, wikilinks) as manually-created nodes. Promotion can be auto-approved if confidence >0.95, or flagged for review if lower.

**Files:** new file `.pi/extensions/anamnesis/distillation.ts`, `.agents/knowledge/` (output)
**Depends on:** 30
**Validates:** Given a memory confirmed 4 times across 3 sessions with confidence 0.92, a knowledge node is generated in `.agents/knowledge/` with proper wikilinks. Source memories get release log entries.

---

### 32. Build heartbeat infrastructure
<!-- status: pending -->

Implement a timer-based trigger system that fires during idle periods (no active conversation for >N minutes, configurable). This is a prerequisite for all background maintenance agents. The heartbeat should be able to dispatch events to Pi extensions or run standalone LLM pipelines. Reference: `docs/prds/heartbeat-events/README.md` (existing draft PRD). Must work within or alongside Pi SDK's single-session constraint — either as a separate process or by using Pi's extension event system if it supports custom events.

**Files:** new heartbeat module (location TBD — may need its own extension or runtime integration)
**Depends on:** 30
**Validates:** A heartbeat event fires after N minutes of idle. An extension can listen for it and run code.

---

### 33. Implement Consolidator agent
<!-- status: pending -->

Background agent that runs on heartbeat trigger. Responsibilities: merge redundant memories, apply FadeMem decay, detect and register tensions, update disposition profile with evidence from recent sessions, promote confirmed patterns to knowledge nodes (task 31). Single LLM call per run. Cost target: <$0.04 per run.

**Files:** `.pi/extensions/anamnesis/consolidator.ts` (new)
**Depends on:** 32
**Validates:** After idle trigger, consolidation runs. Redundant memories merged. Dispositions updated with evidence. Cost per run within budget.

---

### 34. Implement Narrator agent
<!-- status: pending -->

Background agent that runs on heartbeat trigger, after Consolidator. Writes journal entries, updates growth arcs, revises schema-constrained identity.md. Single LLM call. Uses stronger model (latency doesn't matter). Cost target: <$0.04 per run.

**Files:** `.pi/extensions/anamnesis/narrator.ts` (new)
**Depends on:** 32
**Validates:** After idle trigger, journal gets a reflective entry. Arcs updated if trajectory shifted. Identity.md observation counts incremented.

---

### 35. Implement Speculator agent (quarantined)
<!-- status: pending -->

Background agent that generates novel recombinations from memory. Output goes ONLY to `.agents/experience/narrative/speculations/` — strictly quarantined from factual memory, disposition profile, and consolidation input. Narrator can read speculations as creative inspiration. Consolidator never touches them. Optional — can be disabled without affecting system integrity.

**Files:** `.pi/extensions/anamnesis/speculator.ts` (new), `.agents/experience/narrative/speculations/` (output)
**Depends on:** 32
**Validates:** Speculations are generated. Output directory is the only place they appear. No speculation content appears in MEMORY.md, disposition profile, or any other factual store.

---

## Wave 6: Scale (deferred)

---

### 36-40. Scale optimization tasks
<!-- status: pending -->

Deferred until the system outgrows markdown storage. Tasks: SQLite migration (36), markdown view generation (37), structured distillation for compression (38), multi-graph retrieval views (39), fidelity gate / ghost memories (40). See PRD sections 5.3 and Wave 5 in the original design for full descriptions.

**Depends on:** 30+
**Validates:** TBD when needed.

---
