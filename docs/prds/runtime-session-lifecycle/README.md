---
status: draft
date: 2026-03-07
author: kuba
gh-issue: ""
---

# Extract session lifecycle into agents-runtime

## Problem

Session creation, retrieval, and listing are orchestration concerns that currently live inside `agents-gateway-http` route handlers. The gateway directly manipulates the filesystem — generating UUIDs, writing agent configs, system prompts, agent state, and session files — bypassing the runtime's own port interfaces.

This means any new consumer (CLI, desktop app, test harness) must duplicate all of that lifecycle code. The runtime's ports (`AgentStore`, `ConfigStore`, `SessionStore`) lack `create` methods, so there's no way to use the runtime without also reimplementing session bootstrap logic.

## Proposed Solution

Extend `agents-runtime` with session lifecycle operations so it becomes the single orchestration layer for all consumers. Add `create` methods to the relevant ports, then expose high-level operations (create session, get session, list sessions, send message) either on `AgentRuntime` or a sibling `SessionManager` class. The gateway becomes a thin HTTP shell: parse request, call runtime, format response.

After this change, building an `agents-cli` package requires zero duplicated orchestration — it imports the same runtime methods and only handles terminal I/O.

## Key Cases

- **Create session with defaults** — no config provided; runtime creates a default agent config, agent, and session
- **Create session with explicit config** — caller provides `agentConfigId`, `modelId`, and/or `systemPrompt`; runtime wires them together
- **Get session status** — return session metadata + agent state (status, turnCount, result)
- **List sessions** — return all sessions sorted by recency, with summary agent info
- **Get session items** — return conversation history for a session's agent
- **Send message** — append user message to items, call `runtime.run()`, return result (consolidates what `POST /chat` does today)

## Out of Scope

- Streaming support in the consolidated `sendMessage` (keep non-streaming first; streaming can be added later)
- Authentication / multi-user scoping (the runtime is currently single-user / file-based)
- New CLI package itself (this PRD just makes it possible)
- Changes to the legacy Next.js app
- New storage adapters (Postgres, SQLite) — file adapters are sufficient

## Open Questions

- Should lifecycle methods live on `AgentRuntime` itself or on a separate `SessionManager` that composes it? `AgentRuntime` already holds all deps, so adding methods there is simpler, but it may violate single-responsibility.
- Should `ConfigStore` get a `createAgentConfig()` method, or should the runtime handle default config creation internally without exposing it as a port operation?
- The current `POST /sessions` creates a default `AgentConfigWithTools` inline. Should there be a concept of a "default config" that the runtime ships, or should the caller always provide one?

## References

- `agents-runtime/src/ports.ts` — current port interfaces (read-only, no create methods)
- `agents-runtime/src/runtime.ts` — `AgentRuntime` class (execution only, no lifecycle)
- `agents-gateway-http/src/routes/sessions.ts` — session lifecycle logic that needs extracting
- `agents-gateway-http/src/routes/chat.ts` — `sendMessage` pattern (already clean)
- `docs/prds/agents-webui/` — related PRD for web UI that will also consume the runtime
