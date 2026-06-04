---
status: draft
date: 2026-03-20
author: "Kuba + Claude"
---

# Subagent Architecture — Gateway as Deterministic Router

## Problem

Lucy's runtime is a **singleton `AgentSession`** initialized once at boot with a fixed model, prompt, and config. Every trigger — webui, Telegram, future webhooks/cron — funnels through the same session with the same personality and context. There is no way to programmatically select a different agent configuration based on the trigger source or circumstance.

This blocks multi-role behavior (companion vs architect vs journal), per-channel specialization (Telegram gets terse mode, webui gets full mode), and system-initiated tasks that need different prompts/tools than interactive chat.

The `before_agent_start` hook can vary the system prompt per-turn, but it only sees the user message — no structured metadata about *who* is calling or *why*. Making it do agent selection would be non-deterministic (LLM-based classification) and fragile.

## Proposed Solution

Replace the singleton `AgentRuntime` with a **subagent spawner** using the [pi-subagents](https://github.com/nicobailon/pi-subagents) extension. Each agent role is a `.pi/agents/*.md` file (YAML frontmatter + system prompt body). The gateway becomes the **deterministic router**: it receives a trigger, selects the agent config, looks up or creates a session file, and spawns the subagent process.

There is no "main agent" that talks to users. Every conversation is a subagent with its own session, prompt, model, and tools. The gateway owns the routing logic; the `.pi/agents/` directory owns the agent configurations.

Anamnesis and other `.pi/extensions/` continue working — each subagent subprocess discovers them from the same cwd. Context assembly becomes agent-aware: different agents load different experience sections based on their role.

### Before / After

```
BEFORE:
  trigger → gateway → singleton AgentRuntime → one Pi session → one prompt

AFTER:
  trigger → gateway (picks agent + session) → spawn pi subprocess → agent-specific session → agent-specific prompt
```

## Key Cases

- **WebUI chat**: Gateway spawns `lucy` (default companion agent) with SSE streaming. Session persists across messages — same session file reused on each request.
- **Telegram message**: Gateway spawns `lucy` (or a terse variant) via non-streaming `sendMessage`. Session tracked by Telegram chat ID.
- **System trigger (webhook/cron)**: Gateway spawns a task-specific agent (e.g. `morning-brief`, `pr-reviewer`) with a fresh session per invocation.
- **Agent-aware context assembly**: Anamnesis `assembleContext()` reads the agent name (via env var or config) and loads only relevant experience sections. Companion gets relationship + disposition + memories; architect gets knowledge graph + tensions.
- **Session continuity**: Each conversation maps to a session file. Subsequent messages to the same conversation resume the session — full history, compaction, everything works as before.
- **Cold start / session reload**: Each message spawns a `pi` subprocess that loads the session file from disk. Latency is session-file-read + extension-init, not LLM inference.

## Architecture

### Agent definitions

```yaml
# .pi/agents/lucy.md
---
name: lucy
description: Default companion — conversational, curious, honest
model: openrouter/anthropic/claude-sonnet-4
thinking: medium
tools: read, write, grep, find, bash, knowledge_search, knowledge_create
---

[PROMPT.md content moves here — personality, values, anti-patterns, entity architecture]
```

### Gateway routing

```
POST /api/chat/stream { message, agent?, sessionId? }
  → resolve agent config (default: "lucy")
  → resolve session file (lookup by sessionId or create new)
  → spawn: pi --mode json -p --session {file} --models {model} --tools {tools} "{message}"
  → pipe stdout as SSE events
  → store session file reference for next message
```

### Session management

```
.agents/pi/sessions/
  ├── webui-{uuid}.jsonl       # WebUI conversation
  ├── telegram-{chatId}.jsonl  # Telegram conversation
  └── task-{triggerId}.jsonl   # One-shot system task
```

Gateway maintains a mapping: `(channel, conversationId) → sessionFile path`. This can be an in-memory map persisted to a JSON file, or a simple SQLite/JSON store.

### Extension compatibility

Each `pi` subprocess:
1. Starts in the project cwd
2. Discovers `.pi/extensions/` (anamnesis, environment)
3. Fires `before_agent_start` → anamnesis loads context from `.agents/experience/`
4. Fires `session_before_compact` → anamnesis runs reflection

Extensions work identically to today because they're discovered per-process from the filesystem.

### Agent-aware context assembly

Anamnesis `assembleContext()` gains a section filter:

```typescript
const agentName = process.env.PI_AGENT_NAME ?? "lucy";

const AGENT_SECTIONS: Record<string, string[]> = {
  lucy: ["entity", "knowledge", "dispositions", "relations", "memories",
         "tensions", "predictions", "questions", "journal", "arcs"],
  architect: ["entity", "knowledge", "tensions", "memories"],
  journal: ["entity", "dispositions", "memories", "journal", "arcs"],
};

const sections = AGENT_SECTIONS[agentName] ?? AGENT_SECTIONS.lucy;
```

Each section load wrapped in `if (sections.includes("name"))` guard.

## Out of Scope

- **Multi-agent orchestration / chains**: Chaining agents (scout → planner → worker) is enabled by this architecture but not built here.
- **Dynamic agent creation at runtime**: Agents are `.md` files managed by the developer. No API for creating agents on the fly.
- **Model switching mid-session**: The model is set per-agent config. Changing models requires a new session.
- **WebUI agent picker UI**: The webui will use the default agent. A dropdown to select agents is a future enhancement.
- **Cron/webhook trigger system**: ADR 0006 designs this. This PRD builds the runtime foundation it needs but doesn't implement trigger scheduling.

## Open Questions

1. ~~**Streaming from subprocess**~~ **RESOLVED**: `pi --mode json -p` streams one JSON object per line in real-time. Event types include `agent_start`, `turn_start`, `message_start`, `message_update` (with `text_delta`/`thinking_delta`), `message_end`, `turn_end`, `agent_end`. Maps directly to existing `StreamEvent` types. Extensions (anamnesis) fire correctly in subprocess. Option A confirmed.

2. **Cold start latency**: Each message spawns a new process (tsx + Pi SDK init + extension load + session read). Acceptable for Telegram (async), potentially noticeable for webui.
   - **Proposed**: Measure first. If >2s, consider process pool or hybrid (in-process for webui, subprocess for triggers).

3. **Concurrent reflection conflicts**: Two subagents hitting compaction simultaneously write to the same `.agents/experience/` files.
   - **Proposed**: File-level locking via `proper-lockfile` in anamnesis write paths. Contention is rare; the guard is cheap.

4. **Session file lifecycle**: When should old sessions be cleaned up?
   - **Proposed**: Manual cleanup initially. TTL-based cleanup (30 days untouched) as follow-up.

## References

- [pi-subagents extension](https://github.com/nicobailon/pi-subagents) — agent definition format, executor, slash commands
- [ADR 0006: System-initiated triggers](docs/decisions/0006-add-system-initiated-triggers.md) — webhook/cron design this enables
- Current runtime: `src/runtime/core/src/runtime/agent-runtime.ts`
- Current gateway routes: `src/gateway/core/src/routes/chat.ts`
- Current anamnesis context: `.pi/extensions/anamnesis/hooks/context.ts`
- Current system prompt: `PROMPT.md`
