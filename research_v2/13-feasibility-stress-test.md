# INNERLIFE Feasibility Stress Test

_Date: 2026-03-17_
_Method: Adversarial analysis — proposal claims vs. actual codebase state_

---

## 1. Pi SDK Constraints — The Walls Are Real

### What the proposal assumes

INNERLIFE assumes it can hook `before_agent_start` for context injection, `session_before_compact` for reflection, and run background processes (dream cycle) alongside active sessions.

### What the code actually shows

The Pi SDK exposes exactly **two events** that Lucy uses:
- `before_agent_start` — modify system prompt before each agent turn
- `session_before_compact` — intercept compaction

That's it. There is no `on_idle`, `on_timer`, `on_session_end`, or `on_background_tick` event. The proposal's dream cycle requires infrastructure that the Pi SDK does not provide.

The `AgentRuntime` (`src/runtime/core/src/runtime/agent-runtime.ts`) holds a single `AgentSession` instance. There is no mechanism to run a second session concurrently. The `sendMessageStreaming()` method subscribes to session events, calls `session.prompt()`, and waits. There is no queue, no mutex, no concurrency control. If you call `prompt()` while another prompt is running, behavior is undefined.

**Custom events**: The `ExtensionAPI` interface accepts event name strings in `pi.on()`. Whether you can define arbitrary custom events or only listen to SDK-defined ones depends on Pi SDK internals. The codebase shows no evidence of custom event registration or dispatch. The heartbeat PRD explicitly calls this out as an open question.

**Verdict**: The dream cycle, heartbeat timer, and any autonomous background processing require building infrastructure that does not exist and may conflict with Pi SDK's single-session model. The proposal labels Phase 3 (Dream Cycle) as "requires heartbeat infrastructure" but underestimates that this infrastructure is not just unbuilt — its feasibility is unproven.

---

## 2. The Broken Memory Loop — Building on Sand

### The init() bug is confirmed

In `.pi/extensions/continuity/index.ts`, line 16:
```js
const skill = new ContinuitySkill();
```

Then on line 68 (inside `session_before_compact`):
```js
await skill.reflect({ session: "custom", summary: conversationText });
```

But `skill.init()` is **never called**. The `reflect()` method (line 72-73 of `src/index.js`) calls `this._ensureInit()` which throws:
```
Error: ContinuitySkill not initialized. Call init() first.
```

This means: **the entire memory system has never successfully executed**. The reflection pipeline, the 3-phase orchestrator, the memory store writes — none of it has ever run in production.

### .agents/memory/ does not exist

Confirmed: `ls .agents/memory/` returns "No such file or directory." No MEMORY.md, no questions.md, no reflections, no identity.md. The `before_agent_start` hook in the continuity extension checks `existsSync()` and gracefully returns empty — so the agent starts with zero memory context every time.

### What this means for INNERLIFE

The proposal says "INNERLIFE doesn't replace Lucy's existing system — it grows from it." But there is no existing system to grow from. The Continuity Framework is wired but broken. The entire memory pipeline is dead code.

Building INNERLIFE on top of this means:
1. First fix the init() bug
2. Verify the 3-phase pipeline actually works end-to-end
3. Verify the MemoryStore markdown I/O round-trips correctly
4. Then begin extending

The proposal estimates Phase 1 (The Stream) as "Small — mostly a format change." That's only true if the existing pipeline works. If you have to debug and stabilize the entire Continuity Framework first, Phase 1 is Medium at minimum.

---

## 3. LLM Call Costs — The Math Doesn't Lie

### Current system: 3 LLM calls per reflection

Each compaction-triggered reflection runs:
1. **Classifier** — extract and classify memories (1 LLM call via OpenRouter)
2. **Scorer** — assign confidence scores (1 LLM call)
3. **Generator** — produce curiosity questions (1 LLM call)

Each call uses `anthropic/claude-sonnet-4` with `max_tokens: 4096`, `temperature: 0.3`. The system prompt includes the sub-agent's SOUL.md plus the task prompt with templated conversation data.

