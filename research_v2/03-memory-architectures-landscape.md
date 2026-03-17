# Memory Architectures for AI Agents: Deep Landscape Analysis

> Research compiled 2026-03-16. Covers the major open-source and academic memory systems for LLM-based agents, with implementation-level detail.

---

## Table of Contents

1. [Letta (formerly MemGPT)](#1-letta-formerly-memgpt)
2. [Mem0](#2-mem0)
3. [Zep / Graphiti](#3-zep--graphiti)
4. [A-MEM](#4-a-mem-agentic-memory)
5. [LangMem SDK](#5-langmem-sdk)
6. [MemoryOS](#6-memoryos)
7. [Supermemory](#7-supermemory)
8. [Cross-System Analysis](#8-cross-system-analysis)
9. [Memory Taxonomy](#9-memory-taxonomy-from-cognitive-science)
10. [Design Principles for Lucy](#10-design-principles-for-lucy)

---

## 1. Letta (formerly MemGPT)

**Origin:** MemGPT paper (arXiv:2310.08560, Oct 2023) by Packer, Wooders, Lin, Fang, Patil, Gonzalez at UC Berkeley. Evolved into Letta, the commercial platform. 21.6k GitHub stars.

### Core Metaphor: LLM as Operating System

The foundational insight is treating the LLM's context window as **RAM** and external storage as **disk**. Just as an OS uses virtual memory to give processes the illusion of unlimited memory through paging, MemGPT gives an LLM the illusion of unlimited context through function-call-driven data movement.

### Memory Model: Two-Tier Hierarchy

```
┌─────────────────────────────────────────────┐
│  MAIN CONTEXT (In-Context = "RAM")          │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  System Instructions (read-only)    │    │
│  │  - Control flow docs               │    │
│  │  - Tool documentation               │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Core Memory (limited, writeable)   │    │
│  │  - "persona" block: agent identity  │    │
│  │  - "human" block: user facts        │    │
│  │  - Custom blocks (labeled, bounded) │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Conversation Buffer (FIFO queue)   │    │
│  │  - Recent messages                  │    │
│  │  - Evicted when full -> summarized  │    │
│  └─────────────────────────────────────┘    │
│                                             │
└──────────────────┬──────────────────────────┘
                   │  Function calls move data
                   ▼
┌─────────────────────────────────────────────┐
│  EXTERNAL CONTEXT (Out-of-Context = "Disk") │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Archival Memory                    │    │
│  │  - Infinite-capacity knowledge base │    │
│  │  - Embedding-based semantic search  │    │
│  │  - Agent explicitly inserts/queries │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Recall Memory                      │    │
│  │  - Complete uncompressed history    │    │
│  │  - All messages, tool calls, returns│    │
│  │  - Date search + text search        │    │
│  │  - Auto-saved, never lost           │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### Memory Tools (6 Core Functions)

The agent manages its own memory through function calls:

| Tool | Direction | Purpose |
|------|-----------|---------|
| `core_memory_append` | Write in-context | Add facts to a core memory block |
| `core_memory_replace` | Write in-context | Overwrite text in a core memory block |
| `archival_memory_insert` | Write to disk | Store knowledge in archival storage |
| `archival_memory_search` | Read from disk | Semantic search over archival storage |
| `conversation_search` | Read from disk | Search recall memory by date or text |
| `send_message` | Output | Respond to user |

### Memory Lifecycle

1. **Creation:** Agent decides what to remember via `core_memory_append` or `archival_memory_insert`. Core memory is always visible; archival requires explicit retrieval.
2. **Retrieval:** Agent searches archival or recall memory when it needs information not in its context window. Search is embedding-based for archival, date/text for recall.
3. **Update:** Agent uses `core_memory_replace` to modify existing core memory blocks (e.g., updating a user's job title). This is a text-level find-and-replace within the block.
4. **Eviction:** When the conversation buffer fills, ~70% of oldest messages are evicted. A recursive summarization compresses them into the system message. The raw messages remain in recall memory.
5. **Decay/Deletion:** No automatic decay. Archival memory persists indefinitely. The agent can choose not to retrieve information, effectively forgetting it.

### Control Flow: Interrupt-Driven

The agent operates in "burst" mode:
- An **event** (user message, scheduled heartbeat, system trigger) activates the agent
- The agent processes the event, potentially making multiple function calls
- Function calls can request a `heartbeat` for immediate re-execution (chaining operations)
- The agent eventually suspends until the next event

### Key Innovation: Shared Memory Blocks

Memory blocks can be attached to multiple agents simultaneously. This enables:
- A "team knowledge" block shared across agents
- A "user profile" block that any agent can read/write
- Cross-agent coordination through shared state

### Sleep-Time Compute

Letta implements asynchronous memory management during idle periods:
- Non-blocking memory refinement (not during active conversations)
- Proactive consolidation of important information
- Specialized "sleep-time agents" can modify core memory blocks

### What Works Well
- The OS metaphor is elegant and extensible
- Agent-controlled memory is more adaptive than rule-based approaches
- Core memory blocks are always visible, ensuring critical context is never lost
- Recall memory is lossless -- nothing is permanently deleted

### What Doesn't
- Heavy reliance on LLM quality for memory management decisions
- No automatic consolidation or abstraction of archival memory
- Memory tools consume function-call budget (competes with task tools)
- Archival memory can grow unboundedly with no cleanup mechanism
- The FIFO eviction + summarization loses nuance from older conversations

---

## 2. Mem0

**Origin:** Open-source memory layer for AI (50.1k GitHub stars). Published paper: "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory" (arXiv:2504.19413, Apr 2025).

### Core Model: Extract-Then-Update Pipeline

Mem0 doesn't store raw conversations. Instead, it runs a two-phase pipeline that extracts salient facts and manages them as first-class memory objects.

### Architecture

```
┌───────────────────────────────────────────────┐
│  INPUT: Message Pair (m_{t-1}, m_t)           │
│                                               │
│  Combined with:                               │
│  - Conversation summary S (from DB)           │
│  - Recent messages {m_{t-m}...m_{t-2}} (m=10) │
│  - Current message pair                       │
│                                               │
│         ┌──────────────┐                      │
│         │  Extraction  │                      │
│         │  LLM (φ)     │─── Ω = {ω₁..ωₙ}     │
│         └──────┬───────┘    (extracted facts)  │
│                │                              │
│                ▼                              │
│  ┌─────────────────────────────┐              │
│  │  For each fact ωᵢ:          │              │
│  │  1. Embed ωᵢ                │              │
│  │  2. Retrieve top-s similar  │              │
│  │     existing memories (s=10)│              │
│  │  3. LLM classifies:        │              │
│  │     ADD / UPDATE / DELETE   │              │
│  │     / NOOP                  │              │
│  └─────────────────────────────┘              │
│                                               │
│         ┌──────────────┐                      │
│         │  Vector DB   │ (dense embeddings)   │
│         └──────────────┘                      │
│         ┌──────────────┐                      │
│         │  Graph DB    │ (Neo4j -- optional)  │
│         │  (Mem0^g)    │                      │
│         └──────────────┘                      │
└───────────────────────────────────────────────┘
```

### Three Memory Scopes

| Scope | Persistence | Purpose |
|-------|-------------|---------|
| User Memory | Cross-session | Long-term preferences, facts about the user |
| Session Memory | Single conversation | Context within one interaction |
| Agent Memory | Cross-session | Agent's own state, learned behaviors |

### Graph Memory (Mem0^g)

The graph layer runs in parallel with vector storage:

**Entity Extraction Pipeline:**
1. `EXTRACT_ENTITIES_TOOL` identifies entities with type classification (people, locations, concepts, events)
2. `RELATIONS_TOOL` detects relationships between entities, generating labeled triplets `(v_s, relation, v_d)`
3. Embeddings generated for each entity via `EmbedderFactory`
4. Cosine similarity search against existing nodes (threshold: 0.7)
5. `Conflict Detector` flags overlapping/contradictory nodes and edges
6. LLM-powered `Update Resolver` decides: ADD, UPDATE (merge), DELETE (invalidate), or SKIP

**Graph Structure:** Directed labeled graph `G = (V, E, L)` where:
- **Nodes (V):** Entities with type, semantic embedding, creation timestamp
- **Edges (E):** Relationships as triplets `(source, relation, destination)`
- **Labels (L):** Semantic types on nodes

**Storage backends:** Neo4j, Memgraph, Amazon Neptune, Kuzu (embedded)

**Conflict Resolution:** Contradictory relationships are marked invalid rather than physically deleted, enabling temporal reasoning. The LLM compares new facts against existing relationships and determines whether older facts should be superseded.

### Implementation Details

- **LLM backbone:** GPT-4o-mini for extraction and classification
- **Embeddings:** OpenAI text-embedding-3-small
- **Concurrency:** `ThreadPoolExecutor` runs vector and graph operations in parallel
- **Memory footprint:** ~7k tokens per conversation (Mem0), ~14k tokens (Mem0^g)
- **Async summary generation** runs independently without blocking

### Benchmark Results (LOCOMO)

| Task | Mem0 F1 | Mem0^g F1 | Notes |
|------|---------|-----------|-------|
| Single-Hop | 38.72 | Slightly lower | Vector search sufficient |
| Multi-Hop | 28.64 | Lower | Graph navigation inefficient for complex integration |
| Temporal | 45.83 | **51.55** | Graph structure aids chronological reasoning |
| Open-Domain | Competitive | Competitive | Zep slightly edges both |

**Latency:** Mem0 search p50 = 148ms, p95 = 200ms. Total response p50 = 708ms, p95 = 1.44s.

**vs. Full Context:** 91% faster, 90% fewer tokens, near-competitive accuracy.

### What Works Well
- Extremely token-efficient (7k tokens vs 600k+ for Zep's raw approach)
- Clean extract-then-update pipeline is predictable
- Graph memory excels at temporal reasoning
- Production-ready with hosted platform
- Parallel vector + graph retrieval

### What Doesn't
- Graph memory roughly doubles token footprint without proportional accuracy gains
- Multi-hop reasoning through graph is weaker than expected
- Entity extraction quality depends entirely on LLM
- No procedural memory (how to do things)
- No memory consolidation or abstraction over time

---

## 3. Zep / Graphiti

**Origin:** Zep is a commercial memory platform. Graphiti is their open-source temporal knowledge graph engine. Paper: "Zep: A Temporal Knowledge Graph Architecture for Agent Memory" (arXiv:2501.13956, Jan 2025).

### Core Innovation: Bi-Temporal Knowledge Graph

Zep's key insight is that facts change over time, and a memory system must track **when facts were true** (not just when they were stored). This is implemented through a dual-timeline model.

### Three-Tier Subgraph Architecture

```
┌─────────────────────────────────────────────────┐
│  Community Subgraph (𝒢ₓ) — Highest Abstraction  │
│  - Cluster nodes = groups of related entities    │
│  - Map-reduce summarization of members           │
│  - Named with key terms for embedding search     │
│  - Label propagation for community detection     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│  Semantic Entity Subgraph (𝒢ₛ) — Middle Tier    │
│  - Entity nodes extracted from episodes          │
│  - Semantic edges = relationships between        │
│    entities                                      │
│  - 1024-dimensional vector embeddings            │
│  - Entity resolution (dedup via similarity)      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│  Episode Subgraph (𝒢ₑ) — Raw Data               │
│  - Episode nodes = raw messages, JSON, logs      │
│  - Non-lossy data repositories                   │
│  - Episodic edges connect episodes to entities   │
│  - Annotated with original event timestamps      │
└─────────────────────────────────────────────────┘
```

### Bi-Temporal Fact Tracking

Every edge (fact) carries four timestamps:

| Timestamp | Timeline | Meaning |
|-----------|----------|---------|
| `t'_created` | Transaction (T') | When the fact entered the system |
| `t'_expired` | Transaction (T') | When the fact was superseded in the system |
| `t_valid` | Event (T) | When the fact actually became true |
| `t_invalid` | Event (T) | When the fact stopped being true |

**Contradiction Resolution:** When new information contradicts an existing fact with overlapping temporal range, the system identifies the contradiction and sets the old edge's `t_invalid` to match the new edge's `t_valid`. Example: "Alice works at Google" (valid 2020-2024) gets invalidated when "Alice joined Meta" (valid 2024-present) is ingested.

### Entity Extraction and Resolution Pipeline

1. Process current message + preceding n=4 messages for context
2. Speaker is automatically extracted as an entity
3. Reflection technique (inspired by Reflexion) minimizes hallucinations
4. Entity summaries generated for resolution
5. Entities embedded into 1024-dim vectors
6. Cosine similarity + full-text search find existing candidates
7. LLM processes candidates to detect duplicates
8. Merged entities get updated name and summary
9. **Cypher queries are predefined** (not LLM-generated) for data integrity

### Fact Extraction and Edge Management

- Facts extracted with predicates connecting entity pairs
- Same fact can be extracted between multiple entity pairs (hyper-edges)
- Edge deduplication constrains searches to edges between identical entity pairs
- LLM compares new edges against semantically related existing edges for contradictions

### Hybrid Retrieval: f(a) = X(p(phi(a)))

Three-stage pipeline:

**1. Search (phi) -- Three methods in parallel:**
- `phi_cos`: Cosine similarity in embedding space
- `phi_bm25`: BM25 full-text keyword matching (Neo4j Lucene)
- `phi_bfs`: Breadth-first graph traversal within n-hops

**2. Reranking (p) -- Multiple strategies:**
- Reciprocal Rank Fusion (RRF)
- Maximal Marginal Relevance (MMR)
- Episode-mentions reranker (frequency-based)
- Node distance reranker (graph-distance)
- Cross-encoder LLMs (highest quality, highest cost)

**3. Construction (X):**
- Formats ranked results into context: fact descriptions, validity ranges, entity summaries, community summaries

### Community Detection

Uses **label propagation** (not Leiden as in GraphRAG). Dynamic extension: new nodes survey neighboring communities and join the plurality. Periodic full refreshes needed as incremental updates drift.

### Benchmark Performance

**LongMemEval (115k-token conversations):**
- gpt-4o accuracy: 60.2% -> 71.2% (+18.5% improvement)
- gpt-4o-mini accuracy: 55.4% -> 63.8% (+15.2%)
- Latency: 90% reduction (31.3s -> 3.2s for gpt-4o-mini)
- Context: 115k tokens -> 1.6k tokens average

**Strongest categories:** single-session-preference (+77.7%), temporal-reasoning (+48.2%), multi-session (+16.7%)

### Implementation Stack
- Neo4j (graph database)
- BGE-m3 (embeddings and reranking)
- GPT-4o-mini (graph construction)
- Predefined Cypher queries (not LLM-generated)

### What Works Well
- Bi-temporal model is genuinely novel and handles real-world fact changes
- Three-tier abstraction (episodes -> entities -> communities) mirrors human memory
- Hybrid retrieval (semantic + keyword + graph) covers different query types
- Massive context reduction (115k -> 1.6k tokens) with accuracy gains
- Predefined Cypher prevents graph corruption

### What Doesn't
- Complex infrastructure (Neo4j + embedding model + LLM + rerankers)
- 600k+ tokens stored per conversation (raw, before compression)
- Performance degrades on "single-session-assistant" questions (-17.7%)
- Community summaries drift without periodic full refreshes
- High computational cost for cross-encoder reranking

---

## 4. A-MEM (Agentic Memory)

**Origin:** "A-MEM: Agentic Memory for LLM Agents" -- NeurIPS 2025. By Xu, Liang et al.

### Core Insight: Zettelkasten for Agents

A-MEM treats the memory system itself as an agent, capable of autonomously organizing, linking, and evolving memories. Inspired by the Zettelkasten method (slip-box note-taking), where knowledge is stored as atomic, interconnected notes.

### Note Structure

Each memory unit is a structured note:

```
┌──────────────────────────────┐
│  Note                        │
│  ├── note_id: string         │
│  ├── content: string         │
│  ├── timestamp: datetime     │
│  ├── contextual_description  │
│  ├── keywords: string[]      │
│  ├── tags: string[]          │
│  ├── embedding: vector       │
│  └── links: note_id[]        │
└──────────────────────────────┘
```

### Three Core Operations

**1. Note Construction**
- New interaction/observation enters the system
- LLM generates a structured note with contextual description, keywords, and tags
- Note is embedded for similarity search
- Indexed in the memory store

**2. Link Generation**
- Retrieve top-k most relevant historical notes by embedding similarity
- LLM evaluates whether meaningful connections exist between new and existing notes
- Connections established based on similar contextual descriptions (Zettelkasten-style)
- Links are bidirectional -- old notes gain links to new notes

**3. Memory Evolution**
- When new notes are integrated, they can trigger updates to existing notes
- Contextual representations and attributes of historical notes are refined
- The memory network continuously self-improves its understanding
- This is the key differentiator: memory is not append-only

### Retrieval Algorithm

1. Convert query to embedding
2. Compute similarity scores against all indexed notes
3. Return top-k notes above relevance threshold
4. Follow links from retrieved notes to discover related context
5. Optionally rerank using task-specific criteria

### Performance

- Doubles performance on complex multi-hop reasoning tasks vs baselines
- Tested across 6 foundation models
- Outperforms MemGPT, MemoryBank, LoCoMo on task completion accuracy
- Cost-effective despite multiple LLM calls per memory operation

### What Works Well
- Memory evolution prevents staleness -- old memories get refined
- Link structure enables multi-hop reasoning through note traversal
- Zettelkasten metaphor produces well-organized, atomic memories
- Agentic approach adapts to different task domains

### What Doesn't
- Multiple LLM calls per memory operation (construction + linking + evolution)
- No temporal reasoning -- notes don't track validity periods
- No explicit short-term / long-term distinction
- Link quality depends entirely on LLM judgment
- Scaling unclear -- how does link generation work with millions of notes?

---

## 5. LangMem SDK

**Origin:** LangChain's official memory SDK (Feb 2025). Open-source, framework-agnostic but natively integrates with LangGraph.

### Memory Types

LangMem implements the cognitive science memory taxonomy directly:

**Semantic Memory** -- Facts and knowledge:
- Extracted from conversations automatically
- Stored as key-value pairs with embeddings
- Example: "User prefers dark mode", "User's name is Alice"
- Managed via `create_manage_memory_tool` and `create_search_memory_tool`

**Episodic Memory** -- Records of specific interactions:
- Distilled from longer raw interactions into few-shot examples
- Preserves the context and outcome of past experiences
- Enables learning from analogous situations

**Procedural Memory** -- How to do things:
- Learned procedures saved as updated instructions in the agent's prompt
- System prompt optimization based on interaction patterns
- The agent literally rewrites its own instructions over time

### Core API

```python
# Agent-controlled memory tools
manage_tool = create_manage_memory_tool(namespace=("memories",))
search_tool = create_search_memory_tool(namespace=("memories",))

# Attach to any agent
agent = create_react_agent(
    "anthropic:claude-3-5-sonnet-latest",
    tools=[manage_tool, search_tool],
    store=AsyncPostgresStore(...)  # or InMemoryStore
)
```

### Storage Architecture

- Uses LangGraph's `BaseStore` abstraction
- Namespace isolation: `namespace=("memories", user_id)` separates per-user data
- Vector embeddings for semantic search (configurable: `openai:text-embedding-3-small`)
- Backend-agnostic: InMemoryStore, AsyncPostgresStore, or custom

### Prompt Optimization

LangMem can analyze conversation outcomes and update the agent's system prompt:
- Single-system optimization (one prompt)
- Compound-system optimization (multi-step pipelines)
- Background processing during idle time

### What Works Well
- Clean separation of semantic/episodic/procedural memory
- Procedural memory (prompt self-optimization) is unique and powerful
- Framework-agnostic core API
- Namespace isolation is simple and effective

### What Doesn't
- Relatively thin wrapper -- most complexity lives in the LLM calls
- No graph-based memory or relationship tracking
- No temporal reasoning
- Procedural memory (prompt rewriting) can be unstable without guardrails

---

## 6. MemoryOS

**Origin:** "Memory OS of AI Agent" -- EMNLP 2025 Oral. By Kang et al.

### Core Model: Three-Level Storage Hierarchy

Inspired directly by OS memory management with explicit short/mid/long-term tiers:

```
┌────────────────────────────────────────┐
│  Short-Term Memory                     │
│  - Current conversation context        │
│  - FIFO eviction to mid-term           │
│  - Dialogue-chain-based ordering       │
└──────────────────┬─────────────────────┘
                   │ FIFO
┌──────────────────┴─────────────────────┐
│  Mid-Term Memory                       │
│  - Recent conversation summaries       │
│  - Buffer between active and permanent │
│  - Segmented page organization         │
└──────────────────┬─────────────────────┘
                   │ Consolidation
┌──────────────────┴─────────────────────┐
│  Long-Term Personal Memory             │
│  - Persistent user knowledge           │
│  - Consolidated from mid-term          │
│  - Segmented page organization         │
└────────────────────────────────────────┘
```

### Four Modules

1. **Memory Storage:** Manages the three-tier hierarchy
2. **Memory Updating:** Short-to-mid (FIFO), mid-to-long (segmented page consolidation)
3. **Memory Retrieval:** Cross-tier search and ranking
4. **Memory Generation:** Produces contextually relevant memory for injection into prompts

### Key Mechanisms

- **Dialogue-chain FIFO:** Messages flow through short-term in conversation order; when capacity is reached, oldest chains are evicted to mid-term
- **Segmented page organization:** Mid-term memories are organized into pages (thematic segments) before consolidation into long-term. This prevents information loss during compression

### Benchmark (LoCoMo)

- F1: 49.11% average improvement over baselines
- BLEU-1: 46.18% average improvement
- Tested on GPT-4o-mini

### What Works Well
- Explicit three-tier model with clear data flow
- Segmented page organization prevents information loss during consolidation
- Strong benchmark performance

### What Doesn't
- Relatively rigid architecture -- tiers are fixed, not adaptive
- No graph-based reasoning
- No temporal fact tracking
- Limited to personal memory (no shared/team memory)

---

## 7. Supermemory

**Origin:** Commercial memory infrastructure (2025). Claims state-of-the-art on LongMemEval and LoCoMo benchmarks.

### Key Technical Innovations

**Dual-Layer Timestamping:**
For every memory, the system extracts two temporal dimensions:
- `documentDate`: When the conversation took place
- `eventDate`: When the event described in the conversation actually occurred

This is conceptually similar to Zep's bi-temporal model but with a simpler implementation.

**Intelligent Decay:**
Less relevant information gradually fades while important, frequently-accessed content stays sharp. Decay is based on:
- Recency of access
- Frequency of access
- Relevance scores

**Hierarchical Caching:**
Uses Cloudflare's infrastructure for memory layers:
- Hot (KV): Recent, frequently accessed memories
- Warm: Moderate access patterns
- Cold: Deep memories retrieved on demand

**Context Rewriting:**
Continuously updates summaries and finds links between seemingly unrelated information. Unlike static storage, the representation evolves.

**Memory + RAG Integration:**
Runs both memory retrieval and RAG knowledge base retrieval together by default, combining personalized context with general knowledge.

### Scale
- Sub-400ms response times
- 50 million tokens per user
- 5 billion+ tokens daily across platform

### What Works Well
- Intelligent decay prevents unbounded growth
- Dual timestamps enable temporal reasoning
- Production scale proven
- Combined memory + RAG in single query

### What Doesn't
- Closed-source -- architecture details are limited
- No published paper with reproducible benchmarks
- Commercial dependency

---

## 8. Cross-System Analysis

### Memory Structure Comparison

| System | Storage Model | Temporal | Graph | Self-Managed | Consolidation |
|--------|--------------|----------|-------|--------------|---------------|
| Letta | 2-tier (core + archival) | No | No | Yes (tools) | Summarization only |
| Mem0 | Vector + Graph (parallel) | Partial | Yes | No (pipeline) | No |
| Zep | 3-tier subgraphs | Yes (bi-temporal) | Yes | No (pipeline) | Community summaries |
| A-MEM | Linked notes | No | Implicit (links) | Yes (agentic) | Yes (evolution) |
| LangMem | Namespace stores | No | No | Yes (tools) | Prompt optimization |
| MemoryOS | 3-tier hierarchy | No | No | No (system) | Yes (page segments) |
| Supermemory | Hierarchical cache | Yes (dual timestamp) | No | No (pipeline) | Yes (rewriting) |

### Memory Lifecycle Patterns

**Pattern A: Agent-Controlled (Letta, A-MEM, LangMem)**
- The LLM decides what to remember, when to retrieve, what to update
- Pro: Adaptive, context-sensitive decisions
- Con: Consumes function-call budget, quality depends on LLM

**Pattern B: Pipeline-Extracted (Mem0, Zep, Supermemory)**
- A separate extraction pipeline processes conversations and manages memory
- Pro: Consistent, doesn't consume agent's reasoning budget
- Con: Extraction quality is a bottleneck, less adaptive to context

**Pattern C: System-Managed (MemoryOS)**
- Fixed rules govern memory flow between tiers
- Pro: Predictable, no LLM overhead for memory management
- Con: Less adaptive, requires careful tuning

### The Consolidation Problem

The biggest unsolved challenge across all systems: **how to compress episodic experiences into durable semantic knowledge without losing critical nuance.**

- **Letta:** Recursive summarization (lossy, loses nuance)
- **Mem0:** No consolidation -- memories accumulate
- **Zep:** Community summaries (abstracts clusters, but doesn't consolidate individual facts)
- **A-MEM:** Memory evolution (refines notes, but doesn't abstract patterns)
- **MemoryOS:** Segmented page organization (structured compression)
- **Supermemory:** Context rewriting (continuous but opaque)
- **LangMem:** Procedural memory / prompt optimization (compresses behavioral patterns into instructions)

**LangMem's procedural memory is the most interesting approach here** -- it doesn't just store facts, it changes how the agent behaves by rewriting its own prompt based on accumulated experience. This is genuine learning, not just recall.

### The Temporal Problem

Most systems treat memory as timeless facts. Only Zep and Supermemory explicitly model when facts are valid:

- A user's job changes. Without temporal tracking, the system has two contradictory facts with no resolution mechanism.
- Zep solves this with bi-temporal edges (4 timestamps per fact).
- Supermemory solves it with dual-layer timestamps (2 timestamps per memory).
- Mem0 partially solves it by marking contradicted graph edges as invalid.
- Everyone else relies on the LLM to "figure it out" from context.

### Short-Term vs Long-Term Boundary

| System | Short-Term | Long-Term | Boundary Mechanism |
|--------|-----------|-----------|-------------------|
| Letta | Core memory + conversation buffer | Archival + recall memory | FIFO eviction + summarization |
| Mem0 | Session memory | User memory | Scope-based (explicit) |
| Zep | Episode subgraph | Entity + community subgraphs | Extraction pipeline |
| A-MEM | No explicit distinction | All notes are equal | N/A |
| LangMem | In-conversation tools | Namespace stores | Agent decision |
| MemoryOS | Short-term tier | Mid + long-term tiers | FIFO + page segmentation |
| Supermemory | Hot cache (KV) | Warm/cold storage | Access frequency + recency |

---

## 9. Memory Taxonomy (from Cognitive Science)

The field is converging on a taxonomy borrowed from cognitive psychology:

### Sensory / Working Memory
Raw input that hasn't been processed yet. In agents: the current context window contents, including the latest user message and recent tool outputs.

### Episodic Memory
Memories of specific events and interactions, with temporal and contextual grounding. "I had a conversation with the user on Tuesday where they mentioned moving to Berlin."

- **Best implementation:** Zep's episode subgraph (raw, timestamped, non-lossy)
- **Challenge:** Grows linearly with interactions, needs compression

### Semantic Memory
Generalized facts and knowledge extracted from experiences. "The user lives in Berlin. The user prefers dark mode."

- **Best implementation:** Mem0's extraction pipeline (clean, atomic facts)
- **Challenge:** Extraction quality, contradiction resolution

### Procedural Memory
Knowledge of how to perform tasks, often implicit. "When the user asks about code, provide examples before explanations."

- **Best implementation:** LangMem's prompt optimization (literally rewrites agent behavior)
- **Challenge:** Stability -- unconstrained self-modification can degrade performance

### Prospective Memory
Remembering to do something in the future. "Remind the user about their dentist appointment tomorrow."

- **No system implements this well.** Letta's heartbeat mechanism comes closest.

### The Consolidation Cycle

In neuroscience, memory consolidation happens during sleep:
1. **Encoding:** Experience enters working memory
2. **Replay:** During rest, the hippocampus replays experiences
3. **Consolidation:** Important patterns are strengthened, details fade
4. **Integration:** Consolidated knowledge merges with existing semantic memory

The AI analog:
1. **Encoding:** Conversation enters context window
2. **Extraction:** Pipeline identifies salient facts (Mem0, Zep) or agent decides (Letta)
3. **Consolidation:** Facts are compressed, linked, or abstracted (A-MEM evolution, MemoryOS page segments, Supermemory rewriting)
4. **Integration:** Consolidated knowledge influences future behavior (LangMem prompt optimization)

**No single system implements the full cycle.** The most complete combination would be Zep's extraction + A-MEM's evolution + LangMem's procedural memory.

---

## 10. Design Principles for Lucy

Based on this landscape analysis, key takeaways for Lucy's memory architecture:

### What the Field Has Settled On
1. **Extraction pipelines beat raw storage.** Storing atomic facts is more useful than storing raw conversations.
2. **Vector search is table stakes.** Every system uses embeddings for retrieval.
3. **The agent should have some control over its memory.** Pure pipeline approaches miss context-sensitive decisions.
4. **Temporal awareness matters.** Facts change; the memory system must handle contradictions.

### What Remains Unsolved
1. **Consolidation.** No system has a clean episodic-to-semantic compression cycle.
2. **Procedural memory.** Only LangMem attempts it, and it's fragile.
3. **Memory decay.** Only Supermemory implements intelligent forgetting. Most systems grow unboundedly.
4. **Prospective memory.** No system remembers to do things proactively.
5. **Multi-agent memory coordination.** Only Letta's shared blocks address this.

### Architecture Patterns Worth Stealing

| Pattern | From | Why |
|---------|------|-----|
| Core memory blocks (always-visible, agent-editable) | Letta | Ensures critical context is never lost |
| Extract-then-update pipeline | Mem0 | Clean, predictable memory formation |
| Bi-temporal fact tracking | Zep | Handles real-world fact changes correctly |
| Memory evolution (refining old memories) | A-MEM | Prevents staleness, enables consolidation |
| Procedural memory via prompt optimization | LangMem | Enables genuine behavioral learning |
| Intelligent decay | Supermemory | Prevents unbounded growth |
| Sleep-time compute for memory maintenance | Letta | Non-blocking background refinement |

### The Ideal Hybrid

A memory system that combines:
1. **Always-visible core blocks** (Letta) for identity and critical context
2. **Automatic extraction pipeline** (Mem0) for fact capture without consuming agent reasoning
3. **Temporal tracking** (Zep) for fact validity and contradiction resolution
4. **Periodic consolidation** (A-MEM evolution + MemoryOS page segments) for compression
5. **Procedural learning** (LangMem) for behavioral adaptation
6. **Intelligent decay** (Supermemory) for bounded growth
7. **Agent-controlled tools** for context-sensitive memory decisions during conversations

---

## Sources

### Papers
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)
- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413) (2025)
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956) (Rasmussen, 2025)
- [A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) (Xu, Liang et al., NeurIPS 2025)
- [Memory OS of AI Agent](https://arxiv.org/abs/2506.06326) (Kang et al., EMNLP 2025 Oral)
- [MemOS: A Memory OS for AI System](https://arxiv.org/abs/2507.03724) (2025)
- [Position: Episodic Memory is the Missing Piece for Long-Term LLM Agents](https://arxiv.org/pdf/2502.06975) (2025)
- [Memory in the Age of AI Agents: A Survey](https://arxiv.org/abs/2512.13564) (2025)

### Projects & Documentation
- [Letta (formerly MemGPT)](https://github.com/letta-ai/letta) -- 21.6k stars
- [Mem0](https://github.com/mem0ai/mem0) -- 50.1k stars
- [Zep / Graphiti](https://github.com/getzep/graphiti)
- [A-MEM](https://github.com/agiresearch/A-mem)
- [LangMem SDK](https://github.com/langchain-ai/langmem)
- [MemoryOS](https://github.com/BAI-LAB/MemoryOS)
- [Supermemory](https://supermemory.ai/)
- [Agent Memory Paper List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List) -- comprehensive survey index

### Analysis Articles
- [Letta blog: Agent Memory](https://www.letta.com/blog/agent-memory)
- [Leonie Monigatti: MemGPT paper breakdown](https://www.leoniemonigatti.com/papers/memgpt.html)
- [Letta docs: Understanding memory management](https://docs.letta.com/advanced/memory-management/)
- [Mem0 Graph Memory (DeepWiki)](https://deepwiki.com/mem0ai/mem0/4-graph-memory)
- [Terse Systems: Adding memory to LLMs with Letta](https://tersesystems.com/blog/2025/02/14/adding-memory-to-llms-with-letta/)
- [LangMem documentation](https://langchain-ai.github.io/langmem/)
