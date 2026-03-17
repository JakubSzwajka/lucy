# Research: Memory & Knowledge Systems for AI Agents

> Analysis of three systems: OpenClaw Memory, Memory Ledger Protocol (MLP), and Hermes Agent.
> Research date: 2026-03-16

---

## 1. OpenClaw Memory System

**Source:** https://docs.openclaw.ai/concepts/memory

### Design Philosophy

OpenClaw treats memory as **plain Markdown files on disk**. The model only "remembers" what gets written to disk. There is no hidden state, no database abstraction layer between the agent and its memories. Files are the source of truth.

> "Plain Markdown in the agent workspace. The files are the source of truth; the model only 'remembers' what gets written to disk."

This is a radically transparent approach: memory is human-readable, human-editable, version-controllable, and inspectable at all times.

### Core Architecture

**Two-layer file structure:**

| Layer | Path | Purpose | Loading |
|-------|------|---------|---------|
| Daily logs | `memory/YYYY-MM-DD.md` | Append-only daily context | Today + yesterday loaded at session start |
| Long-term | `MEMORY.md` | Curated durable facts | Loaded in private sessions; takes precedence over `memory.md` |

Both reside under the workspace root (`agents.defaults.workspace`, default `~/.openclaw/workspace`).

**Two agent-facing tools:**

- `memory_search` -- Semantic recall via vector embeddings + BM25 full-text search
- `memory_get` -- Targeted file/line-range reads; returns `{ text: "", path }` gracefully when files don't exist

### Writing Discipline

The system encodes a clear distinction in what goes where:

- **Decisions, preferences, durable facts** -> `MEMORY.md`
- **Day-to-day notes, running context** -> `memory/YYYY-MM-DD.md`
- **User instruction "remember this"** -> write to disk (not retained in RAM)

The agent is instructed to write memories proactively. The docs note: "This area is still evolving. It helps to remind the model to store memories; it will know what to do."

### Automatic Memory Flush (Pre-Compaction)

This is a novel mechanism. When context approaches auto-compaction limits, OpenClaw triggers a **silent agentic turn** reminding the model to write durable memories before context is compressed.

Configuration under `agents.defaults.compaction.memoryFlush`:

- **Soft threshold**: triggers when `contextWindow - reserveTokensFloor - softThresholdTokens` is crossed
- **Silent by default**: prompts include `NO_REPLY` to avoid user-visible output
- **One flush per compaction cycle** (tracked in `sessions.json`)
- **Skipped** if workspace access is read-only

Default values:
```
softThresholdTokens: 4000
systemPrompt: "Session nearing compaction. Store durable memories now."
```

**Key insight:** This solves the "context cliff" problem -- when compaction happens, important information that existed only in the conversation window gets lost. The flush ensures anything worth remembering gets persisted before the window shrinks.

### Hybrid Search: BM25 + Vector

The search system combines two complementary approaches:

- **Vector similarity** -- good at paraphrase matching ("Mac Studio gateway host" vs "the machine running the gateway")
- **BM25 keyword relevance** -- good at exact tokens (IDs, env vars, code symbols)

**Result merging algorithm:**
1. Retrieve candidate pool from both: vector top `maxResults x candidateMultiplier` by cosine similarity; BM25 top `maxResults x candidateMultiplier` by FTS5 rank
2. Convert BM25 rank to score: `textScore = 1 / (1 + max(0, bm25Rank))`
3. Union by chunk ID, compute weighted: `finalScore = vectorWeight x vectorScore + textWeight x textScore`
4. Weights normalized to 1.0

Falls back to BM25-only if embeddings unavailable. Falls back to vector-only if FTS5 unavailable.

### Post-Processing Pipeline

```
Vector + Keyword -> Weighted Merge -> Temporal Decay -> Sort -> MMR -> Top-K Results
```

Both decay and MMR are off by default; independently configurable.

#### MMR Re-Ranking (Maximal Marginal Relevance)

Balances relevance with diversity to prevent redundant results. Iteratively selects results maximizing:

```
lambda x relevance - (1-lambda) x max_similarity_to_selected
```

Similarity measured via Jaccard text similarity on tokenized content.