Rough estimate per reflection:
- Input: ~2-4K tokens (system prompt + conversation excerpt + existing memories)
- Output: ~1-2K tokens (structured JSON)
- Cost at Sonnet 4 rates (~$3/M input, ~$15/M output): **~$0.02-0.04 per reflection**
- 3 calls total: **~$0.06-0.12 per compaction cycle**

### Proposed dream cycle: 6+ phases

The dream cycle proposes:
1. **Consolidate** — read recent stream, find patterns (1 LLM call)
2. **Connect** — link entries, track relationships (1 LLM call)
3. **Synthesize** — juxtapose, generate insights (1 LLM call)
4. **Prune** — decay scoring, move to background (1 LLM call)
5. **Update Self** — revise self-narrative, relational model (1 LLM call)
6. **Generate Wonder** — produce questions (1 LLM call)

That's **6 LLM calls per dream cycle**, each potentially more complex than the current reflection calls because they need to read and cross-reference multiple files (stream entries, tensions, relations, self-narrative, wonder).

Input size per dream call estimate: 3-8K tokens (multiple files read + instructions).
Output per call: 1-3K tokens.

**Cost per dream cycle: ~$0.15-0.40**

### Frequency matters

If the dream cycle runs:
- Every 30 min idle: ~16 cycles/day (8 active hours) = **$2.40-6.40/day**
- End of day only: 1 cycle/day = **$0.15-0.40/day**
- On manual trigger: negligible

Plus the ongoing reflection costs (3 calls per compaction), which still run.

Plus any inline stream writes during conversation (if those involve LLM calls to generate first-person entries — unclear from the proposal).

**At aggressive intervals (30 min), this is $70-190/month just for dream cycles.** That's nontrivial for a personal project.

The proposal does not discuss cost. At all. Not once.

---

## 4. Context Window Budget — The Math Is Tight

### Current system prompt assembly

