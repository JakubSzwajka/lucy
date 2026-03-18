---
prd: heartbeat
generated: 2026-03-18
last-updated: 2026-03-18
---

# Tasks: Heartbeat — Background Awareness for Lucy

> 22 tasks across 5 phases. Each phase delivers standalone value. Tasks within a phase can often be parallelized. Cross-phase dependencies are explicit.

## Task List

### Phase 0: On-Demand Reflection
- [ ] **1. Detect time gap at conversation start** — track last conversation timestamp, detect gaps >N hours
- [ ] **2. Build catch-up prompt template** — git changes, predictions, stale tasks, calendar since last conversation
- [ ] **3. Inject catch-up reflection into conversation context** — wire the gap detection + prompt into anamnesis before_agent_start

### Phase 1: Event Detection + Pre-Filter
- [ ] **4. Add async mutex to AgentRuntime** — serialize all sendMessage/sendMessageStreaming across channels
- [ ] **5. Create heartbeat gateway extension skeleton** — plugin factory, env var gate, registration in boot sequence
- [ ] **6. Implement deterministic pre-filter** — snapshot diffing for file mtimes, git log, task board, pending intentions
- [ ] **7. Create heartbeat Pi extension** — detect heartbeat messages, inject heartbeat-specific prompt, classify output
- [ ] **8. Create HEARTBEAT.md and state files** — standing instructions with hash verification, state.json, snapshot.json
- [ ] **9. Implement HEARTBEAT_OK suppression and structured traces** — output classification, trace schema, injectable clock
- [ ] **10. Add safety limits** — interval floor, daily token budget, consecutive tick cap, cost velocity alert
- [ ] **11. Add /api/heartbeat endpoints and startup recovery** — trigger/status routes, state.json recovery on boot `[blocked by: 5, 6]`

### Phase 2: Progressive Reflection + Surfaces
- [ ] **12. Implement progressive reflection engine** — anytime algorithm with ordered steps and token budget `[blocked by: 7]`
- [ ] **13. Add defensive behaviors** — memory contradiction detection, temporal validity checking, staleness scoring `[blocked by: 12]`
- [ ] **14. Add intention tracking** — extract implicit intentions from conversations, check completion in heartbeat `[blocked by: 12]`
- [ ] **15. Implement surfaces queue with tiered decay** — ephemeral/observational/pattern types, contextual delivery `[blocked by: 12]`
- [ ] **16. Wire surfaces into conversation delivery** — anamnesis injects relevant surfaces, push-1-offer-rest pattern `[blocked by: 15]`
- [ ] **17. Add model tiering** — Haiku via llmCall for routine pulse, Pi SDK session for escalation `[blocked by: 7]`
- [ ] **18. Add Telegram push for escalation** — rate-limited, circuit-breakered standing order execution `[blocked by: 15]`

### Phase 3: Trust Expansion + Actionable Artifacts
- [ ] **19. Add T1 action support** — sandboxed git branches (lucy/ prefix), changeset preparation `[blocked by: 12]`
- [ ] **20. Add daily digest and thinking log** — batched delivery tier, queryable surface history `[blocked by: 15]`
- [ ] **21. Add tonic state layer** — slow-moving variables (project phase, trust level, attention allocation) `[blocked by: 12]`

### Phase 4: Adaptive Agency
- [ ] **22. Add agent-requested check-backs and user controls** — heartbeat_schedule tool, pause/resume, silence hours, retrospective `[blocked by: 11, 12]`

---

### 1. Detect time gap at conversation start
<!-- status: pending -->

Add a last-conversation timestamp to anamnesis state. In the `before_agent_start` hook, compare current time against this timestamp. If the gap exceeds a configurable threshold (default: 4 hours), set a flag that task 3 will use to trigger catch-up reflection. Write the timestamp on every `agent_end` event.