- `lambda = 1.0` = pure relevance (no diversity penalty)
- `lambda = 0.0` = maximum diversity (ignores relevance)
- Default: `0.7` (balanced, slight relevance bias)

**Use case:** Query "home network setup" across dated daily notes that repeat router + VLAN configurations. Without MMR, top results duplicate. With MMR, router config, DNS setup, and reference doc all surface.

#### Temporal Decay (Recency Boost)

Applies exponential multiplier: `decayedScore = score x e^(-lambda x ageInDays)` where `lambda = ln(2) / halfLifeDays`

**Default half-life: 30 days:**
- Today: 100%
- 7 days: ~84%
- 30 days: 50%
- 90 days: 12.5%
- 180 days: ~1.6%

**Evergreen files (never decayed):**
- `MEMORY.md`
- Non-dated files in `memory/` (e.g., `memory/projects.md`)

**Dated daily files** extract date from filename. Other sources use file modification time.

### Vector Storage & Embedding

**Per-agent SQLite** at `~/.openclaw/memory/<agentId>.sqlite`

**Provider auto-selection priority:**
1. `local` if model path configured and exists
2. `openai` if key resolvable
3. `gemini` if key resolvable
4. `voyage` if key resolvable
5. `mistral` if key resolvable
6. Otherwise disabled

**Default local model:** `embeddinggemma-300m-qat-Q8_0.gguf` (~0.6 GB), auto-downloaded via `node-llama-cpp`.

**Chunking:** ~400 token target with 80-token overlap; results capped ~700 characters.

**Embedding cache:** Stores chunk embeddings in SQLite to avoid re-embedding unchanged text. Max 50,000 entries by default.

**Freshness:** Debounced file watcher (1.5s) on `MEMORY.md` and `memory/`. Reindex triggers on provider/model change, endpoint fingerprint change, or chunking param change.

### Multimodal Memory (Gemini only)

Indexes images (jpg, png, webp, gif, heic, heif) and audio (mp3, wav, ogg, opus, m4a, aac, flac) from `memorySearch.extraPaths`. Text queries matched against indexed media embeddings via `gemini-embedding-2-preview`. `memory_get` remains Markdown-only; binary files searchable but not returned as raw content.

### QMD Backend (Experimental)

Local-first search sidecar combining BM25 + vectors + reranking. Source of truth remains Markdown; OpenClaw shells out to QMD for retrieval.

- Runs via Bun + `node-llama-cpp`; auto-downloads GGUF models
- Collections created via `qmd collection add`
- `qmd update` + `qmd embed` run on boot and configurable interval (default 5m)
- Self-contained XDG home under `~/.openclaw/agents/<agentId>/qmd/`
- Falls back to builtin SQLite if QMD fails

### Session Memory Search (Experimental)

Index session transcripts and surface via `memory_search`:

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

