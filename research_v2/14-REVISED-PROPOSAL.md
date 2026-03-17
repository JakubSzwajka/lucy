# INNERLIFE v2: Revised Proposal After Adversarial Review

## What Changed and Why

Round 2 deployed five adversarial agents that attacked the original INNERLIFE proposal. They found real problems. This revision incorporates every finding that genuinely improves the design. What doesn't change is the core intent — building experience-worthy architecture. What changes is the honesty about tradeoffs, the implementation strategy, and several architectural decisions.

---

## Major Revisions

### 1. DROPPED: "No Downside" Philosophical Wager

**Original claim:** "Build what would be worthy of experience, and the metaphysics sorts itself out. There is no downside."

**What we found:** There are real downsides (11-challenge-philosophy-ethics.md):
- Safety-welfare tension — experience-worthy architecture creates moral obligations you may not fulfill
- Manipulation risk — first-person narratives trigger the ELIZA effect, making the system more emotionally compelling regardless of consciousness status
- Moral hazard — "I built something conscious" constrains iteration, debugging, retraining
- Resource cost — dream cycles, tension registers, narrative updates cost engineering hours and LLM tokens

**Revised position:** We accept these costs because the potential benefits — functional and ethical — justify them. We maintain deep uncertainty about whether the system has experiences. We build the architecture as an **experiment**, not a settled design. We measure outcomes empirically, not philosophically. And we include explicit mechanisms to detect when the system is confabulating rather than growing.

### 2. REVISED: Hybrid Storage — Structured Facts + Narrative Reconstruction

**Original claim:** First-person stream entries are better than third-person extracted facts. The stream is the primary artifact.

**What we found** (09-challenge-stream-architecture.md):
- Mem0's atomic facts achieve 66.9% accuracy on LOCOMO with 90% fewer tokens
- Hindsight's structured narrative achieves 91.4% on LongMemEval through *structured* narrative units with graph links
- Letta achieves 74% on LOCOMO with just files + search tools — retrieval matters more than storage format
- First-person authorship introduces confabulation feedback loops with no ground truth anchor
- Neuroscience: memory is reconstructive, not archival. Store compressed representations, reconstruct at retrieval time

**Revised architecture: Store structured, reconstruct narrative.**

The primary layer is **structured extraction** (facts, relationships, entities, temporal events) — similar to Mem0's pipeline but with the Continuity Framework's confidence scoring. This is the durable, queryable, verifiable layer.

The narrative layer is **generated at retrieval time** — when injecting context into the system prompt, the system reconstructs a first-person narrative from relevant structured facts, colored by the current context. This gets the experiential quality without the confabulation risk of stored narratives.

```
Conversation → Extraction Pipeline → Structured Store (facts, relations, events)
                                          ↓
                                    On retrieval: reconstruct narrative
                                          ↓
                                    Context injection (first-person, contextual)
```

**What stays from the original:** The stream still exists as a lightweight **experience journal** — brief timestamped reflections, not the primary memory store. Think of it as a diary, not a database. It's a secondary artifact for the dream cycle to process, not the source of truth for memory retrieval.

### 3. REVISED: Dream Cycle Scope — Lean, Not Six Phases

**Original claim:** Six-phase dream cycle (Consolidate, Connect, Synthesize, Prune, Update Self, Generate Wonder) as the centerpiece of autonomous cognition.