**Files:** `.pi/extensions/anamnesis/index.ts` (add `agent_end` listener ~line 473, read timestamp in `before_agent_start` ~line 219), `.agents/heartbeat/state.json` (new — stores `lastConversation` timestamp)
**Depends on:** —
**Validates:** After a conversation, `.agents/heartbeat/state.json` contains a `lastConversation` timestamp. On next conversation start after >4 hours, anamnesis detects the gap.

---

### 2. Build catch-up prompt template
<!-- status: pending -->

Create a prompt template that assembles catch-up context: git log since last conversation, pending predictions with approaching deadlines, tasks untouched for >N days, and calendar events in the next 2 hours (if calendar integration exists). Use `llmCall()` with the cheap model to process the raw context into a concise briefing. The template should produce a 3-5 sentence summary of "what happened while you were away."

**Files:** `.pi/extensions/anamnesis/src/catchup.ts` (new), `.pi/extensions/anamnesis/src/framework/src/llm-call.js` (existing — use for cheap model call)
**Depends on:** —
**Validates:** Given a git log and list of stale predictions, `catchup.ts` produces a concise briefing via llmCall. Unit-testable with mock data.

---

### 3. Inject catch-up reflection into conversation context
<!-- status: pending -->

Wire tasks 1 and 2 together. In `before_agent_start`, when a time gap is detected, call the catch-up function and prepend its output to the assembled context. Add a new env var `HEARTBEAT_CATCHUP_HOURS` (default: 4) to configure the gap threshold. The catch-up section should appear before the regular anamnesis context so the agent opens with awareness.

**Files:** `.pi/extensions/anamnesis/index.ts` (modify `before_agent_start` hook ~line 219), `.env.example` (add `HEARTBEAT_CATCHUP_HOURS`)
**Depends on:** 1, 2
**Validates:** Start a conversation after >4 hours. Lucy's first response references recent changes or stale items without being prompted. The catch-up adds ~500-1000 tokens to context.

---

### 4. Add async mutex to AgentRuntime
<!-- status: pending -->

