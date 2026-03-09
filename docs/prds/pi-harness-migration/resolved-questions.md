# Resolved Questions: Pi Harness Migration

These were originally open questions in the PRD. Investigation of the Pi SDK docs, Lucy's codebase, and existing PRDs resolved them all.

## Pi SDK maturity for embedding

**Resolved: Production-ready for headless/server use.**

Key evidence:
- `SessionManager.inMemory()` — no filesystem dependency required
- `SettingsManager.inMemory(settings?)` — no config file I/O
- Custom `ResourceLoader` interface — replaces all discovery with explicit config
- Event subscription via `session.subscribe()` — pure callbacks, no TUI coupling
- `session.prompt()` returns a promise — standard async
- See Pi's `examples/sdk/12-full-control.ts` — zero filesystem, zero TUI, zero auto-discovery

## Session storage location

**Resolved: `SessionManager` supports custom directories and in-memory mode.**

Options: `SessionManager.inMemory()`, `SessionManager.create(cwd, customDir)`, or custom dir per agent. Lucy's single-agent-channel model (one conversation per deployment) maps directly to one `SessionManager` per runtime instance.

## Model provider bridging

**Resolved: Both use Vercel AI SDK — no bridge needed.**

Lucy's `ModelProvider.getLanguageModel()` returns a Vercel AI SDK `LanguageModel`. Pi's `createAgentSession({ model })` accepts one. Zero translation layer. However, we choose to adopt Pi's `AuthStorage` + `ModelRegistry` entirely for multi-provider support.

## Streaming protocol

**Resolved: Pi's event system maps cleanly to SSE.**

Pi's `session.subscribe()` emits typed push events (`text_delta`, `tool_execution_*`, `agent_end`). SSE is push-based. Direct mapping, no double-buffering:
- `message_update.text_delta` → SSE text chunk
- `tool_execution_start/end` → SSE tool events
- `agent_end` → SSE done

Lucy's `POST /chat` currently returns JSON (non-streaming). `await session.prompt(message)` blocks until completion — even simpler.

## Multi-agent / multi-session

**Resolved: Not a problem.**

Single-agent-channel PRD (completed) collapsed Lucy to one agent per deployment. One `AgentSession` per runtime instance is exactly Pi's model. For future multi-user: each user gets their own `createAgentSession()` call.

## Migration path for existing sessions

**Resolved: Start fresh.**

Lucy's flat `items.jsonl` has no equivalent of Pi's tree structure. But this doesn't matter:
1. Conversations are ephemeral — value lives in memory observer's `observations.jsonl` and `memory.md`
2. Memory data is independent of session format and survives migration
3. `SessionManager.inMemory()` means Pi doesn't need to persist sessions at all
