# Anamnesis — Lucy's Experience System

Memory, reflection, and identity pipeline that gives Lucy genuine continuity across sessions. Not a chat log or vector store — a structured system that extracts, scores, evolves, and forgets.

## Interface

Two entry points, registered with Pi SDK in `index.ts`:

### Hooks (`hooks/`)

| Hook | File | Trigger | What it does |
|------|------|---------|-------------|
| `before_agent_start` | `hooks/context.ts` | Session start | Loads experience from disk, scores memories by salience, renders ~7 context sections into a token-budgeted "What's On My Mind" block (~4000 tokens) |
| `session_before_compact` | `hooks/reflection.ts` | Context fills up | Runs the full reflection pipeline: foresight check → orchestrator (classify → score → generate) → memory evolution → journal entry |

### Tools (`tools/`)

| Tool | Description |
|------|-------------|
| `knowledge_search` | Query the knowledge graph by topic. Returns matching nodes with wikilinks. |
| `knowledge_create` | Create a new knowledge node. Validates: no orphans, no duplicates, wikilink required. |

## Internals (`src/`)

### Core pipeline

| File | Purpose |
|------|---------|
| `orchestrator.ts` | 3-phase LLM pipeline: classify → confabulation check → score → generate. Loads sub-agent prompts from `prompts/`, calls OpenRouter, falls back to local heuristics. |
| `store.ts` | Memory/question/prediction I/O. Markdown serialization with JSON metadata in HTML comments. Includes the A-MEM evolution pattern (reinforce, supersede, add). |
| `llm.ts` | Thin OpenRouter wrapper. Single function, no session overhead. |
| `types.ts` | All interfaces, constants, helpers (`generateId`, `validateMemory`, `getConfidenceLevel`). |
| `paths.ts` | Centralized `.agents/` path constants. Respects `LUCY_AGENTS_DIR` env var. |

### Context loaders

Each module loads one section of Lucy's experience from disk for context assembly:

| File | Loads | Source path |
|------|-------|-------------|
| `salience.ts` | Ranked memories (top-K by weighted score) | `.agents/experience/memory/MEMORY.md` |
| `narrative-reconstruct.ts` | First-person prose from scored memories | (in-memory, from salience output) |
| `knowledge.ts` | Wikilink graph index | `.agents/knowledge/*.md` |
| `identity.ts` | Self-model (capabilities, biases, uncertainties) | `.agents/experience/narrative/identity.md` |
| `dispositions.ts` | Personality profile (tendencies, mental models) | `.agents/experience/dispositions/profile.md` |
| `relations.ts` | Relationship dynamics | `.agents/experience/narrative/relations/*.md` |
| `tensions.ts` | Active unresolved dilemmas (max 5, auto-expire) | `.agents/experience/narrative/tensions/active.md` |
| `arcs.ts` | Long-term growth threads | `.agents/experience/narrative/arcs.md` |
| `journal.ts` | Reflective diary entries | `.agents/experience/narrative/journal.md` |
| `forgetting.ts` | Exponential decay model (FadeMem) | `.agents/experience/memory/releases/log.md` |

### Sub-agent prompts (`src/prompts/`)

Three specialized LLM roles, each with a SOUL.md (role definition) and a prompt template:

| Agent | Prompt | Output |
|-------|--------|--------|
| `classifier/` | Extract memories from conversation | 7 memory types with source quotes, tags, salience |
| `scorer/` | Assign confidence to memories | 4-tier confidence (explicit/implied/inferred/speculative) |
| `generator/` | Produce follow-up questions | Curiosity questions + predictions |

## Reflection flow

Data flow through `session_before_compact` (`hooks/reflection.ts` → `src/orchestrator.ts` → `src/store.ts`).

### Pipeline overview

```mermaid
flowchart TD
    SDK["Pi SDK fires\nsession_before_compact"]
    SER["1. Serialize\n<i>hooks/reflection</i>"]
    GATE{{"userMsgCount >= 2?"}}
    SKIP["Return early\n(skip reflection)"]
    FORE["2. Foresight Check\n<i>hooks/reflection</i>"]
    LOAD["3. Load Existing Memories\n<i>hooks/reflection → store</i>"]
    ORCH["4. Orchestrate\n<i>src/orchestrator</i>"]
    EVOLVE["5. Evolve Memories\n<i>hooks/reflection → store</i>"]
    PERSIST["6. Persist\n<i>hooks/reflection → store</i>"]
    JOURNAL["7. Journal\n<i>hooks/reflection → llm</i>"]
    RET["Return compaction\nsummary to Pi SDK"]

    SDK --> SER
    SER --> GATE
    GATE -- No --> SKIP
    GATE -- Yes --> FORE
    FORE --> LOAD
    LOAD --> ORCH
    ORCH --> EVOLVE
    EVOLVE --> PERSIST
    PERSIST --> JOURNAL
    JOURNAL --> RET
```

### Orchestrator detail (step 4)

