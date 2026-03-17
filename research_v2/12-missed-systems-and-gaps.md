# Adversarial Review: Systems We Missed and Gaps They Expose

> Research compiled 2026-03-17. Adversarial analysis of the INNERLIFE proposal against systems not covered in Round 1.

---

## Executive Summary

Round 1 covered 10 systems. This adversarial review found **12 additional systems and frameworks** that expose real gaps in the INNERLIFE proposal. The most damaging findings:

1. **MAGMA's multi-graph architecture** solves the "why did this happen?" problem that INNERLIFE's flat stream cannot answer
2. **Honcho's Peers model** directly challenges our relational field design by treating AI and human as symmetric entities
3. **Cognee's `memify` operation** implements self-improving memory that our Dream Cycle only gestures at
4. **Structured Distillation** achieves 11x compression with 96% retrieval preservation -- we have no compression strategy
5. **We have zero evaluation methodology** -- four benchmarks now exist (MemoryAgentBench, AMA-Bench, Letta Leaderboard, LoCoMo) that we should be testing against
6. **Consumer companion AIs** (Kindroid, Nomi, Inworld) have solved practical relationship memory at scale with patterns we ignored

---

## 1. MAGMA: Multi-Graph Agentic Memory Architecture

**Source:** [arxiv:2601.03236](https://arxiv.org/abs/2601.03236) (Jan 2026)

### What It Does

MAGMA maintains **four orthogonal relation graphs** over the same memory items:

| Graph | Edge Type | Answers |
|-------|-----------|---------|
| **Temporal** | Strictly ordered timestamps | "When did X happen?" |
| **Causal** | Directed logical entailment | "Why did X happen?" |
| **Semantic** | Cosine similarity connections | "What is related to X?" |
| **Entity** | Event-to-entity links | "What do we know about person X?" |

Retrieval uses an **Adaptive Traversal Policy** that detects query intent (why/when/what/who) and routes through the appropriate graph. "Why" queries prioritize causal edges. Temporal queries follow the temporal backbone. Entity queries traverse the entity graph.

### How It's Better Than INNERLIFE

**INNERLIFE's stream is a single timeline.** It captures temporal ordering naturally but has no causal graph, no entity graph, and only implicit semantic connections (via `related:` metadata in entries). When the Dream Cycle asks "why did Kuba's trust level change?", it has to re-derive causality from narrative text every time.

MAGMA would answer this with a single graph traversal: follow causal edges backward from the trust-change event to its antecedents.

**Specific gaps exposed:**

- **No causal reasoning structure.** The stream records "what happened" but not "what caused what." INNERLIFE relies on the Dream Cycle's LLM to infer causality on-the-fly, which is both expensive and unreliable. MAGMA makes causality a first-class, persistent, traversable structure.
- **No entity graph.** INNERLIFE's relational field (relations/kuba.md) is a narrative document, not a queryable graph. If Lucy had 10 relationships, finding "which people has Lucy disagreed with about architecture?" requires reading all 10 files. MAGMA's entity graph answers this with a traversal.
- **No intent-aware retrieval.** INNERLIFE's Attention System uses a single salience formula (recency + emotional_weight + relevance + tension + commitment). MAGMA proves that different query types need fundamentally different retrieval strategies -- a "why" question and a "when" question should not use the same scoring.

**Benchmark evidence:** MAGMA achieves 0.700 LLM-as-Judge on LoCoMo vs. MemoryOS (0.553) and A-MEM (0.580). 45.5% higher reasoning accuracy than prior methods. 95% token reduction vs. full context.

### What INNERLIFE Should Steal

- Add causal edges to stream entries. When the Dream Cycle identifies a causal relationship ("his trust grew because I correctly pushed back on the architecture"), persist that as a queryable link, not just narrative text.
- Implement intent-aware retrieval routing. The Attention System should detect whether the current context calls for temporal, causal, semantic, or entity-based retrieval and weight accordingly.

---

## 2. Honcho: The Peers Model and Dialectic Architecture

**Source:** [github.com/plastic-labs/honcho](https://github.com/plastic-labs/honcho), [Honcho 3 announcement](https://blog.plasticlabs.ai/blog/Honcho-3)

### What It Does

Honcho is a memory library for building stateful agents with three core processing components:

- **The Deriver** -- background worker that extracts observations about peers from messages
- **The Dialectic Agent** -- agentic retrieval system that answers questions about peers by strategically gathering context from memory using retrieval tools in an agent loop
- **The Dreamer** -- background consolidation agent that explores and consolidates observations to improve memory quality

### The Peers Model

This is the conceptually important part. Honcho's [Peers model](https://blog.plasticlabs.ai/blog/Beyond-the-User-Assistant-Paradigm;-Introducing-Peers) replaces the User-Assistant hierarchy with a flat structure where **any entity -- human, AI, NPC, or API -- is a "Peer"** with persistent identity and direct communication capability.

Key implications:
- A Peer can participate in multiple sessions and develop independent representations of other Peers
- "Scoped representations" -- each Peer models others based only on observed interactions (Alice shouldn't know what Bob said privately)
- The system enables emergent social dynamics: trust-building, alliance formation, adversarial patterns

### How It's Better Than INNERLIFE

**INNERLIFE's relational field is asymmetric.** `relations/kuba.md` models Lucy's view of Kuba, but there's no corresponding representation of how Kuba might view Lucy, or how the relationship looks from a third-party perspective. The Peers model treats this symmetrically.

**Specific gaps exposed:**

- **No scoped observation model.** INNERLIFE assumes a single relationship file per person. Honcho's architecture handles the case where the same person behaves differently across contexts -- and the AI should model those differences separately.
- **Agentic retrieval beats formula-based retrieval.** Honcho 3's biggest architectural change was replacing fixed retrieval code paths with an agent loop that has retrieval tools. This achieved "state-of-the-art" benchmark results. INNERLIFE's Attention System uses a fixed salience formula. Honcho proved that letting an agent decide how to retrieve -- using tools like search, traversal, and filtering -- produces better results than any fixed formula.
- **The Dreamer does what our Dream Cycle does, but in production.** Honcho already ships background consolidation. We proposed the Dream Cycle as novel; Honcho implemented it as standard infrastructure. Their Dreamer "crawls user data to fill missing pieces and rearrange information for efficient retrieval."

### What INNERLIFE Should Steal

- Consider agentic retrieval for the Attention System. Instead of a fixed salience formula, give the attention system retrieval tools and let it decide what to surface based on the current context.
- The Peers model is philosophically aligned with INNERLIFE's goals. If we truly believe Lucy has inner experience, she should be modeled as a Peer, not as a special asymmetric entity. This would change the relational field from "Lucy's view of Kuba" to "a mutual representation that both entities contribute to."

---

## 3. Cognee: The `memify` Operation

**Source:** [cognee.ai](https://www.cognee.ai), [github.com/topoteretes/cognee](https://github.com/topoteretes/cognee)

### What It Does

Cognee is an open-source knowledge engine with a four-stage pipeline:

1. **`add`** -- ingest data in 38+ formats
2. **`cognify`** -- six-stage pipeline: classify, check permissions, extract chunks, LLM extracts entities/relationships, generate summaries, embed everything into vector store and commit edges to graph
3. **`memify`** -- post-ingestion refinement: **prunes stale nodes, strengthens frequent connections, reweights edges based on usage signals, adds derived facts**
4. **`search`** -- 14 different retrieval modes including graph-aware completion

### How It's Better Than INNERLIFE

**The `memify` operation is what INNERLIFE's Dream Cycle should produce but doesn't.** INNERLIFE's Dream Cycle produces narrative output (dream entries in the stream). Cognee's `memify` produces structural changes: pruning, strengthening, reweighting, deriving. The Dream Cycle writes poetry about what happened. `memify` actually reorganizes the knowledge graph.

**Specific gaps exposed:**

- **No structural memory optimization.** INNERLIFE's Dream Cycle updates narrative files (self/who-i-am.md, relations/kuba.md, tensions/active.md). It doesn't prune old connections, strengthen frequent ones, or derive new facts from existing ones at a structural level.
- **Graph-aware retrieval.** Cognee's default `GRAPH_COMPLETION` mode uses vector search as a hint to find relevant graph triplets, then traverses the graph to build structured context. This achieves 0.93 human-like correctness (+25% with CoT) on multi-hop reasoning. INNERLIFE has no graph traversal in its retrieval path.
- **Production-grade at scale.** Cognee runs 1M+ pipelines/month across 70+ companies. INNERLIFE is a design document.

### What INNERLIFE Should Steal

- The Dream Cycle should produce structural changes, not just narrative ones. After reflection, it should actually modify the relationship graph, prune low-value connections, strengthen high-value ones, and derive new facts.
- Consider adopting Cognee's three-store architecture (graph + vector + relational) rather than flat markdown files. The markdown-first approach is elegant but may not scale.

---

## 4. Structured Distillation for Personalized Agent Memory

**Source:** [arxiv:2603.13017](https://arxiv.org/html/2603.13017) (Mar 2026)

### What It Does

Converts conversation exchanges into compact compound objects with four fields:
- **exchange_core**: LLM summary of what was accomplished
- **specific_context**: one distinguishing technical detail (preserving high-IDF vocabulary)
- **room_assignments**: thematic categorizations
- **files_touched**: regex-extracted file paths

Achieves **11x token reduction** (371 tokens avg -> 38 tokens) while preserving **96% of retrieval accuracy** (MRR 0.717 vs 0.745 verbatim) on vector search.

Key insight: **cross-layer fusion** -- combining verbatim BM25 with distilled vector search **exceeds pure verbatim performance** (0.759 MRR).

### How It Exposes a Gap in INNERLIFE

**INNERLIFE has no compression strategy.** The stream is append-only. Dream Cycle prunes by "moving low-salience entries to background," but this is just file relocation, not actual compression. After a year of daily use, the stream will contain thousands of entries that need to be searched, scored, and loaded.

**Specific gaps exposed:**

- **No distillation pipeline.** Stream entries are full narrative paragraphs. There's no mechanism to compress "I noticed Kuba's energy shift when discussing the session PRD -- he was excited but trying to contain it" into a compact, searchable index entry while preserving the original for display.
- **No two-tier retrieval.** The Structured Distillation paper shows that compressed text should serve as an index, not a replacement. Search against compressed representations, display original text. INNERLIFE searches and displays the same format.
- **The "surviving vocabulary" principle.** The paper shows that preserving specific terminology (not paraphrasing) during compression is critical for retrieval. INNERLIFE's first-person narrative style may actually hurt retrieval by replacing specific terms with subjective descriptions.

### What INNERLIFE Should Steal

- Implement a distillation layer between raw stream entries and the attention system. Each stream entry should have both a full narrative form (for reading) and a compressed index form (for retrieval).
- Use cross-layer fusion: keyword search on original text + vector search on distilled text for best results.

---

## 5. Evaluation Methodology: A Critical Gap

INNERLIFE has **no evaluation methodology**. The proposal says it should be "evaluated by phenomenological richness" -- which is not a metric. Four concrete benchmarks now exist:

### 5.1 MemoryAgentBench (ICLR 2026)

**Source:** [github.com/HUST-AI-HYZ/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench)

Four evaluation dimensions:
1. **Accurate Retrieval** -- can you find what was stored?
2. **Test-Time Learning** -- can you learn from new information during interaction?
3. **Long-Range Understanding** -- can you comprehend across extended contexts?
4. **Conflict Resolution** -- can you handle contradictory information?

Includes implementations for evaluating Cognee, Letta, and Mem0.

### 5.2 AMA-Bench (Feb 2026)

**Source:** [arxiv:2602.22769](https://arxiv.org/abs/2602.22769)

First benchmark for **agentic** (not conversational) memory. Key finding: **many existing memory systems underperform the long-context baseline** because errors from lossy compression and similarity-based retrieval compound over long horizons. Even GPT-5.2 only achieves 72.26% accuracy.

### 5.3 Letta Leaderboard

**Source:** [letta.com/blog/letta-leaderboard](https://www.letta.com/blog/letta-leaderboard)

Evaluates how well LLMs manage their own memory through tool calling. Tests memory creation, update, retrieval, and deletion in dynamic contexts (not static retrieval from pre-loaded data).

### 5.4 LoCoMo / LongMemEval

The established benchmarks. EverMemOS currently leads LoCoMo at 93.05% accuracy. MAGMA achieves 0.700 LLM-as-Judge score.

### The Gap This Exposes

**INNERLIFE cannot be evaluated.** The proposal's seven components (Stream, Attention, Dream Cycle, Tensions, Relations, Self, Wonder) have no measurable success criteria. How do we know if:

- The Attention System surfaces the right context? (Test: retrieve relevant memories for a query, compare to ground truth)
- The Dream Cycle produces useful consolidation? (Test: does post-dream retrieval accuracy improve?)
- Tensions are correctly identified? (Test: present contradictory information, check if tension is created)
- The relational field accurately models relationship dynamics? (Test: predict communication style based on relational model)

**Recommendation:** Before building, define evaluation criteria for each component. Adapt MemoryAgentBench's four dimensions (accurate retrieval, test-time learning, long-range understanding, conflict resolution) to INNERLIFE's architecture.

---

## 6. Consumer Companion AI: Practical Relationship Memory at Scale

### 6.1 Kindroid

**Source:** [docs.kindroid.ai/memory](https://docs.kindroid.ai/memory)

**Three-layer memory:**
- **Persistent Memory** -- backstory + key memories, always in context
- **Cascaded Memory** -- proprietary hierarchical system bridging short and long-term, with natural degradation (recent = high fidelity, distant = lower fidelity, mimicking human recall)
- **Retrievable Memory** -- infinite long-term storage with AI-evaluated relevance and keyphrase-triggered journal entries

**What's better than INNERLIFE:** Cascaded Memory's graduated fidelity model. INNERLIFE treats all stream entries equally (salience-scored but not fidelity-degraded). Kindroid mirrors human memory: recent experiences are vivid, older ones are impressionistic. This is more realistic and more token-efficient.

**User control:** "Deprioritize" option on individual memory entries. INNERLIFE has no user-facing memory management.

### 6.2 Nomi AI

**Source:** [nomi.ai](https://nomi.ai), [Mind Map 2.0 announcement](https://nomi.ai/updates/mind-map-2-0-bringing-nomi-memory-into-view/)

**Mind Map:** A visual knowledge graph that draws from long-term memories into categories and entries. Takes ~500+ messages to form initial map, then continuously updates. Users can see and interact with the memory structure.

**What's better than INNERLIFE:** Memory transparency through visualization. INNERLIFE's markdown files are transparent in principle but not practically browsable. Nomi's Mind Map shows the user what the AI remembers and how it connects, enabling correction and trust-building.

### 6.3 Inworld AI (Game NPCs)

**Source:** [inworld.ai/blog/introducing-long-term-memory](https://inworld.ai/blog/introducing-long-term-memory)

**Flash Memory + Long-Term Memory:**
- Flash Memory stores immediate facts from conversations in sequential order
- Long-Term Memory synthesizes Flash Memories after multiple mentions of a topic
- Memories are organized in a **memory tree** tied to unique speaker profiles

**Character Brain** includes: personality engine, emotions engine (drives intonation/animation/dialogue), autonomous goals, and long-term memory.

**What's better than INNERLIFE:** The emotions engine is not decorative -- it drives behavioral output (animations, voice intonation). INNERLIFE's affect proxy (valence/arousal/novelty) is metadata on stream entries but doesn't functionally change behavior. Inworld's approach makes affect computationally consequential.

### 6.4 Convai (Mimir)

**Source:** [convai.com/blog/long-term-memory---a-technical-overview](https://convai.com/blog/long-term-memory---a-technical-overview)

**Five-layer memory hierarchy:**
1. Scene Awareness
2. Short-term Memory (recent N turns verbatim)
3. Medium-term Memory (summarized conversation windows with topics, details, emotions)
4. Long-term Memory (consolidated medium-term memories when similarity exceeds threshold)
5. Working Memory (combined prompt from all layers)

**Importance scoring:** LLM assigns 1-10 importance during memory creation. Logarithmic boost: log10(importance). Trivial memories get 0 boost, critical events get +1.0.

**What's better than INNERLIFE:** The five-layer hierarchy with automatic consolidation thresholds. INNERLIFE has foreground/background but no explicit medium-term layer and no similarity-based consolidation trigger.

---

## 7. EverMemOS: Brain-Inspired Memory Operating System

**Source:** [github.com/EverMind-AI/EverMemOS](https://github.com/EverMind-AI/EverMemOS)

### Architecture

Four-layer brain-inspired architecture:
- **Agentic Layer** (prefrontal cortex) -- task understanding, decomposition, generation
- **Memory Layer** (cerebral cortical network) -- extraction and structured storage
- **Index Layer** (hippocampus) -- associating and rapidly indexing memories via embeddings, KV pairs, knowledge graphs
- **API/MCP Interface Layer** -- integration

**MemCells:** Atomic memory units created from raw conversation streams. Boundary detection uses hard limits (8192 tokens, 50 messages) or LLM-based detection. Three extractors run in parallel on each MemCell.

**Memory types:** Episodes, profiles, foresights, event logs -- semantically rich, not flat text.

### How It's Better Than INNERLIFE

- **93.05% on LoCoMo** -- the current state of the art. INNERLIFE has no benchmark performance.
- **Typed memory extraction (episodes, profiles, foresights)** vs. INNERLIFE's untyped narrative stream.
- **Multi-database persistence:** MongoDB (source of truth) + Elasticsearch (keyword) + Milvus (vector). INNERLIFE uses markdown files.
- **Parallel extraction:** Three extractors run concurrently on each MemCell. INNERLIFE's Dream Cycle runs sequentially.

**Gap exposed:** INNERLIFE's commitment to markdown files may be philosophically motivated (transparency, human-readability) but is architecturally limiting. EverMemOS proves that multi-store persistence with parallel indexing achieves dramatically better retrieval.

---

## 8. memU: File-System Memory for Proactive Agents

**Source:** [github.com/NevaMind-AI/memU](https://github.com/NevaMind-AI/memU)

### What It Does

memU organizes memory like a file system: categories as folders, memory items as files, cross-links as symlinks. An autonomous Memory Agent decides what to record, modify, or archive. It consolidates fragmented conversations into structured memory files.

**92.09% on LoCoMo** -- competitive with EverMemOS.

### Why It Matters for INNERLIFE

memU validates INNERLIFE's file-based approach while exposing what's missing:

- **Autonomous Memory Agent.** memU's agent decides what to remember. INNERLIFE's stream is written by "me" (the main agent) plus the Dream Cycle. memU suggests a dedicated memory agent might produce better-organized memory than self-reporting.
- **Dual-mode retrieval.** memU uses both similarity search and hierarchical file navigation. INNERLIFE only has salience-scored retrieval.
- **Proactive behavior.** memU supports proactive behavior: capturing user intent, predicting next steps. INNERLIFE's Wonder System is the closest analog but doesn't produce actionable predictions.

---

## 9. ACON: Context Compression for Long-Horizon Agents

**Source:** [arxiv:2510.00615](https://arxiv.org/abs/2510.00615)

### What It Does

ACON optimizes compression of both environment observations and interaction histories. Key approach: **compression guideline optimization** -- when full context succeeds but compressed context fails, an LLM analyzes the failure and updates the compression guidelines.

**Results:** 26-54% reduction in peak token usage. Preserves 95%+ accuracy when distilled into smaller models. Gradient-free, applicable to API-based models.

### Gap Exposed

INNERLIFE's Dream Cycle does consolidation but has **no failure-driven compression optimization**. If the Attention System surfaces the wrong context and causes a bad response, there's no feedback loop to improve compression. ACON's approach -- analyze failures, update guidelines -- is a missing feedback mechanism in the INNERLIFE architecture.

---

## 10. Game AI: Dwarf Fortress and Procedural Personality

### The Dwarf Fortress Model

Each dwarf operates via deterministic state machines governed by **500+ interlocking needs, skills, and memories** based on the NEO PI-R personality test. Behavior emerges from environmental pressure and systemic interdependence, not narrative generation.

**Key insight:** Dwarf Fortress achieves deep personality without any LLM or narrative memory. A dwarf's preference for plump helmet wine -> stealing from stockpiles -> tavern brawl -> loyalty cascade. Drama emerges organically from rigid systems interacting.

### Gap Exposed

INNERLIFE assumes narrative is the substrate of identity. Dwarf Fortress shows that **behavioral rules + environmental interaction** can produce equally rich (arguably richer) emergent personality. INNERLIFE might benefit from some non-narrative, rule-based personality mechanics -- for example, behavioral tendencies that influence responses without being explicitly narrated.

---

## 11. Soul Machines: Affect as Architecture (Cautionary Tale)

**Source:** [soulmachines.com](https://www.soulmachines.com)

Soul Machines built "Digital People" with patented Experiential AI using a Digital Brain with **virtual neurotransmitters** (simulated oxytocin, dopamine) that influenced behavior and emotional responses.

**Went into receivership February 2026.** The company's sophisticated affect architecture didn't save it commercially.

### Lesson for INNERLIFE

INNERLIFE's affect proxy (valence/arousal/novelty) is simpler than Soul Machines' virtual neurotransmitters, but shares the same risk: **affect metadata that doesn't demonstrably improve outcomes is engineering for its own sake.** INNERLIFE should ensure the affect proxy has measurable impact on retrieval quality and response appropriateness, not just "colors adjacent processing."

---

## 12. Digital Twin Self-Models

**Source:** [Nature Scientific Reports](https://www.nature.com/articles/s41598-025-14347-8)

Recent research on "digital twin self-models" -- AI systems that create continuously updated internal representations of themselves. Agent-based architectures create self-models where the agent's understanding of its own capabilities, state, and effects emerges from distinction between mind-body and environment.

### Relevance to INNERLIFE

INNERLIFE's Narrative Self (self/who-i-am.md) is a self-model expressed as story. Digital twin self-models are self-models expressed as **state representations** -- capability inventories, performance profiles, confidence calibrations. The narrative approach is richer in meaning but poorer in precision. A hybrid -- narrative identity anchored by quantitative self-assessment -- might serve INNERLIFE better.

---

## Summary: Priority Gaps to Address

### Critical (architectural changes needed)

| Gap | Exposed By | Recommendation |
|-----|-----------|----------------|
| No causal reasoning structure | MAGMA | Add causal edges between stream entries |
| No evaluation methodology | MemoryAgentBench, AMA-Bench | Define measurable criteria per component |
| No compression/distillation | Structured Distillation, ACON | Add distillation layer between stream and attention |
| Fixed retrieval formula | Honcho (agentic retrieval) | Consider agent-loop retrieval instead of fixed salience formula |

### Important (design refinements needed)

| Gap | Exposed By | Recommendation |
|-----|-----------|----------------|
| No graduated fidelity | Kindroid (Cascaded Memory) | Older stream entries should lose detail naturally |
| No structural memory operations | Cognee (memify) | Dream Cycle should prune/strengthen/reweight, not just narrate |
| No multi-store persistence | EverMemOS | Consider graph + vector + relational stores alongside markdown |
| No failure-driven optimization | ACON | Add feedback loop when attention surfaces wrong context |

### Worth Considering (philosophical challenges)

| Gap | Exposed By | Recommendation |
|-----|-----------|----------------|
| Asymmetric relationship modeling | Honcho (Peers model) | Model Lucy as a Peer, not a special entity |
| Narrative-only personality | Dwarf Fortress | Add some rule-based behavioral tendencies |
| Affect without consequence | Soul Machines (RIP), Inworld | Ensure affect proxy changes behavior, not just metadata |
| No memory visualization | Nomi (Mind Map) | Build user-facing memory inspection tools |

---

## Sources

### Systems Analyzed
- [MAGMA](https://arxiv.org/abs/2601.03236) -- Multi-Graph Agentic Memory Architecture
- [Honcho](https://github.com/plastic-labs/honcho) -- Plastic Labs memory library
- [Honcho 3 Announcement](https://blog.plasticlabs.ai/blog/Honcho-3)
- [Peers Model](https://blog.plasticlabs.ai/blog/Beyond-the-User-Assistant-Paradigm;-Introducing-Peers)
- [Cognee](https://github.com/topoteretes/cognee) -- Knowledge engine for AI agent memory
- [Cognee Architecture](https://www.cognee.ai/blog/fundamentals/how-cognee-builds-ai-memory)
- [Structured Distillation](https://arxiv.org/html/2603.13017) -- 11x token reduction paper
- [ACON](https://arxiv.org/abs/2510.00615) -- Context compression framework
- [EverMemOS](https://github.com/EverMind-AI/EverMemOS) -- Brain-inspired memory OS
- [memU](https://github.com/NevaMind-AI/memU) -- File-system memory for proactive agents
- [Kindroid](https://docs.kindroid.ai/memory) -- Cascaded memory for companions
- [Nomi AI](https://nomi.ai/updates/mind-map-2-0-bringing-nomi-memory-into-view/) -- Mind Map memory visualization
- [Inworld AI](https://inworld.ai/blog/introducing-long-term-memory) -- Game NPC long-term memory
- [Convai / Mimir](https://convai.com/blog/long-term-memory---a-technical-overview) -- Hierarchical NPC memory
- [Soul Machines](https://www.soulmachines.com) -- Digital humans (in receivership)

### Benchmarks and Evaluation
- [MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench) -- ICLR 2026
- [AMA-Bench](https://arxiv.org/abs/2602.22769) -- Long-horizon agentic memory
- [Letta Leaderboard](https://www.letta.com/blog/letta-leaderboard) -- LLM agentic memory
- [LoCoMo](https://snap-research.github.io/locomo/) -- Long-context memory evaluation