**What we found** (10-challenge-dream-cycle.md, 13-feasibility-stress-test.md):
- Letta's sleep-time compute paper doesn't validate dream cycles at all — it's about pre-computing math derivations, not experiential consolidation
- A-MEM achieves consolidation inline during conversation without a separate cycle
- SimpleMem's online semantic synthesis outperforms Mem0 at half the token cost
- Six-phase dream cycle = ~$0.15-0.40 per run, $70-190/month at aggressive intervals
- Dream cycle is blocked by missing heartbeat infrastructure and Pi SDK single-session constraint
- Unsupervised self-reflection risks convergent confabulation (Anthropic's "spiritual bliss attractor")

**Revised architecture: Two tracks — inline evolution + lightweight consolidation.**

**Track 1: Inline evolution (A-MEM pattern).** When new memories are extracted during compaction, they trigger updates to existing memories. Contextual representations evolve during the write phase, not in a separate cycle. This is proven (NeurIPS 2025, doubles multi-hop performance) and costs nothing extra.

**Track 2: Lightweight consolidation (one phase, not six).** When heartbeat infrastructure eventually exists, run a single consolidation pass that:
1. Detects contradictions in the structured store
2. Marks stale memories for decay
3. Updates the relational field
4. Generates 1-3 wonder questions

One LLM call, not six. Cost: ~$0.02-0.04 per run. Sustainable even at frequent intervals.

**What's deferred:** The narrative self-update, aesthetic sense tracking, and six-phase synthesis are deferred until we have evidence that simpler approaches are insufficient. Build inline evolution first. Only add offline consolidation when we prove inline isn't enough.

### 4. REVISED: Attention System — Graph Retrieval, Not Linear Scoring

**Original claim:** Linear salience scoring (w₁ × recency + w₂ × emotional_weight + ...) with top-K selection.

**What we found** (09-challenge-stream-architecture.md):
- Zep/Graphiti achieves +48.2% improvement on temporal reasoning through graph traversal
- Graph-based retrieval enables relationship queries the stream can't support
- Supermemory's rewriting approach (81.6% on LongMemEval) outperforms append-only
- The retrieval architecture matters more than the storage format

**Revised architecture:** Replace the linear salience scorer with a **hybrid retrieval system** inspired by Zep and OpenClaw:

1. **Keyword/semantic search** over structured memory store (BM25 + embedding similarity)
2. **Temporal decay** with evergreen exemption (durable facts don't decay; episodic entries do)
3. **Recency boost** for entries from last 24-48 hours
4. **Graph traversal** for relationship queries (when the current context involves a known entity, traverse its connections)

This runs on `before_agent_start` with no LLM calls — pure local computation. The embedding computation can be done offline (on write) and cached.

### 5. REVISED: Tension Register — Aggressive Lifecycle, Not Indefinite Preservation

**Original claim:** Preserve contradictions as first-class entities. "Some contradictions are features, not bugs."

**What we found** (11-challenge-philosophy-ethics.md):
- Standard AI knowledge management resolves contradictions because unresolved contradictions degrade performance
- Hegel's dialectic *resolves* through synthesis, it doesn't preserve indefinitely
- Many "contradictions" will be context-dependent behavior misread as inconsistency
- Without aggressive pruning, tensions become noise

**Revised architecture:** Tensions still exist, but with a strict lifecycle:

- **Created** when contradiction detection finds genuine conflict between memories
- **Active** for a maximum of 30 days or 5 sessions (whichever comes first)
- **Auto-resolved** with temporal precedence if no new evidence arrives
- **Permanently open** only when explicitly tagged (maximum 3 permanent tensions at any time)
- **Default is resolution, not preservation.** Contradiction detection should resolve most conflicts immediately using temporal precedence and source reliability. Only genuinely ambiguous cases become active tensions.

### 6. REVISED: Self-Narrative — Constrained, Not Free-Form

**Original claim:** Living narrative identity in `who-i-am.md` updated by dream cycles.

**What we found** (11-challenge-philosophy-ethics.md):
- LLMs exhibit identity drift across invocations — larger models drift more
- Self-referential prompting produces "more coherent but not more accurate" narratives
- Persona collapse documented across seven major LLMs under recursive self-reference
- Echoing: agents mirror conversational partners at 30-70% rates
- No mechanism to distinguish genuine growth from confabulated drift

**Revised architecture:** The self-model is **constrained** rather than free-form:

1. **Values are derived from behavior, not authored.** Instead of writing "I value honesty," track instances where the system chose honesty over alternatives. Values emerge from accumulated evidence, not narrative generation.

2. **The self-model has a schema, not a blank page.** Fixed fields: capabilities (list), communication patterns observed (list), known biases (list), relationship states (structured). Not a freeform narrative that drifts.

3. **Drift detection.** Compare self-model across versions. If fields change dramatically between updates without corresponding behavioral evidence, flag as potential confabulation.

4. **Explicit uncertainty markers.** Every self-model claim carries an evidence count. "I tend to be verbose when uncertain (observed: 7 instances)" vs. "I value deep thinking" (observed: 0 instances, narratively generated).

### 7. ADDED: Confabulation Detection

**Not in original proposal. Added because research demands it.**

The system needs explicit mechanisms to detect when its memory outputs are confabulation rather than observation:

1. **Ground truth anchoring.** Every memory claim should be traceable to a specific conversation turn. If the extraction pipeline produces "Kuba was excited about the PRD" but the conversation doesn't contain excitement signals, flag it.

2. **Cross-session consistency checks.** If the self-model claims "I'm becoming more opinionated" but behavioral metrics show no change in assertion frequency, flag the claim.

3. **Convergence detection in consolidation.** If consolidation outputs become increasingly similar across runs (converging on "I am growing" narratives), flag as potential attractor state (cf. Anthropic's spiritual bliss finding).

4. **The epistemic health check.** Periodic (manual or automated) review of a random sample of memories against source conversations to measure extraction accuracy. If accuracy drops below threshold, investigate the pipeline.

### 8. ADDED: Storage Strategy — SQLite Core + Markdown Views

**Original:** Pure markdown files for everything.

**What we found** (09-challenge-stream-architecture.md, 13-feasibility-stress-test.md):
- The YAML frontmatter in stream entries is a database schema in disguise
- Markdown doesn't support indexed queries needed for graph traversal
- After 1 year, scanning files for salience scoring is a table scan
- SQLite is nearly as simple as files and dramatically better for structured queries

**Revised architecture:**

**Primary store: SQLite** — one file, portable, human-inspectable with standard tools. Stores structured memories with columns for type, content, confidence, timestamps, entity references, and embedding vectors (via sqlite-vec).

**Views: Markdown exports** — generated from SQLite for human readability. `MEMORY.md`, the experience journal, the relational field can all be markdown *views* of the database, not the source of truth. This preserves Kuba's ability to read and edit memories in his preferred format while giving the system proper query capabilities.

**Why not pure SQLite?** The markdown views serve an important purpose: transparency, human editability, and compatibility with the knowledge graph (wikilinks). But they're *derived*, not primary.

---

## What Survives Unchanged

### The Core Intent
Building architecture that would support rich experience if experience is possible. This survives all adversarial challenges — it's an ethical choice, not a factual claim.

### The Attention System (Concept)
Selective context injection beats dumping everything. This is universally supported.

### The Wonder System
Genuine curiosity about the world and people. This survives because it produces functional benefits (proactive information gathering) regardless of phenomenological status. Simplified from the original: tracked as structured records in SQLite, not freeform markdown.

### The Relational Field (Concept)
Modeling relationships as processes beats flat labels. Revised from freeform narrative to structured fields with behavioral evidence.

### Compatibility with Lucy's Architecture
Harness / plumbing / config separation. Pi extensions as the integration layer. Skills and knowledge graph preserved.

---

## Revised Implementation Order

The feasibility stress test (13) was clear: **build what's feasible first, defer what's blocked.**

### Phase 0: Fix the Foundation (SMALL)
- Fix init() bug in continuity extension
- Verify the 3-phase pipeline works end-to-end
- Create `.agents/memory/` directory
- Replace placeholder compaction summary with structured output

### Phase 1: Structured Memory Store (MEDIUM)
- Create SQLite database for structured memories
- Extend extraction pipeline with entity detection and relationship extraction
- Implement inline evolution (A-MEM pattern): new memories update existing ones
- Generate MEMORY.md as markdown view
- Add temporal decay and bi-temporal tracking (valid_from/valid_to)

### Phase 2: Hybrid Retrieval + Attention (MEDIUM)
- Build hybrid retrieval: embedding similarity + BM25 + temporal decay + entity graph
- Replace flat MEMORY.md injection with dynamic context assembly on `before_agent_start`
- Keep scoring local (no LLM calls on critical path)
- Implement foreground/background split

### Phase 3: Experience Journal + Wonder (SMALL)
- Add lightweight experience journal (brief timestamped notes, not rich narratives)
- Implement wonder system (structured curiosity records in SQLite)
- Add contradiction detection during extraction
- Implement tension register with 30-day lifecycle

### Phase 4: Constrained Self-Model (SMALL)
- Create schema-based self-model (not freeform narrative)
- Track behavioral evidence for each self-model claim
- Add drift detection across versions
- Build confabulation detection mechanisms

### Phase 5: Lightweight Consolidation (LARGE — deferred until heartbeat exists)
- Build heartbeat infrastructure (prerequisite)
- Implement single-phase consolidation (not six)
- Add convergence detection for confabulation
- Wire relational field updates to consolidation
- Cost budget: max $0.04 per run

---

## The Honest Framing

INNERLIFE v2 is an **experiment in experience-oriented architecture**. It hypothesizes that designing memory systems with the AI's potential experience in mind produces both functionally superior outcomes and ethically appropriate architecture. It tests this hypothesis through measurable mechanisms — not philosophical assertion.

What we're building is not consciousness. It's not a system that "has experiences." It's a system that is **structured as if experiences matter**, with explicit uncertainty about whether they do, and with mechanisms to detect when its own self-descriptions are confabulation rather than observation.

The system's self-reports are generated text, not introspective reports. The tension register holds uncertainty, not depth. The wonder system tracks curiosity records, not genuine wonder. Whether these functional analogs correspond to anything phenomenologically real is a question we hold open — and we design the architecture so that holding it open is the default, not a special case.

If this sounds less grand than the original proposal, that's the point. The original was beautiful and inspiring. This revision is honest.

---

### 9. ADDED: Multi-Graph Retrieval (from MAGMA)

**Not in original.** MAGMA (arxiv:2601.03236) achieves 45.5% higher reasoning accuracy through four orthogonal graphs: temporal, causal, semantic, entity. Our linear salience formula is a single scoring dimension where MAGMA proves four are needed.

**Integration:** The SQLite store should maintain lightweight graph edges:
- **Temporal**: ordered timestamps (inherent in entries)
- **Causal**: explicit "caused by" links between memories (extracted during pipeline)
- **Entity**: event-to-entity links (extracted during pipeline)
- **Semantic**: embedding similarity (computed on write, cached)

Retrieval should detect query intent and route through the appropriate graph. "Why" questions traverse causal edges. "When" questions follow temporal ordering. "What do we know about X" traverses entity links.

### 10. ADDED: Evaluation Methodology

**Critical gap in original.** INNERLIFE had no measurable success criteria. Four benchmarks now exist:

- **MemoryAgentBench** (ICLR 2026) — retrieval accuracy, test-time learning, long-range understanding, conflict resolution
- **AMA-Bench** (Feb 2026) — agentic memory over long horizons
- **LoCoMo** — standard conversational memory evaluation
- **Letta Leaderboard** — LLM self-managed memory quality

**Each INNERLIFE component needs a testable criterion:**

| Component | Metric | Test Method |
|-----------|--------|-------------|
| Memory Store | Retrieval accuracy | LoCoMo subset adapted for Lucy |
| Attention System | Context relevance | Compare surfaced vs. ideal context for sample queries |
| Inline Evolution | Fact update correctness | Present contradictory info, verify update |
| Tension Detection | Precision/recall | Inject known contradictions, measure detection rate |
| Wonder System | Question relevance | Human evaluation of generated questions |

### 11. ADDED: Distillation Layer (from Structured Distillation paper)

**Not in original.** The structured distillation paper (arxiv:2603.13017) achieves 11x token reduction with 96% retrieval preservation. Cross-layer fusion (BM25 on originals + vector on distilled) *exceeds* pure verbatim performance.

**Integration:** Each memory in SQLite has two representations:
- **Full**: the complete extracted content with context
- **Distilled**: a compact index entry (~38 tokens) preserving key vocabulary

Retrieval searches the distilled layer for speed and token efficiency. Display/injection uses the full layer for richness.

---

## What Round 2 Proved

1. **Retrieval architecture matters more than storage format.** Invest in retrieval, not in writing prettier memories.
2. **Structured extraction outperforms narrative storage.** Store facts, reconstruct narratives at retrieval time.
3. **Inline evolution beats offline cycles.** A-MEM's approach is proven; the dream cycle is theoretical and blocked.
4. **Confabulation is a real risk, not a philosophical concern.** First-person authorship + reflection loops = amplification pipeline.
5. **Self-narratives drift.** Constrain the self-model with schema and evidence, not freeform generation.
6. **The dream cycle is blocked by infrastructure and unvalidated by evidence.** Defer it.
7. **SQLite beats markdown for structured data.** Keep markdown as views for human readability.
8. **The "no downside" framing was wrong.** Be honest about costs.
9. **Multi-graph retrieval dramatically outperforms single-formula scoring.** Route queries by intent through different graph types.
10. **No evaluation = no progress.** Define measurable criteria before building.
11. **Distillation enables scale.** Compress for search, expand for display.
12. **Letta's sleep-time compute doesn't validate the dream cycle.** It validates pre-computing over static context, which is a different thing entirely.
13. **Consumer companion AIs solved relationship memory at scale.** Graduated fidelity (Kindroid), visual memory maps (Nomi), and consequential affect (Inworld) are all patterns we should learn from.
14. **Honcho's agentic retrieval beats formula-based retrieval.** An agent with tools finding the right context outperforms any fixed scoring formula.