```mermaid
flowchart TD
    IN["conversationText: string\nexistingMemories: Memory[]"]

    CLS["Phase 1: Classify\n<i>LLM — classifier agent</i>"]
    CLS_IN["IN: conversation + existing memories\ntemplated into classify.md"]
    CLS_OUT["OUT: Memory[]\nid, type, content, source_quote,\ntags, salience"]

    CONFAB["Phase 1.5: Confabulation Check\n<i>local — no LLM</i>"]
    CONFAB_IN["IN: Memory[] + conversationText"]
    CONFAB_OUT["OUT: Memory[]\nflagged → confabulation_risk: true\nconfidence.score × 0.5\nCheck: source_quote first 50 chars\nmust appear in conversation"]

    SCR["Phase 2: Score\n<i>LLM — scorer agent</i>"]
    SCR_IN["IN: checked Memory[] + conversation\ntemplated into score.md"]
    SCR_OUT["OUT: Memory[] + confidence\nscore 0-1, level, source,\nevidence[], decay_rate"]

    GEN["Phase 3: Generate\n<i>LLM — generator agent</i>"]
    GEN_IN["IN: scored Memory[] + existing memories\ntemplated into generate.md"]
    GEN_OUT["OUT: CuriosityQuestion[]\nquestion, context, curiosity_type,\ncuriosity_score, timing, sensitivity\n+ Prediction[]\ncontent, confidence"]

    OUT["ReflectionResult\njob, memories, questions,\npredictions, metadata"]

    IN --> CLS
    CLS_IN -.-> CLS
    CLS --> CLS_OUT
    CLS_OUT --> CONFAB
    CONFAB_IN -.-> CONFAB
    CONFAB --> CONFAB_OUT
    CONFAB_OUT --> SCR
    SCR_IN -.-> SCR
    SCR --> SCR_OUT
    SCR_OUT --> GEN
    GEN_IN -.-> GEN
    GEN --> GEN_OUT
    GEN_OUT --> OUT
```

### Evolution detail (step 5)

```mermaid
flowchart TD
    IN["new Memory[] from orchestrator\n+ existing Memory[] from MEMORY.md"]
    CMP["Compare each new memory\nagainst existing of same type"]

    R{"Word overlap > 70%?"}
    C{"Tag overlap >= 2\nor negation divergence?"}
    D{"Exact duplicate?"}

    REINFORCE["Reinforce\nconfidence += 0.05\n(cap at 1.0)"]
    SUPERSEDE["Supersede\nold.still_valid = false\nnew.supersedes = old.id"]
    ADD["Add\nnew memory with\nvalid_from = today"]
    SKIP["Skip\n(duplicate)"]

    SAVE["Write updated\nMEMORY.md to disk"]
    OUT["EvolutionResult\nadded[], superseded[],\nreinforced[]"]

    IN --> CMP
    CMP --> R
    R -- Yes --> REINFORCE
    R -- No --> C
    C -- Yes --> SUPERSEDE
    C -- No --> D
    D -- Yes --> SKIP
    D -- No --> ADD

    REINFORCE --> SAVE
    SUPERSEDE --> SAVE
    ADD --> SAVE
    SKIP --> SAVE
    SAVE --> OUT
```

### Step-by-step data shapes

| Step | IN | OUT | File |
|------|----|-----|------|
| 1. Serialize | `event.preparation.messagesToSummarize` (Pi message array) | `conversationText: string` (`[User]:...\n[Assistant]:...`) | `hooks/reflection` |
| 2. Foresight | `conversationText` + `predictions.md` | Side effect: confirmed predictions written to disk | `hooks/reflection` |
| 3. Load | `MEMORY.md` on disk | `existingMemories: Memory[]` | `hooks/reflection → store` |
| 4. Orchestrate | `conversationText` + `existingMemories` | `ReflectionResult { memories, questions, predictions, job, metadata }` | `src/orchestrator` |
| 5. Evolve | `result.memories` + existing `MEMORY.md` | `EvolutionResult { added, superseded, reinforced }` → updated `MEMORY.md` | `hooks/reflection → store` |
| 6. Persist | `questions`, `predictions`, reflection stats | Written to `questions.md`, `predictions.md`, `reflections/*.json` | `hooks/reflection → store` |
| 7. Journal | `{ memories_extracted, memories_added, questions_generated }` | LLM → 2-4 sentences appended to `journal.md` (non-blocking) | `hooks/reflection → llm` |
| Return | — | `{ compaction: { summary, firstKeptEntryId, tokensBefore } }` | `hooks/reflection` |

## Key concepts

**Memory types:** fact, preference, relationship, principle, commitment, moment, skill

**Salience formula:** `0.25×recency + 0.25×importance + 0.25×relevance + 0.15×novelty + 0.10×tension_boost`

**Memory evolution (A-MEM):** New memories are compared against existing ones. Outcomes: reinforcement (boost confidence), supersession (invalidate old), addition (new), or duplicate (skip).

**Forgetting (FadeMem):** Exponential decay by type. Commitments decay in 30 days, preferences in 60, facts in 90. Moments and principles never decay. Release threshold: 0.1 effective significance.

**Token budget:** Context assembly targets 4000 tokens. Sections are dropped in priority order (arcs → journal → questions → predictions → tensions → memories) if over budget.

## Data storage

All persistent data lives under `.agents/experience/`:

```
.agents/
├── entity.md                              # High-level identity anchor
├── knowledge/*.md                         # Durable understanding (wikilinked)
└── experience/
    ├── memory/
    │   ├── MEMORY.md                      # Structured memories by type
    │   ├── questions.md                   # Curiosity questions
    │   ├── predictions.md                 # Foresight items
    │   └── reflections/*.json             # Reflection logs
    ├── narrative/
    │   ├── identity.md                    # Self-model
    │   ├── journal.md                     # Reflective diary
    │   ├── arcs.md                        # Growth arcs
    │   ├── relations/*.md                 # Relationship context
    │   └── tensions/active.md             # Active dilemmas
    └── dispositions/
        └── profile.md                     # Tendencies + mental models
```
