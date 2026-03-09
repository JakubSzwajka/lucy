---
status: done
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Master Prompt File (`prompt.md`)

## Problem

The agent's system prompt is currently assembled entirely in code — spread across `context.ts` (base resolution), plugin hooks (memory), environment context service, and identity provider. There's no single, editable file that defines the agent's core personality, instructions, and behavioral guidelines.

This makes it hard to iterate on the prompt without touching code. OpenClaw solves this with bootstrap files (`SOUL.md`, `IDENTITY.md`, etc.) that get injected into every run. We need a similar but simpler approach: a single `prompt.md` file that serves as the master system prompt, version-controlled and Docker-mountable.

## Proposed Solution

Introduce a `prompt.md` file as the **sole base system prompt**. The runtime reads this file once at init and uses its content as the foundation of the system message. Existing layers (environment context, identity, plugin sections, compaction summary) continue appending on top.

**Key design decisions:**

- **Separate from data dir.** The data dir (`AGENTS_DATA_DIR`) is storage — conversation items, agent state, memory. The prompt file is configuration/identity, mounted as its own explicit volume.
- **Read once at init.** The file is loaded during `runtime.init()` and cached in memory. Changing the prompt requires a restart.
- **Replaces agent-level system prompt.** The existing `agent.systemPrompt` / `agentConfig.systemPromptId` chain is removed. `prompt.md` is the single source for the base system prompt. Future phases will add more files/sections, but this is the baseline.

### Prompt assembly order (after this change)

```
1. prompt.md content              ← NEW: file-based master prompt (replaces agent/config prompts)
2. Environment context            (existing)
3. Identity document              (existing)
4. Plugin sections (memory, etc.) (existing)
5. Compaction summary             (existing)
```

### Docker mount

```yaml
# docker-compose.yml
services:
  gateway:
    volumes:
      - ./prompt.md:/app/prompt.md:ro    # ← explicit, separate from data
      - ~/.agents-data:/data
```

## Key Cases

- **File exists**: Read `prompt.md` at init, use as base system prompt for all conversations.
- **File missing**: Runtime starts but logs a warning. System prompt assembly begins from an empty base (other layers still append).
- **File updated**: Requires container/process restart to pick up changes.
- **Encoding**: UTF-8 markdown. No frontmatter processing — entire file content is the prompt.

## Out of Scope

- **Template variables / interpolation** (`{{date}}`, `{{tools}}`) — future phase. For now the file is static text.
- **Multiple bootstrap files** (OpenClaw-style `SOUL.md`, `TOOLS.md`, `AGENTS.md` etc.) — future phase. Start with one file.
- **Hot-reload / file watching** — restart is sufficient for now.
- **UI editor for prompt** — edit the file directly.
- **Per-agent prompt files** — one global prompt for now.
- **Agent-level system prompt overrides** — removed entirely, not fallback.

## Decisions

- **File path**: Convention-based — always `/app/prompt.md` (mounted volume). No env var needed.
- **Existing schema fields**: Remove `systemPrompt` from Agent type and `systemPromptId` from AgentConfig. Clean up `resolveSystemPrompt()` and related ConfigStore methods.

## References

- [OpenClaw System Prompt Docs](https://docs.openclaw.ai/concepts/system-prompt) — inspiration for file-based prompt injection, section structure, and bootstrap file pattern
- `agents-runtime/src/runtime/context.ts` — current system prompt assembly
- `agents-runtime/src/plugins/lifecycle.ts` — plugin context preparation
- `docker-compose.yml` — current volume mounts
- `Dockerfile` — conditional config copy pattern (`lucy.config.jso[n]`)