Install `async-mutex` (2KB). Add a `_processingLock` to `AgentRuntime` that serializes all `sendMessage()` and `sendMessageStreaming()` calls. Both methods acquire the lock before calling `session.prompt()` and release on completion (including error paths). This prevents the TOCTOU race between heartbeat ticks, Telegram messages, and HTTP chat requests hitting the same session concurrently.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts` (wrap `sendMessage` ~line 202 and `sendMessageStreaming` ~line 184 with mutex), `package.json` (add `async-mutex`)
**Depends on:** —
**Validates:** Two concurrent `sendMessage()` calls serialize correctly — second waits for first to complete. No session corruption under concurrent invocation.

---

### 5. Create heartbeat gateway extension skeleton
<!-- status: pending -->

Create `src/gateway/extensions/heartbeat/src/index.ts` following the Telegram plugin pattern: `createHeartbeatPlugin()` factory returning `{ onInit({ app, runtime, config }) }`. Use `croner` for the interval timer with `protect: true` (overlap prevention). Gate behind `HEARTBEAT_ENABLED` env var. Register in gateway boot sequence in `src/gateway/core/src/index.ts` after Telegram. Add `HEARTBEAT_ENABLED` and `HEARTBEAT_INTERVAL_MINUTES` to `.env.example`.

**Files:** `src/gateway/extensions/heartbeat/src/index.ts` (new), `src/gateway/core/src/index.ts` (add heartbeat init ~line 40), `package.json` (add `croner`), `.env.example` (add env vars)
**Depends on:** 4
**Validates:** With `HEARTBEAT_ENABLED=true`, the plugin initializes and logs `[heartbeat] initialized`. Timer fires at configured interval. Without the env var, nothing happens.

---

### 6. Implement deterministic pre-filter
<!-- status: pending -->

Create `src/gateway/extensions/heartbeat/src/pre-filter.ts`. On each tick: load `.agents/heartbeat/snapshot.json` (previous state), compute current state (file mtimes on `.agents/experience/`, `git log --oneline --since=<last_tick>`, task board mtime, pending intention timestamps), diff against snapshot. If all diffs are empty, return `{ changed: false }` and skip the LLM. If changes detected, return `{ changed: true, summary: {...} }`. Save new snapshot. This is **level-triggered**: compare current state vs. model, not edge-triggered.

**Files:** `src/gateway/extensions/heartbeat/src/pre-filter.ts` (new), `.agents/heartbeat/snapshot.json` (new — created on first tick)
**Depends on:** —
**Validates:** Pre-filter returns `changed: false` when no files changed since last tick. Returns `changed: true` with a summary when git has new commits. Runs in <50ms.

---

### 7. Create heartbeat Pi extension
<!-- status: pending -->

Create `.pi/extensions/heartbeat.ts`. Register on `before_agent_start`: detect heartbeat messages (check for `[HEARTBEAT]` prefix in the input message), and when detected, replace the system prompt with a heartbeat-specific prompt that includes: HEARTBEAT.md contents (as `<trusted_instructions>`), pre-filter change summary (as `<untrusted_data>`), anamnesis-assembled context (reuse existing assembly but with tighter token budget), and heartbeat state. Classify agent output: if response <300 chars and starts with "OK" → HEARTBEAT_OK (suppress). Otherwise classify as `silent` / `queued` / `pushed`.

**Files:** `.pi/extensions/heartbeat.ts` (new), `.pi/extensions/anamnesis/index.ts` (export context assembly function for reuse)
**Depends on:** 5
**Validates:** A message prefixed with `[HEARTBEAT]` gets a different system prompt than a regular conversation message. Output starting with "OK" is classified as HEARTBEAT_OK.

---

### 8. Create HEARTBEAT.md and state files
<!-- status: pending -->

Create `.agents/heartbeat/` directory with: `HEARTBEAT.md` (standing instructions template — what to monitor, escalation rules, reverie focus areas), `state.json` (tick state: lastTick, consecutiveIdles, lastUserActivity, tokenBudgetUsedToday, tonicState), `snapshot.json` (last-known state of monitored sources). Implement hash verification for HEARTBEAT.md: compute SHA-256 on first read, verify on subsequent reads, abort tick if hash changes unexpectedly (agent tried to modify it).

**Files:** `.agents/heartbeat/HEARTBEAT.md` (new), `.agents/heartbeat/state.json` (new), `src/gateway/extensions/heartbeat/src/state.ts` (new — state read/write/hash verification)
**Depends on:** —
**Validates:** `state.ts` reads and writes state.json atomically (write to .tmp, rename). HEARTBEAT.md hash verification detects modifications and aborts tick with a warning log.

---

### 9. Implement HEARTBEAT_OK suppression and structured traces
<!-- status: pending -->

Create `src/gateway/extensions/heartbeat/src/trace.ts` with the `HeartbeatTrace` interface: tickId, timestamp, mode, preFilterResult, llmInvoked, durationMs, tokensUsed, dataSources, decision, decisionReason, memoryWrites, nextTickMs, error. Write traces to `.agents/heartbeat/traces.jsonl` (append-only). Implement an injectable clock interface (`{ now(): number }`) — production uses `Date.now()`, tests inject a mock. Suppress HEARTBEAT_OK responses from reaching any output channel.

**Files:** `src/gateway/extensions/heartbeat/src/trace.ts` (new), `src/gateway/extensions/heartbeat/src/clock.ts` (new — injectable clock interface)
**Depends on:** —
**Validates:** Each tick produces a JSON line in traces.jsonl with all fields populated. Tests can fast-forward time via injected clock. HEARTBEAT_OK responses are logged in trace but not forwarded to any subscriber.

---

### 10. Add safety limits
<!-- status: pending -->

Create `src/gateway/extensions/heartbeat/src/safety.ts`. Implement: minimum interval floor (5 min, non-overridable), daily token budget (default 500K, tracked in state.json, resets at midnight local time), consecutive active tick cap (3 — force cooldown to base interval after 3 consecutive LLM-invoking ticks), cost velocity alert (if token spend rate exceeds 2x the 7-day rolling average, pause heartbeat and log warning). All limits checked in Stage 0 of the beat cycle, before pre-filter runs.

**Files:** `src/gateway/extensions/heartbeat/src/safety.ts` (new), `.env.example` (add `HEARTBEAT_TOKEN_BUDGET`)
**Depends on:** 9
**Validates:** Heartbeat refuses to fire within 5 minutes of last tick regardless of configuration. After 3 consecutive active ticks, next tick is forced to base interval. Budget exceeded → heartbeat pauses with log message.

---

### 11. Add /api/heartbeat endpoints and startup recovery
<!-- status: pending -->

Add routes to the heartbeat gateway extension: `GET /api/heartbeat/status` (returns current state: last tick, next tick, budget remaining, consecutive idles, enabled/paused), `POST /api/heartbeat/trigger` (manually trigger a tick — useful for testing and external schedulers). Both routes respect `LUCY_API_KEY` auth. On gateway startup, read state.json: if last tick is overdue by more than one interval, fire a single catch-up tick (not all missed ticks). If state.json is corrupted or missing, reset to defaults and log warning.

**Files:** `src/gateway/extensions/heartbeat/src/routes.ts` (new), `src/gateway/extensions/heartbeat/src/index.ts` (add startup recovery logic)
**Depends on:** 5, 6
**Validates:** `GET /api/heartbeat/status` returns JSON with current heartbeat state. `POST /api/heartbeat/trigger` fires a tick immediately. After process restart with overdue state, exactly one catch-up tick fires.

---

### 12. Implement progressive reflection engine
<!-- status: pending -->

Create `src/gateway/extensions/heartbeat/src/reflection.ts` (or as part of the Pi extension). Implement the anytime algorithm: an ordered list of reflection steps, each with a token budget estimate. A depth scorer determines total budget based on: accumulated drift magnitude (from pre-filter), time since last reflection, staleness score. Steps execute in order within budget. Each step is independently valuable — if interrupted (user message arrives, budget exhausted), partial results are persisted. Steps: (1) check predictions, (2) review tensions, (3) memory contradiction scan, (4) pattern recognition, (5) generate predictions, (6) curiosity exploration, (7) self-assessment.

**Files:** `src/gateway/extensions/heartbeat/src/reflection.ts` (new), `.pi/extensions/heartbeat.ts` (extend with reflection prompt templates per step)
**Depends on:** 7
**Validates:** Given a depth budget of 3000 tokens, the engine runs steps 1-2 and stops. Given 15000 tokens, it runs steps 1-5. Partial results from interrupted runs are saved to state.

---

### 13. Add defensive behaviors
<!-- status: pending -->

Implement as reflection steps within the progressive engine: (a) **Memory contradiction detection** — scan `.agents/experience/memory/MEMORY.md` for entries that contradict each other (e.g., "prefers Python" vs. "learning TypeScript"). Use llmCall with cheap model to compare flagged pairs. (b) **Temporal validity** — scan for commitments with implied deadlines that have passed. (c) **Stale context** — check knowledge nodes and disposition profiles for references to projects/situations that no longer appear in recent conversations. Flag findings as surfaces.

**Files:** `src/gateway/extensions/heartbeat/src/reflection.ts` (add steps), `.pi/extensions/heartbeat.ts` (add prompts for contradiction/validity checks)
**Depends on:** 12
**Validates:** Given a memory file with contradictory entries, the contradiction scan flags them. Given a prediction with a passed deadline, temporal validity flags it. Results appear in surfaces queue.

---

### 14. Add intention tracking
<!-- status: pending -->

During conversations (via anamnesis), detect implicit "I need to do X" statements and write them to `.agents/heartbeat/intentions.json` with a timestamp and topic tags. During heartbeat reflection (step added to progressive engine), check whether each intention has been addressed in subsequent conversations. Surface unaddressed intentions: "You mentioned wanting to do X three days ago — still on your radar?"

**Files:** `.pi/extensions/anamnesis/index.ts` (add intention extraction to `session_before_compact` or `agent_end`), `src/gateway/extensions/heartbeat/src/reflection.ts` (add intention check step), `.agents/heartbeat/intentions.json` (new)
**Depends on:** 12
**Validates:** After a conversation where the user says "I should refactor the auth module," an entry appears in intentions.json. After 3 days without mention, the heartbeat surfaces it.

---

### 15. Implement surfaces queue with tiered decay
<!-- status: pending -->

Create `.agents/heartbeat/surfaces.json` with schema: id, created, type (ephemeral | observational | pattern), observation, evidence, impact, suggestedAction, urgency (1-10), relevanceTo (topic tags), channel (contextual | push | digest), surfaced (bool), surfacedAt, engaged (bool | null). Implement decay: ephemeral surfaces archive after 48h, observational after 2 weeks, pattern surfaces never expire but strengthen with evidence. Add a `surfaces.ts` module for CRUD operations.

**Files:** `src/gateway/extensions/heartbeat/src/surfaces.ts` (new), `.agents/heartbeat/surfaces.json` (new)
**Depends on:** 12
**Validates:** Creating an ephemeral surface, then checking after 48h → it's archived. Pattern surfaces persist indefinitely. Surfaces have all schema fields populated.

---

### 16. Wire surfaces into conversation delivery
<!-- status: pending -->

In anamnesis `before_agent_start`, load pending surfaces from `surfaces.json`. Match surface `relevanceTo` tags against conversation context (reuse anamnesis relevance scoring). Inject at most 1 high-urgency surface directly into context. For remaining relevant surfaces, add a note: "I have N other observations — ask if you'd like to hear them." Mark surfaced items. Track engagement: if the user responds to a surface, mark `engaged: true`; if they ignore it across 2 conversations, mark `engaged: false`. Feed engagement data back to suppression learning.

**Files:** `.pi/extensions/anamnesis/index.ts` (add surface loading + injection in `before_agent_start`), `src/gateway/extensions/heartbeat/src/surfaces.ts` (add engagement tracking)
**Depends on:** 15
**Validates:** A queued surface about the auth module appears when the user starts a conversation about auth. Engagement is tracked. Ignored surfaces reduce future surfacing of that category.

---

### 17. Add model tiering
<!-- status: pending -->

For heartbeat pulse (routine checks via pre-filter → LLM evaluation), use `llmCall()` directly with a cheap model (env var `HEARTBEAT_MODEL`, default `anthropic/claude-haiku-4-5-20251001`). For escalation (depth scorer says "deep"), route through the Pi SDK session using `runtime.sendMessage()` with the full model. This avoids the Pi SDK single-session constraint for cheap calls while preserving full agent capabilities for deep reflection.

**Files:** `src/gateway/extensions/heartbeat/src/index.ts` (routing logic), `.env.example` (add `HEARTBEAT_MODEL`)
**Depends on:** 7
**Validates:** Routine pulse ticks use the cheap model (visible in traces.jsonl). Deep reflections use the full Pi SDK model. Cost per routine tick is ~10x cheaper than full model.

---

### 18. Add Telegram push for escalation
<!-- status: pending -->

When a surface has urgency >7 and a standing order in HEARTBEAT.md matches, push via the existing Telegram client. Implement safeguards: rate limit (max 1 push/hour, max 5/day), circuit breaker (auto-disable after 3 consecutive pushes that user didn't engage with), expiration (standing orders expire after 30 days, require re-confirmation via conversation). Log all push events in traces.

**Files:** `src/gateway/extensions/heartbeat/src/push.ts` (new), `src/gateway/extensions/heartbeat/src/index.ts` (wire push after surface classification), `src/gateway/extensions/telegram/src/telegram-client.ts` (reuse existing `sendMessage`)
**Depends on:** 15
**Validates:** A CI failure surface with urgency 8 triggers a Telegram message. Second push within 1 hour is suppressed. After 3 ignored pushes, the standing order auto-disables with a log entry.

---

### 19. Add T1 action support
<!-- status: pending -->

Implement sandboxed reversible actions during heartbeat: (a) Create git branches with `lucy/` prefix (never on main/working branch). (b) Write prepared changesets to `.agents/heartbeat/changesets/<surface-id>.patch`. (c) Surfaces with changesets include a `changeset` field pointing to the patch file. The user can review the diff and promote via conversation ("apply that fix"). T1 actions are gated behind a `HEARTBEAT_T1_ENABLED` env var (default: false).

**Files:** `src/gateway/extensions/heartbeat/src/actions.ts` (new — git branch creation, changeset writing), `.agents/heartbeat/changesets/` (new directory), `.env.example` (add `HEARTBEAT_T1_ENABLED`)
**Depends on:** 12
**Validates:** Heartbeat creates a `lucy/fix-env-var` branch with a prepared changeset. The changeset is a valid patch file. Branch is never on main. Without `HEARTBEAT_T1_ENABLED`, T1 actions are skipped.

---

### 20. Add daily digest and thinking log
<!-- status: pending -->

Implement a daily digest: at user-configured time (env var `HEARTBEAT_DIGEST_TIME`, default: "18:00"), batch all medium-urgency surfaces into a structured summary and deliver via configured channel (Telegram or queued for next conversation). Implement thinking log: expose surfaces.json via `GET /api/heartbeat/surfaces` route (respects auth). The user can query "what have you been thinking about?" and the agent reads from the route or the file directly.

**Files:** `src/gateway/extensions/heartbeat/src/digest.ts` (new), `src/gateway/extensions/heartbeat/src/routes.ts` (add surfaces endpoint), `.env.example` (add `HEARTBEAT_DIGEST_TIME`)
**Depends on:** 15
**Validates:** At 6pm, a batched summary of the day's medium-urgency surfaces is delivered. `GET /api/heartbeat/surfaces` returns the full queue as JSON.

---

### 21. Add tonic state layer
<!-- status: pending -->

Add a `tonicState` object to state.json with slow-moving variables: `userRelationshipPhase` (new | developing | established), `projectPhase` (active-dev | maintenance | pre-launch), `trustLevel` (0-1, how much autonomous action sanctioned), `agentConfidence` (0-1, recent performance self-assessment), `attentionAllocation` (record of topic → attention score). Updated by deep reflection steps (step 7 in progressive engine), read by every tick to bias depth scoring and surface urgency thresholds. Changes slowly over days/weeks.

**Files:** `src/gateway/extensions/heartbeat/src/state.ts` (extend state schema), `src/gateway/extensions/heartbeat/src/reflection.ts` (step 7 updates tonic state)
**Depends on:** 12
**Validates:** Tonic state persists across ticks. Deep reflections update `projectPhase` based on observed activity patterns. Depth scorer uses `trustLevel` to modulate processing depth.

---

### 22. Add agent-requested check-backs and user controls
<!-- status: pending -->

Register a `heartbeat_schedule` tool in the Pi extension that lets the agent request a specific check-back time during conversations: "Check back on this in 2 hours." Store in state.json as `pendingCheckbacks`. The scheduler honors these (with hard floor enforcement). Add user control surface: the agent understands "pause heartbeat," "resume heartbeat," "heartbeat status," "what did your heartbeat do today?" as conversation commands that read from traces and state. Add `HEARTBEAT_QUIET_START` and `HEARTBEAT_QUIET_END` env vars for silence hours.

**Files:** `.pi/extensions/heartbeat.ts` (register tool), `src/gateway/extensions/heartbeat/src/state.ts` (add pendingCheckbacks), `src/gateway/extensions/heartbeat/src/index.ts` (honor check-backs in scheduler), `.env.example` (add quiet hours vars)
**Depends on:** 11, 12
**Validates:** Agent calls `heartbeat_schedule` with "2 hours" → state.json has a pending checkback. Scheduler fires a tick at that time. "Heartbeat status" in conversation returns current state. Ticks don't fire during quiet hours.

---
