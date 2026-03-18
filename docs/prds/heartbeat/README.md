---
status: draft
date: 2026-03-18
author: "kuba + claude"
---

# Heartbeat — Background Awareness for Lucy

## Problem

Lucy is purely reactive. She exists only when spoken to — no awareness of what happened between conversations, no preparation for what's coming, no ability to catch problems before the user notices them. When you open a conversation after 14 hours away, Lucy starts cold. She doesn't know your CI failed at 3am, that a prediction she made was confirmed, or that a task has been sitting untouched for two weeks.

Every existing solution to this is either a dumb cron job (fires blindly, wastes tokens on "nothing happened" 80% of the time) or an unbounded autonomous loop (AutoGPT's failure mode — runaway costs, no memory, no judgment). Neither makes an agent feel prepared.

Lucy already has the memory infrastructure (anamnesis: extraction, scoring, predictions, tensions, knowledge graph). What's missing is the *when* — a mechanism to activate that infrastructure between conversations, proportional to what's happening in the world.

## Proposed Solution

A phased system that evolves from simple conversation-start catch-up to full background awareness. Each phase delivers standalone value — you can stop at any phase and have a working system.

The core architecture is a **two-stage gate**: a deterministic pre-filter (free) checks whether anything changed before an LLM is involved. When the LLM fires, it uses **progressive deepening** — an ordered list of reflection tasks processed within a token budget, interruptible at any point. The system coordinates across invocations through **stigmergy** — shared artifacts in `.agents/heartbeat/` — not through process continuity.

The framing is **level-triggered reconciliation**: each tick asks "what's my drift from expected state?" not "what changed since last tick?" This is self-correcting against missed signals.

## Phases

Each phase is a checkpoint. Each delivers value independently.

### Phase 0: On-Demand Reflection

*Prepared agent > unprepared agent. Validate the concept with zero background infrastructure.*

When a conversation starts and it's been >N hours since the last one, anamnesis runs a catch-up reflection before the conversation begins. One LLM call: load git changes, pending predictions, stale tasks, and calendar context since last conversation. Inject findings into conversation context.

**What it delivers:** Lucy greets you already knowing what happened while you were away. No timers, no scheduler, no new files — just an enhancement to the existing `before_agent_start` hook.

**Key additions:**
- Time-since-last-conversation detection in anamnesis
- Catch-up prompt template (git log, predictions, task staleness, calendar)
- Findings injected as conversation context
- Cost: one extra LLM call per conversation start (~5-10K tokens)

### Phase 1: Event Detection + Deterministic Pre-Filter

*Background infrastructure that's safe, observable, and cheap. Most ticks cost zero tokens.*

A gateway extension (`src/gateway/extensions/heartbeat/`) runs on a fixed interval (default: 15 min). Each tick runs the deterministic pre-filter: compare `.agents/heartbeat/snapshot.json` against current state (file mtimes, git log, calendar, task board, pending intentions). If nothing changed, log HEARTBEAT_OK and skip the LLM entirely.

When changes are detected, acquire the async mutex on `AgentRuntime`, send a heartbeat message through the Pi SDK, and let the agent evaluate whether the changes matter.

**What it delivers:** Lucy has a background pulse. She detects changes in real-time and evaluates them without human prompting. 60-80% of ticks resolve at the pre-filter for zero LLM cost.

**Key additions:**
- Gateway extension: `src/gateway/extensions/heartbeat/` (scheduler, pre-filter, safety limits, traces)
- Pi extension: `.pi/extensions/heartbeat.ts` (prompt injection, output classification)
- Async mutex on `AgentRuntime` (replaces boolean `isBusy()`)
- State files: `.agents/heartbeat/` (HEARTBEAT.md, state.json, snapshot.json, traces.jsonl)
- Safety limits: 5-min floor, daily token budget (500K), consecutive tick cap (3), cost velocity alert
- HEARTBEAT_OK suppression
- Structured traces per tick (injectable clock for testing)
- `/api/heartbeat/trigger` endpoint
- Startup recovery from state.json
- Prompt caching on heartbeat system prompt
- `HEARTBEAT_ENABLED` env var gate

### Phase 2: Progressive Reflection + Surfaces

*The agent thinks between conversations and surfaces findings at the right moment.*

Replace fixed "routine vs deep" modes with a single **anytime algorithm** that progressively deepens within a token budget:

1. Check predictions against observable state [500 tokens]
2. Review active tensions for new information [1,000 tokens]
3. Scan memory for contradictions and temporal validity [2,000 tokens]
4. Cross-conversation pattern recognition [3,000 tokens]
5. Generate new predictions [2,000 tokens]
6. Curiosity-driven exploration of one knowledge gap [5,000 tokens]
7. Self-assessment and growth arc updates [3,000 tokens]

Each step is independently valuable. Interrupted at any point (user message arrives), whatever completed is useful. A **depth scorer** determines how many steps to run based on accumulated drift and time since last reflection.

Surfaces (findings worth sharing) go into a queue with **tiered decay**: ephemeral (48h), observational (2 weeks), pattern (no expiry — strengthens with evidence). Delivery is **contextual**: surfaces appear when the user is working on the relevant topic, not front-loaded at session start. Push at most 1 at conversation start; offer the rest as pull.

**What it delivers:** Lucy processes experience into understanding between conversations. She catches memory contradictions, validates predictions, detects stale commitments, and surfaces findings at contextually appropriate moments.

**Key additions:**
- Progressive reflection engine (anytime algorithm with token budget)
- Depth scorer (determines processing depth from drift magnitude)
- Defensive behaviors: contradiction detection, temporal validity, staleness scoring
- Intention tracking (from conversations → checked by heartbeat)
- Surfaces queue with tiered decay (`.agents/heartbeat/surfaces.json`)
- Contextual delivery via anamnesis relevance scoring
- Push 1 / offer rest as pull pattern
- Telegram push for escalation categories (rate-limited, circuit-breakered)
- Model tiering: cheap model (Haiku) for routine via direct `llmCall()`, full model for escalation via Pi SDK
- Conservative cold-start allow-list (default ON: build failures, security; default OFF: observations)
- Staleness detection: consecutive zero-change reflections → exponential backoff → auto-pause

### Phase 3: Trust Expansion + Actionable Artifacts

*The agent prepares concrete work — the user reviews and promotes with a single approval.*

Expand the trust boundary from T0 (internal state only) to T1 (reversible artifacts):

| Tier | What | Example |
|------|------|---------|
| T0: Internal | Agent's own state | Memory, journal, knowledge graph |
| T1: Reversible | Sandboxed, require human promotion | Git branches (`lucy/` prefix), prepared changesets, draft diffs |
| T2: External | Affect humans, contained | Telegram alerts with rate limits + circuit breakers + expiration |

Surfaces evolve from text descriptions to **actionable artifacts**: prepared diffs, changesets, draft branches. The user promotes with a single approval.

**What it delivers:** When Lucy notices tests failing due to a missing env var, she doesn't just tell you — she prepares the fix. When she spots a stale import, she has the diff ready. Review is lightweight because the work is done.

**Key additions:**
- T1 action support: sandboxed git branches (`lucy/` prefix), changesets in `.agents/heartbeat/changesets/`
- Actionable surface template: observation + evidence + impact + action + changeset
- Daily digest delivery tier (batched summary at user-configured time)
- Thinking log view (queryable surface history: "what have you been thinking about?")
- Tonic state layer (slow-moving variables: project phase, trust level, attention allocation)
- Standing orders with full safeguards (rate limits, circuit breakers, 30-day expiration, conflict detection)
- Bootstrap observation phase (first 2 weeks: observation-only, collecting baselines)

### Phase 4: Adaptive Agency

*The agent develops its own concerns and pursues them within boundaries.*

- Agent-requested check-back times via `heartbeat_schedule` tool
- Self-directed analysis focus (agent identifies its own areas of uncertainty)
- Attention schema: agent evaluates its own attention allocation after each tick
- Adaptive push: learn when the user is receptive vs. when to hold
- User control surface: pause/resume, frequency override, silence hours, retrospective ("what did your heartbeat do today?")
- Adaptive intervals as optional experiment (with AIMD asymmetry, periodic probing, baseline memory, jitter)

## Key Cases

- **Nothing changed since last tick** — pre-filter catches it, no LLM call, HEARTBEAT_OK logged, zero tokens spent
- **Changes detected but not significant** — LLM evaluates, decides nothing worth surfacing, logs silent tick
- **Prediction confirmed/contradicted** — agent updates prediction, queues surface with evidence
- **Task stale for >N days** — agent queues surface: "You haven't mentioned X in 2 weeks — still a priority?"
- **CI failure on main** — pre-filter detects, LLM evaluates, pushes via Telegram (standing order)
- **User arrives after long gap** — Phase 0 catch-up runs, findings injected into context
- **User mid-conversation when tick fires** — async mutex prevents contention, tick waits or skips
- **Memory contradiction found** — agent flags: "You said X in January but Y last week — which is current?"
- **Calendar event approaching** — pre-filter detects event in next 2 hours, triggers context preparation
- **Agent in tight loop** — safety limits: 5-min floor, 3 consecutive active tick cap, daily budget circuit breaker
- **Process restarts** — state.json persists on volume, startup recovery fires catch-up tick if overdue
- **Surface ignored repeatedly** — suppression learning reduces that category; cold-start allow-list prevents initial noise

## Out of Scope

- Multi-user / multi-tenant heartbeat scheduling
- Multi-agent coordination (gossip protocols, shared scheduling)
- Self-modifying prompts or system prompt changes
- News aggregation or general information retrieval
- Emotional check-ins or relationship maintenance behaviors
- Full autonomous code modification on main branch
- Real-time collaboration features (WebSocket push to UI — future)
- Custom ML models for depth scoring or suppression learning

## Security Model

- **HEARTBEAT.md is immutable to the agent** — hash-verified before each tick
- **Monitored data is untrusted input** — wrapped in `<untrusted_data>` tags, never treated as instructions
- **Memory quarantine** — agent-generated content separated from system instructions in prompt
- **Write audit** — every `.agents/` write during heartbeat logged in trace with reasoning
- **T3 actions never in background** — code on main, deploys, deletes, external messages outside standing orders
- **Cost runaway protection** — hard budget ceiling, velocity alerts, consecutive tick cap

## Cost Model

| Phase | Monthly | Annual | Notes |
|-------|---------|--------|-------|
| Phase 0 (on-demand) | $2-5 | $30-60 | One LLM call per conversation start |
| Phase 1 (pre-filter + pulse) | $5-10 | $60-120 | 60-80% of ticks are free |
| Phase 2 (progressive reflection) | $15-22 | $180-265 | Sonnet for deep analysis |
| Phase 2 + prompt caching | $12-19 | $145-230 | ~15-20% savings on cached prompt |
| Phase 3+ (full system) | $15-25 | $180-300 | Actionable surfaces add minimal cost |

The honest question: does background processing produce measurably better outcomes than on-demand? Track ROI from Phase 0. If Phase 0 proves sufficient, the background phases may not be worth the complexity.

## Open Questions

- **Depth scorer implementation** — should it be deterministic (formula over drift signals) or a cheap LLM call (Haiku classifying "how deep should I go?")? Deterministic is simpler and free; LLM handles nuance better. Could start deterministic and upgrade.
- **Pi SDK `sendCustomMessage` vs async mutex** — the Pi SDK may support `sendCustomMessage({ deliverAs: "followUp" })` which eliminates the TOCTOU race without a mutex. Need to verify Pi SDK API surface.
- **Prompt caching mechanics** — does the Pi SDK support cache-control headers for the system prompt? If not, heartbeat may need to bypass Pi SDK for cached calls (using `llmCall()` directly, like anamnesis does).

## References

- Research: `research_heartbeat/` (10 files, round 1 + round 2)
- Research: `research_heartbeat_v2/` (11 files, independent parallel research)
- Final synthesis: `research_heartbeat/FINAL_SUMMARY.md`
- Proposal: `research_heartbeat/proposal.md` (updated with round 2 revisions)
- v2 proposal: `research_heartbeat_v2/proposal.md` (with challenge revisions inline)
- Existing memory system: `.pi/extensions/anamnesis/` (hooks, extraction, scoring, predictions)
- Gateway extension pattern: `src/gateway/extensions/telegram/` (reference implementation)
- Runtime: `src/runtime/core/src/runtime/agent-runtime.ts`