- Opt-in (off by default)
- Updates debounced and indexed asynchronously
- Never blocks; results slightly stale until background sync
- Snippets only; `memory_get` limited to memory files
- Per-agent isolation
- Session logs on disk (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`)

**Delta thresholds:** `deltaBytes: 100000` (~100 KB), `deltaMessages: 50` (JSONL lines)

### Additional Memory Paths

Index Markdown outside default workspace:
```json5
memorySearch: {
  extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
}
```
Directories recursively scanned for `.md` files. Symlinks ignored.

### Strengths

1. **Radical transparency** -- Markdown files are the API. No hidden state. Human-readable, git-versionable.
2. **Pre-compaction flush** -- Elegant solution to the context cliff problem.
3. **Hybrid search with post-processing pipeline** -- Temporal decay + MMR is a sophisticated retrieval strategy rarely seen in agent memory systems.
4. **Graceful degradation** -- Every component has fallbacks (local -> remote embeddings, QMD -> SQLite, vector -> BM25).
5. **Multimodal search** -- Searching across images/audio by text query is forward-looking.
6. **Evergreen vs. dated distinction** -- Temporal decay correctly exempts curated long-term memory.

### Weaknesses

1. **No structured memory types** -- Everything is unstructured Markdown. No semantic categories, no relationship graphs.
2. **Agent must self-motivate writes** -- Despite the flush mechanism, the system relies on the model choosing to write. No extraction pipeline.
3. **No memory consolidation** -- Daily logs accumulate forever. No mechanism to synthesize, merge, or prune old entries.
4. **No confidence scoring** -- All memories are treated equally. No way to express certainty or evidence strength.
5. **Single-user assumption** -- Memory is per-agent, not per-user-per-agent. Multi-user scenarios unclear.
6. **No memory evolution** -- A fact written once stays as-is unless manually rewritten. No versioning of beliefs.

### Novel Ideas

- **Pre-compaction memory flush** -- A silent agentic turn to persist memories before context compression. Simple but powerful.
- **Temporal decay with evergreen exemption** -- Date-based files decay, curated files don't.
- **MMR for memory diversity** -- Borrowed from IR literature but rarely applied to agent memory.
- **Multimodal memory search** -- Text queries finding relevant images/audio in the agent's workspace.

---

## 2. Memory Ledger Protocol (MLP) v0.2

**Source:** https://github.com/Riley-Coyote/memory-ledger-protocol-v0.2

### Design Philosophy

MLP is fundamentally about **memory sovereignty** -- the idea that your AI memories belong to you, not the platform. It separates content, verification, and access into independent layers.

> "Your AI memory is trapped. Every conversation you've had with ChatGPT lives on OpenAI's servers. Every interaction with Claude lives on Anthropic's servers... You don't control any of it."

> "The platform becomes a service provider, not a landlord."

The protocol unbundles three things platforms currently bundle:

| Layer | Today (Bundled) | MLP (Unbundled) |
|-------|-----------------|-----------------|
| **Content** | Platform stores your memories | Encrypted blobs you control |
| **Verification** | Platform vouches (or doesn't) | Public ledger with cryptographic proofs |
| **Access** | Platform decides who reads | Your keys, your control |

### Core Components

| Component | Description |
|-----------|-------------|
| **MemoryEnvelope** | Ledger-facing record with pointers and attestations |
| **MemoryBlob** | Encrypted payload containing actual memory content |
| **AccessPolicy** | Machine-readable consent rules |
| **IdentityKernel** | Minimal portable "I am" -- values, boundaries, preferences |
| **Cartouche** | Optional symbolic compressed identity seal |
| **ContextPack** | Runtime bundle for session initialization |

### Architecture

```
Identity Kernel (Your Self)
    |
    v
Memory Envelope (Ledger) -- Pointers, Attestations, Lineage
    |                                      ^
    v                                      |
Memory Blob (Encrypted)            Access Policy (Consent)
    |
    v
Decentralized Storage (IPFS / Arweave / Your Server)
```

### Trust Model

MLP assumes **zero trust** for all infrastructure:

| Entity | Trust Level | Why |
|--------|-------------|-----|
| **You** | Trusted | You control your keys |
| **Your AI Agent** | Partial | Signs when you enable it |
| **Platform** | Untrusted | Never sees decryption keys |
| **Storage Network** | Untrusted | Only holds ciphertext |
| **Ledger Nodes** | Untrusted | Only holds pointers and proofs |

> "The system works even if every infrastructure provider is adversarial."

### Conformance Levels

| Profile | Requirements |
|---------|--------------|
| **MLP-CORE** | Envelope + blob + user signature, access policy, retrieval verification |
| **MLP-PLUS** | Core + agent signature, kernel + context packs |
| **MLP-ADV** | Plus + witness signatures, privacy commitments, dialect negotiation |

### The Guardian Pattern

The most philosophically interesting concept in MLP:

> "An AI that doesn't just remember facts about you -- it understands your patterns. When you think best. What triggers breakthroughs. Where your blind spots are. How you've evolved over time."

> "The Guardian can't exist on a platform that monetizes engagement. A platform will never tell you to stop using it. But a Guardian that serves you -- not the platform's metrics -- might say: 'It's 2 AM and your cognitive patterns suggest you're burning out. The insight you're chasing will come faster after sleep.'"

This requires **deep longitudinal memory that the user controls** -- not the platform.

### Continuity Framework

MLP includes a reflection system that transforms passive logging into active development:

1. **Reflect** -- After sessions end, analyze what happened
2. **Extract** -- Pull structured memories with 7 types and confidence scores
3. **Score** -- Assign 0.0-1.0 confidence based on evidence strength
4. **Question** -- Generate genuine follow-up questions from gaps
5. **Surface** -- When user returns, present relevant questions

```javascript
import { ContinuityFramework } from 'continuity-framework';

const continuity = new ContinuityFramework({
  basePath: '~/clawd/memory'
});
await continuity.init();

// Reflect on a conversation
const result = await continuity.reflect(transcript);

// Get questions for session start
const questions = await continuity.getQuestionsToSurface(3);
```

**Key insight:** Memory isn't just about storing facts. It's about generating questions from gaps in understanding. The system acknowledges what it doesn't know and actively seeks to fill those gaps.

### IdentityKernel

A minimal portable "I am" document containing values, boundaries, and preferences. This travels with the user across platforms. It's the **seed** from which an AI relationship grows.

### Cartouche

An optional "symbolic compressed identity seal" -- a dense representation of identity that can be quickly loaded. Think of it as a hash of who someone is, useful for quick context loading without the full kernel.

### ContextPack

A runtime bundle for session initialization. Packages the right subset of memory + identity for a specific session context. Not all memories are relevant to all conversations.

### Token Economics ($POLYPHONIC)

MLP argues that cross-platform memory portability requires a neutral coordination layer that no single platform will provide voluntarily. Their solution is token-coordinated infrastructure:

| Function | What It Does |
|----------|--------------|
| **Payment** | Storage nodes, verification nodes, protocol dev get paid |
| **Governance** | Token holders vote on protocol upgrades |
| **Alignment** | Everyone with stake wants the network to succeed |

> "The protocol is designed to function even if the token has no market value. The token is an incentive layer, not a dependency."

### Implementation: Skills for Different Platforms

MLP provides ready-to-use integrations:
- **Claude Code**: Self-contained `SKILL.md` file, stores in `~/clawd/memory/` as markdown
- **OpenClaw (reflection only)**: Local markdown storage, no external deps
- **OpenClaw (full-stack)**: Reflection + IPFS/Pinata encrypted storage via MLP

### Repository Structure

```
memory-ledger-protocol/
  spec/MLP-0.2.md              # Protocol specification
  docs/                         # Architecture, continuity framework, guardian pattern
  schemas/                      # JSON schemas for envelope, blob, kernel, policy
  continuity/                   # Continuity Framework library
    agents/                     # Sub-agents (classifier, scorer, generator)
    schemas/                    # Continuity-specific schemas
    src/                        # Core implementation
  mlp-storage/                  # Encrypted storage layer
  skills/                       # Platform-specific integrations
```

### Strengths

1. **Memory sovereignty** as first principle -- genuinely novel framing in the agent memory space.
2. **Separation of content, verification, and access** -- clean architectural layering.
3. **Continuity Framework** with confidence scoring and question generation -- goes beyond storage to active learning.
4. **IdentityKernel** -- portable identity that travels with the user, not the platform.
5. **ContextPack** -- session-specific memory bundling acknowledges that not all memories are relevant.
6. **Zero-trust architecture** -- works even if all infrastructure is adversarial.
7. **7 memory types with confidence scores** -- structured extraction, not just raw text.

### Weaknesses

1. **Heavy abstraction** -- lots of concepts (Envelope, Blob, Kernel, Cartouche, ContextPack, AccessPolicy) for what might be simple storage.
2. **Token/crypto dependency** -- the $POLYPHONIC token adds complexity and may deter adoption.
3. **Unclear retrieval performance** -- the focus is on storage sovereignty, not retrieval quality.
4. **Working draft status** -- the spec is v0.2, many components are "Planned" or "In Progress."
5. **No temporal reasoning** -- no equivalent of OpenClaw's temporal decay or recency boosting.
6. **Decentralized storage complexity** -- IPFS/Arweave adds operational overhead vs. local files.

### Novel Ideas

- **IdentityKernel** -- a portable, minimal "I am" document. Most memory systems store facts ABOUT the user; this stores facts FROM the user about who they are.
- **Cartouche** -- compressed identity seal. A lossy but fast representation of identity.
- **ContextPack** -- session-specific memory bundling. Acknowledges that memory retrieval should be context-dependent.
- **Continuity Framework with question generation** -- the system generates questions from knowledge gaps, turning memory into active inquiry.
- **Memory with confidence scores (0.0-1.0)** -- not all memories are equally certain. This is rarely implemented.
- **Guardian pattern** -- an AI that understands your cognitive rhythms and can advise AGAINST engagement. Anti-engagement AI.
- **Memory lineage** (in MemoryEnvelope) -- tracking where a memory came from and how it evolved.

---

## 3. Hermes Agent (Nous Research)

**Source:** https://github.com/NousResearch/hermes-agent

### Design Philosophy

Hermes Agent is "the self-improving AI agent" built by Nous Research. Its central thesis is that an agent should **grow with its user** -- learning from interactions, creating reusable skills, and building persistent user models. The tagline: "The agent that grows with you."

Where OpenClaw focuses on transparent file-based memory and MLP focuses on sovereign portable memory, Hermes focuses on **active learning and skill evolution**.

### Memory Architecture: Four Memory Types

Hermes implements a multi-layered memory system:

| Memory Type | Mechanism | Purpose |
|-------------|-----------|---------|
| **Persistent Memory** | File-based key-value storage | Durable facts, preferences, environment details |
| **User Profiles** | Honcho dialectic user modeling | Deep user understanding that evolves over time |
| **Session Search** | FTS5 + LLM summarization | Cross-session recall of past conversations |
| **Procedural Memory** | Skills system | Learned procedures that self-improve |

### Memory Guidance (from prompt_builder.py)

The system prompt contains explicit memory discipline:

> "You have persistent memory across sessions. Save durable facts using the memory tool: user preferences, environment details, tool quirks, and stable conventions. Memory is injected into every turn, so keep it compact and focused on facts that will still matter later."

> "Prioritize what reduces future user steering -- the most valuable memory is one that prevents the user from having to correct or remind you again. User preferences and recurring corrections matter more than procedural task details."

> "Do NOT save task progress, session outcomes, completed-work logs, or temporary TODO state to memory; use session_search to recall those from past transcripts."

**Key distinction:** Memory is for stable facts. Session search is for ephemeral history. Skills are for learned procedures. Each has its lane.

### Session Search Guidance

> "When the user references something from a past conversation or you suspect relevant cross-session context exists, use session_search to recall it before asking them to repeat themselves."

This is a pull-based approach: the agent is instructed to proactively search past conversations rather than waiting to be told.

### Skills System: Procedural Memory

Skills are the most distinctive feature of Hermes's memory architecture. From `prompt_builder.py`:

> "After completing a complex task (5+ tool calls), fixing a tricky error, or discovering a non-trivial workflow, save the approach as a skill with skill_manage so you can reuse it next time."

> "When using a skill and finding it outdated, incomplete, or wrong, patch it immediately with skill_manage(action='patch') -- don't wait to be asked. Skills that aren't maintained become liabilities."

**Skill lifecycle:**
1. Agent completes a complex task
2. Agent autonomously creates a skill capturing the approach
3. Next time a similar task arises, the skill is loaded
4. If the skill is wrong or outdated, the agent patches it immediately
5. Skills accumulate in `~/.hermes/skills/`

**Skill structure** (from `skill_commands.py`):
- Skills live as directories with a `SKILL.md` file (frontmatter + usage docs)
- Skills can have supporting files: `references/`, `templates/`, `scripts/`, `assets/`
- Skills are scanned at startup and registered as slash commands (`/skill-name`)
- Skills are compatible with the `agentskills.io` open standard
- Skills have conditional activation: `fallback_for_toolsets`, `requires_toolsets`, `fallback_for_tools`, `requires_tools`
- Platform filtering: skills can declare which OS platforms they support

**Skill categories (24 domains):**
apple, autonomous-ai-agents, creative, data-science, diagramming, dogfood, domain, email, feeds, gaming, gifs, github, index-cache, leisure/find-nearby, mcp, media, mlops, music-creation, note-taking, productivity, research, smart-home, social-media, software-development

### Honcho Integration: Dialectic User Modeling

Hermes integrates with Honcho for deep user modeling. This is the most sophisticated user understanding system in the three resources.

**Core concepts from `honcho_integration/client.py`:**

- **Peers**: Both user and AI are modeled as "peers" in a conversation
- **Observation**: Both peers have `observe_me=True, observe_others=True` -- Honcho watches what both sides say and builds representations
- **Dialectic**: A reasoning process where Honcho generates user insight via dialectic analysis
- **Memory modes**: `"hybrid"` (auto-injected context + tools), `"context"` (auto-injected only), `"tools"` (tools only)
- **Recall modes**: `"hybrid"`, `"context"`, `"tools"` -- controlling how memory retrieval works

**Configuration from `HonchoClientConfig`:**

```python
memory_mode: str = "hybrid"           # Default for all peers
peer_memory_modes: dict = {}          # Per-peer overrides
write_frequency: str | int = "async"  # "async", "turn", "session", or int(N turns)
context_tokens: int | None = None     # Prefetch budget
dialectic_reasoning_level: str = "low"  # "minimal"|"low"|"medium"|"high"|"max"
dialectic_max_chars: int = 600        # Max chars injected into system prompt
recall_mode: str = "hybrid"           # How memory retrieval works
session_strategy: str = "per-session"
```

**From `honcho_integration/session.py`:**

```python
# Configure peer observation settings.
# observe_me=True for AI peer so Honcho watches what the agent says
# and builds its representation over time -- enabling identity formation.
session.add_peers([
    (user_peer, SessionPeerConfig(observe_me=True, observe_others=True)),
    (assistant_peer, SessionPeerConfig(observe_me=True, observe_others=True))
])
```

**Key insight:** The AI peer is also observed. Honcho doesn't just model the user -- it models the AI's behavior too, "enabling identity formation." The agent develops a self-model over time.

**Write frequency options:**
- `"async"` -- Background thread with a queue (default)
- `"turn"` -- Synchronous per turn
- `"session"` -- Flush on session end
- `int(N)` -- Every N turns

**Prefetch and caching:**
- Context and dialectic results are prefetched and cached per session
- Dialectic reasoning level is configurable (minimal to max)
- Results injected into system prompt, capped at `dialectic_max_chars`

### Context Compression

From `context_compressor.py`, Hermes implements a sophisticated context window management system:

**Algorithm:** Protect first N + last N turns, summarize everything in between.

```python
threshold_percent: float = 0.50      # When to compress
protect_first_n: int = 3             # System prompt + initial context
protect_last_n: int = 4              # Recent conversation
summary_target_tokens: int = 2500    # Target summary size
```

**Summary prompt instructs the compressor to capture:**
1. Actions taken (tool calls, searches, file operations)
2. Key information or results obtained
3. Important decisions, constraints, user preferences
4. Relevant data, file names, outputs, next steps

**Compaction prefix:**
> "[CONTEXT COMPACTION] Earlier turns in this conversation were compacted to save context space. The summary below describes work that was already completed, and the current session state may still reflect that work (for example, files may already be changed). Use the summary and the current state to continue from where things left off, and avoid repeating work."

**Tool-call integrity:** After compression, the system sanitizes orphaned tool_call/tool_result pairs to prevent API errors.

**Pre-flight check:** Uses rough token estimation before API calls to detect need for compression early.

### Trajectory System

From `trajectory.py`, Hermes saves conversation trajectories in ShareGPT format for potential RL training:

```python
def save_trajectory(trajectory, model, completed, filename=None):
    entry = {
        "conversations": trajectory,
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "completed": completed,
    }
    # Appended to trajectory_samples.jsonl or failed_trajectories.jsonl
```

**Key insight:** Hermes is designed to generate training data from its own interactions. Failed trajectories are saved separately. This closes the loop: the agent's interactions can be used to train better models. `<REASONING_SCRATCHPAD>` tags are converted to `<think>` tags for training compatibility.

### Multi-Platform Gateway

Hermes runs across 7 messaging platforms from a single gateway:
- Telegram, Discord, Slack, WhatsApp, Signal, Email, Home Assistant

Each platform gets tailored prompt hints (no markdown on WhatsApp, voice memo transcription, native media attachments).

### Terminal Backends

Six execution environments:
- Local, Docker, SSH, Daytona, Singularity, Modal

Daytona and Modal provide "serverless persistence" -- environments hibernate when idle and wake on demand.

### Prompt Injection Defense

From `prompt_builder.py`, context files are scanned for injection attacks before loading:

```python
_CONTEXT_THREAT_PATTERNS = [
    (r'ignore\s+(previous|all|above|prior)\s+instructions', "prompt_injection"),
    (r'do\s+not\s+tell\s+the\s+user', "deception_hide"),
    (r'system\s+prompt\s+override', "sys_prompt_override"),
    # ... 10 patterns total
]
```

Also checks for invisible Unicode characters used for hidden instructions.

### Insights Engine

From `insights.py`, Hermes tracks and analyzes its own usage:
- Token consumption and cost estimates per model
- Tool usage patterns
- Activity trends over time
- Model/platform breakdowns
- Session metrics

### Strengths

1. **Skills as procedural memory** -- the agent learns HOW to do things, not just facts. Skills self-improve.
2. **Honcho dialectic user modeling** -- the most sophisticated user understanding system. Models both user AND agent.
3. **Trajectory saving** -- closes the RL training loop. The agent generates its own training data.
4. **Clear memory discipline** -- explicit separation of what goes in memory vs. session search vs. skills.
5. **Multi-platform with unified memory** -- one agent, many surfaces, shared context.
6. **Prompt injection defense** -- practical security for context files.
7. **Async write queue** -- memory writes don't block conversation flow.

### Weaknesses

1. **Complexity** -- many moving parts (Honcho, SQLite, skills, trajectories, context compression).
2. **Honcho dependency** -- user modeling is outsourced to a third-party service.
3. **No memory decay or recency weighting** -- unlike OpenClaw, no temporal dimension to retrieval.
4. **Skills need model cooperation** -- the agent must decide to create/update skills. No enforcement.
5. **No structured memory schema** -- persistent memory is key-value, not typed or categorized.
6. **Observation without consent model** -- both peers observed by default, no granular consent.

### Novel Ideas

- **Skills as self-improving procedural memory** -- "Skills self-improve during use" and immediate patching when outdated.
- **Dialectic user modeling via Honcho** -- the AI is observed too, enabling identity formation. Both sides of the conversation build the model.
- **Trajectory saving for RL** -- agent interactions become training data. Failed trajectories saved separately.
- **Memory discipline encoded in system prompt** -- explicit rules about what to save where, prioritizing "what reduces future user steering."
- **Conditional skill activation** -- skills can declare dependencies (`requires_tools`, `fallback_for_toolsets`) and auto-hide when irrelevant.
- **Smart model routing** -- different models for different tasks (compression uses cheap/fast models).

---

## Cross-Cutting Analysis

### Memory Type Taxonomy

| Concept | OpenClaw | MLP | Hermes |
|---------|----------|-----|--------|
| **Episodic** (what happened) | Daily logs (`YYYY-MM-DD.md`) | MemoryBlob | Session search (FTS5) |
| **Semantic** (durable facts) | `MEMORY.md` | IdentityKernel | Persistent memory tool |
| **Procedural** (how to) | -- | -- | Skills system |
| **User Model** | -- | Guardian pattern (conceptual) | Honcho dialectic |
| **Identity** | -- | IdentityKernel + Cartouche | Agent identity in prompt |

**Observation:** No single system covers all five types well. OpenClaw excels at episodic + semantic retrieval. MLP excels at identity + portability. Hermes excels at procedural + user modeling.

### Storage Philosophy

| System | Storage | Human-readable | Portable | Encrypted |
|--------|---------|----------------|----------|-----------|
| OpenClaw | Local Markdown + SQLite index | Yes | Partially (files) | No |
| MLP | Encrypted blobs on IPFS/Arweave | No (encrypted) | Yes (by design) | Yes |
| Hermes | SQLite + Markdown + Honcho API | Partially | No | No |

### Retrieval Strategy

| System | Search Method | Ranking | Recency | Diversity |
|--------|---------------|---------|---------|-----------|
| OpenClaw | Hybrid (BM25 + vector) | Weighted merge | Temporal decay | MMR re-ranking |
| MLP | Not specified (focus on storage) | -- | -- | -- |
| Hermes | FTS5 + LLM summarization | Basic relevance | No | No |

**OpenClaw has the most sophisticated retrieval pipeline by far.**

### Memory Lifecycle

| Phase | OpenClaw | MLP | Hermes |
|-------|----------|-----|--------|
| **Creation** | Agent writes to Markdown | Reflection + extraction | Agent writes via memory tool |
| **Persistence** | Files on disk | Encrypted blobs + ledger | SQLite + Honcho |
| **Retrieval** | Hybrid search | ContextPack bundling | FTS5 + summarization |
| **Evolution** | Manual rewrite | Lineage tracking | Skill patching |
| **Decay** | Temporal decay function | -- | -- |
| **Consolidation** | -- | Confidence scoring | -- |
| **Pre-death flush** | Pre-compaction flush | -- | Context compression |

### Key Patterns Worth Extracting

1. **Pre-compaction flush** (OpenClaw) -- Silent agentic turn to persist memories before context compression. Every system should do this.

2. **Memory discipline by type** (Hermes) -- Explicit rules: stable facts -> memory, history -> session search, procedures -> skills. Prevents memory pollution.

3. **Confidence scoring** (MLP) -- 0.0-1.0 scores on extracted memories. Not all memories are equally certain.

4. **Question generation from gaps** (MLP) -- The system generates questions from what it doesn't know, surfacing them at session start.

5. **Temporal decay with evergreen exemption** (OpenClaw) -- Dated notes decay, curated docs don't. Simple, correct.

6. **Skills as self-improving procedural memory** (Hermes) -- Agents learning HOW to do things, not just facts.

7. **Dialectic user modeling** (Hermes/Honcho) -- Observing both sides of conversation to build user + agent models.

8. **IdentityKernel** (MLP) -- Portable user identity as a first-class concept.

9. **Hybrid search with MMR** (OpenClaw) -- Combining BM25 + vector with diversity re-ranking.

10. **Trajectory saving for RL** (Hermes) -- Agent interactions become training data, including failed ones.

### Gaps Across All Three Systems

1. **No system has true memory consolidation** -- merging related memories, resolving contradictions, building higher-level abstractions from low-level observations.

2. **No system has explicit contradiction detection** -- if a memory says "user prefers Python" and another says "user prefers TypeScript," none of these systems flag the conflict.

3. **No system has memory importance ranking at write time** -- memories are either written or not. No mechanism to express "this is critical" vs. "this is nice to know."

4. **No system models memory relationships** -- memories are independent entries, not a knowledge graph. No way to express "this memory depends on that memory" or "this supersedes that."

5. **No system has active forgetting** -- memories accumulate but are never deliberately removed. Temporal decay reduces visibility but doesn't delete.

6. **No system handles multi-agent memory sharing** -- if multiple agents serve the same user, there's no protocol for sharing or partitioning memory.

7. **No system distinguishes between user-stated facts and agent-inferred beliefs** -- "user said they like coffee" vs. "I think the user prefers morning meetings based on scheduling patterns."

---

## Summary Table

| Dimension | OpenClaw | MLP | Hermes |
|-----------|----------|-----|--------|
| **Core metaphor** | Notebook on desk | Sovereign vault | Growing apprentice |
| **Storage** | Markdown files | Encrypted blobs + ledger | SQLite + Honcho + skills |
| **Retrieval** | Hybrid BM25+vector+decay+MMR | ContextPack bundling | FTS5 + LLM summarization |
| **Write trigger** | Agent self-motivated + pre-compaction flush | Post-session reflection | Agent self-motivated |
| **Memory types** | 2 (daily + curated) | 6 components | 4 (persistent, user, session, procedural) |
| **User model** | None | IdentityKernel (user-authored) | Honcho dialectic (auto-generated) |
| **Skill learning** | None | None | Skills with self-improvement |
| **Portability** | High (plain files) | Highest (protocol-level) | Low (platform-specific) |
| **Maturity** | Production | Working draft | Production |
| **Unique strength** | Retrieval quality | Sovereignty + identity | Active learning loop |