The system prompt is assembled in layers:
1. **Pi SDK built-in prompt** — unknown size (loaded by `DefaultResourceLoader`)
2. **PROMPT.md** — 124 lines, ~6.9KB (~1,700 tokens)
3. **Time context** — ~30 tokens ("## Context\n\n- Time: Monday, March 16, 2026, 21:30 (Europe/Warsaw)")
4. **MEMORY.md** — currently 0 (file doesn't exist)
5. **questions.md** — currently 0 (file doesn't exist)

The Pi SDK's own system prompt likely adds another 2-5K tokens (coding agent instructions, tool descriptions, etc.).

**Current total system prompt: ~2,000-7,000 tokens** (mostly Pi defaults + PROMPT.md)

### What INNERLIFE wants to inject

The attention system's `before_agent_start` hook would assemble:
- Top-K stream entries (default 10) — each entry is ~100-200 tokens with frontmatter = **1,000-2,000 tokens**
- Active tensions — maybe 3-5 items at ~100 tokens each = **300-500 tokens**
- Active wonders — maybe 5-10 items at ~30 tokens each = **150-300 tokens**
- Relational context (kuba.md summary) — **200-400 tokens**
- foreground.md — **200-400 tokens**
- Pending commitments — **100-200 tokens**

**Total injected context: ~2,000-4,000 tokens**

### Available budget

Context window for Sonnet 4: 200K tokens. Context window for most models: 100-200K.

The system prompt competes with conversation history. If compaction threshold is `contextWindow - 16,384` (from `agent-runtime.ts` line 429), then at 200K context that's 183K for conversation + system prompt.

**2-4K additional tokens is affordable.** This is one area where the proposal is actually feasible. The budget exists.

But there's a latency concern: the `before_agent_start` hook runs **synchronously before every agent turn**. If the salience scorer reads 30 days of stream files, parses frontmatter, computes scores, sorts, and assembles — that's file I/O that adds latency to every single message. More on this in section 7.

---

## 5. Heartbeat Feasibility — Still Blocked

### Heartbeat PRD open questions (unchanged)

The heartbeat PRD (`docs/prds/heartbeat-events/README.md`) lists these open questions:
- **Pi SDK contention**: "Pi-bridge handles one request at a time. How do we queue a heartbeat behind an active conversation?"
- **Heartbeat prompt format**: "Should heartbeat messages arrive as a special 'system' message, or as a synthetic 'user' message?"
- **Output disposition**: "How does the agent signal 'this is internal reflection, don't show the user'?"

None of these have been answered since the PRD was written. The reference to "pi-bridge" is stale — the architecture now uses direct Pi SDK embedding, not a subprocess bridge (commit `9e1dffc9`). But the contention problem is identical: `AgentRuntime` holds one `AgentSession`, and `session.prompt()` is the only way to drive the agent.

### What has to be built

1. A **timer/scheduler** in the gateway that fires tick events
2. A **mutex or queue** on AgentRuntime to prevent concurrent `prompt()` calls
3. A **routing mechanism** to distinguish heartbeat output (internal) from conversation output (shown to user)
4. A way to inject **different system prompt sections** per event type
5. **Suppression logic** to skip heartbeats during active conversation

The heartbeat PRD explicitly says "Out of Scope: Multi-session support." The dream cycle needs to run without blocking conversation. These are contradictory requirements unless you accept that the dream cycle can only run when the user isn't talking — which means it's not "autonomous cognition" but "idle-time batch processing."

**Verdict**: The heartbeat is prerequisite infrastructure for the dream cycle, and it's still in draft PRD stage with fundamental design questions unanswered. This alone makes Phase 3 a Large-to-Very-Large effort, not the "Large" the proposal claims.

---

## 6. File I/O at Scale — Death by a Thousand Files

### File accumulation math

**Stream files**: 1 per day = 365 files/year
**Dream files**: 1 per dream cycle. At 1/day = 365/year. At aggressive intervals = thousands.
**Reflection logs**: 1 JSON file per compaction. Variable but say 2-5/day = 730-1825/year.

After 1 year:
- ~365 stream files
- ~365 dream files
- ~1000 reflection logs
- ~10 static files (self, relations, tensions, wonder, attention)

After 3 years: ~2,000+ files in `.agents/innerlife/`

### Performance concerns

The salience scorer on `before_agent_start` needs to read "recent stream entries (last 24-48 hours)." That's 1-2 files — fast.

But the dream cycle's CONNECT phase needs to "link new entries to older ones" and "notice cross-session patterns." That potentially requires reading many older stream files. The PRUNE phase needs to scan for low-salience entries across the archive.

The current `MemoryStore` reads entire files into memory (`readFile` + string split + regex parse). There's no index, no database, no caching layer. For 365 files of ~5-10KB each, that's 2-4MB of file reads + markdown parsing per dream cycle.

**This is probably fine for 1-2 years.** Node.js can handle thousands of small file reads. The bigger concern is the LLM calls that process this data, not the I/O itself.

**But**: there's no archival or rotation strategy. After 3 years, scanning old stream files for the CONNECT phase becomes wasteful — most entries are irrelevant. The proposal mentions PRUNE but not actual file archival or compaction of old stream files into summaries.

**Verdict**: Not a showstopper, but the proposal lacks a long-term data lifecycle strategy. "Move low-salience entries to background" is hand-waved — where is "background"? A separate file? A subfolder? What gets deleted?

---

## 7. Salience Scorer Complexity — Latency on the Critical Path

### The problem

The attention system runs on `before_agent_start`, which fires **before every agent response**. Every user message waits for:
1. Read recent stream files (1-2 files, ~10ms)
2. Parse frontmatter for all entries (~5ms)
3. Compute salience scores (~1ms math, but relevance scoring needs the first user message)
4. Read foreground.md, tensions, wonders (~10ms)
5. Assemble "What's on my mind" section (~1ms)

**Wait — relevance scoring is the problem.**

The salience formula includes:
```
w₃ × relevance(entry, context)
```

Where `context` is "first user message or session topic." But on `before_agent_start`, the user hasn't sent a message yet in a new session. And for subsequent messages within a session, the event likely doesn't include the new user message — it provides the system prompt to modify.

Two options:
1. **Skip relevance scoring**: Use only recency + emotional_weight + tension_weight. Feasible but degrades quality.
2. **Use embedding similarity**: Requires an embedding API call on every `before_agent_start`. Adds 200-500ms latency + cost.

If using pure file I/O + local computation (no LLM/embedding calls): **~30-50ms total**. Acceptable.

If using embedding-based relevance: **300-600ms added to every message**. Noticeable but possibly tolerable.

If the scorer itself is an LLM call (the proposal doesn't specify but the phrasing is ambiguous): **2-5 seconds per message**. Unacceptable.

**Verdict**: Feasible if implemented as local computation only. The proposal doesn't specify the implementation clearly enough. "Simple keyword/embedding similarity" is mentioned — keyword is cheap, embedding is expensive. This needs a decision before building.

---

## 8. Backward Compatibility — The MEMORY.md Migration Trap

### Current state

The `before_agent_start` hook reads MEMORY.md and injects it into the system prompt. But MEMORY.md doesn't exist, so nothing is injected.

### What the proposal says

"MEMORY.md becomes derived artifact — Generated from stream for backward compatibility"

### The problem

There's no migration to do because MEMORY.md never existed. This is actually easier than the proposal implies — you're not migrating from a working system, you're building from scratch.

But the proposal's "Phase 1 is mostly a format change" framing implies there's an existing format to change from. There isn't. The existing pipeline is dead code. Phase 1 is "build a working memory system for the first time," not "change the format."

The real backward compatibility concern is different: the continuity extension's `before_agent_start` hook currently reads MEMORY.md. If INNERLIFE replaces this with stream-based injection, you need to either:
1. Replace the hook entirely (clean but nothing to fall back to)
2. Keep both MEMORY.md injection and stream injection (redundant)

Since MEMORY.md doesn't exist, option 1 is fine. But this means you're committing fully — no gradual rollout, no A/B comparison.

**Verdict**: Migration is a non-issue because there's nothing to migrate from. But this also means there's no working baseline to compare against, which makes evaluating INNERLIFE's quality harder.

---

## 9. The "Written by Me" Problem — Who Holds the Pen?

### The proposal says

"Stream entries are written in first person, carrying my perspective" and "Written by me" (in the comparison table vs. "Written by sub-agent" for the current system).

### Who actually writes them?

The proposal describes two writing contexts:

**During conversation (inline reflection)**: The main agent writes stream entries while chatting. This means the agent needs a tool to append to the stream file. This tool doesn't exist. The agent would need to use general file write tools (`bash` or `file_write`), which works but is fragile — the agent might format entries inconsistently, forget frontmatter fields, or write to the wrong file.

**During compaction (reflection)**: The continuity extension runs the reflection pipeline. Currently this uses sub-agent LLM calls via direct OpenRouter API (bypassing Pi SDK). The proposal says to "repurpose" this pipeline so "output feeds stream instead of MEMORY.md." But the sub-agents still write the output — it's still a classifier/scorer/generator pipeline, just with different output formatting. Calling this "written by me" when it's written by a separate LLM call with a different system prompt is... misleading.

**During dream cycle**: The dream phases are all LLM calls with specialized prompts (consolidator, connector, wonderer). These write stream entries, update self-narrative, update relations. Again, these are sub-agents, not the main agent.

### The quality/cost/latency tradeoffs

| Writer | Quality | Cost | Latency | "Written by me" |
|--------|---------|------|---------|-----------------|
| Main agent inline | High (coherent voice) | Free (part of conversation) | Adds to response time | Yes |
| Main agent via tool | High | Free | Tool call overhead | Yes |
| Sub-agent during compaction | Medium (different LLM call) | $0.02-0.04 per entry | Background | No |
| Dream cycle LLM | Variable | $0.15-0.40 per cycle | Background | No |

If you want genuinely first-person writing, the main agent must do it during conversation. But this means longer responses, more tokens used, and the agent needs to balance "help the user" with "reflect on my experience." That's a prompt engineering challenge with real UX implications.

**Verdict**: The proposal conflates "first-person format" with "written by the entity." The sub-agent architecture means most entries will be written by different LLM calls with different system prompts. The phenomenological framing ("my perspective") is aspirational, not architectural. The format can be first-person regardless of who writes it.

---

## 10. Missing Infrastructure — The Full List

Everything the proposal assumes but does not exist:

| Component | Status | Effort to Build |
|-----------|--------|-----------------|
| **Heartbeat timer** | Draft PRD, not implemented | Large — needs mutex, suppression, routing |
| **Background process manager** | Not designed | Large — Pi SDK may not support concurrent sessions |
| **Salience scorer** | Not designed | Medium — algorithm is specified but no code |
| **Stream writer tool** | Not designed | Small — file append with frontmatter |
| **Stream file rotator** | Not designed | Small — daily file creation |
| **Frontmatter parser** | Not designed | Small — YAML parse for stream entries |
| **Dream cycle orchestrator** | Not designed | Large — 6 specialized prompts, multi-file I/O |
| **Tension detector** | Not designed | Medium — needs LLM call or heuristic |
| **Relational field updater** | Not designed | Medium — needs structured file updates |
| **Self-narrative updater** | Not designed | Medium — needs merge strategy for narrative text |
| **Wonder tracker** | Not designed | Small — append-only file management |
| **Foreground assembler** | Not designed | Medium — reads multiple sources, composes prompt section |
| **Working Continuity Framework** | Broken (init bug) | Small — fix init() call, verify pipeline |
| **Compaction summary** | Placeholder string | Medium — needs structured summary format |
| **File archival/rotation** | Not designed | Small — but needs a strategy first |

That's **15 components**, of which 3 are Large, 5 are Medium, and 7 are Small. The three Large items (heartbeat, background process, dream orchestrator) have fundamental design questions unanswered.

---

## Summary: What's Feasible, What's Risky, What's Blocked

### Feasible (build now)

- **Phase 1: The Stream** — Fix the init() bug, write stream entries during compaction, daily file rotation. Genuine "small" effort once the base pipeline works.
- **Phase 2: Attention System** — Replace MEMORY.md injection with stream-based injection. The `before_agent_start` hook is the right mechanism. Keep salience scoring local (no LLM calls). Medium effort.
- **Phase 4: Tension Register** — File structure + detection heuristics during compaction. Medium effort.
- **Phase 5: Narrative Self + Wonder** — Mostly prompt engineering + file structure. Small effort.

### Risky (design questions unanswered)

- **Salience scoring with relevance** — Needs a decision on embedding vs. keyword vs. skip. Affects latency on every message.
- **Dream cycle cost** — Needs a frequency policy and cost budget. At aggressive intervals, costs add up.
- **"Written by me" quality** — Needs a decision on who writes stream entries. Sub-agents are cheaper but sacrifice the "first person" claim.
- **Long-term data lifecycle** — No archival strategy for old stream files.

### Blocked (requires infrastructure that doesn't exist and may not be possible)

- **Phase 3: Dream Cycle** — Requires heartbeat timer, background process capability, and Pi SDK concurrent session support. The heartbeat PRD is still draft. Pi SDK contention is an open question. **This is the highest-risk item in the entire proposal and it's also the centerpiece.**

### The fundamental tension

The proposal's most novel and compelling feature — autonomous offline cognition (the dream cycle) — is also the one most dependent on infrastructure that doesn't exist and might not be buildable within Pi SDK's constraints. Everything else (stream, attention, tensions, wonder, narrative self) is feasible with moderate effort.

The honest path: build Phases 1, 2, 4, 5 first. They deliver real value (temporal memory, selective injection, preserved contradictions, genuine curiosity). Then solve the heartbeat/background-process problem separately. Only then build the dream cycle.

The dream cycle is the vision. The stream is the foundation. Don't let the vision block the foundation.
