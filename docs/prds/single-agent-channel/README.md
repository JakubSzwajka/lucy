---
status: draft
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Single-Agent Chat Channel

## Problem

The current runtime models sessions as independent, isolated conversations — each `POST /sessions` creates a new agent with its own history. This multi-session design was inherited from the legacy multi-user Next.js app but doesn't match the deployment model: one Lucy runtime instance **is** one agent.

In practice, a human always wants to talk to "the agent" — not create throwaway sessions. WhatsApp users already experience this (the plugin auto-creates sessions), but the abstraction leaks: the phone-to-session mapping is a workaround for a model that shouldn't require it.

The current model also has no compaction — conversation history grows unboundedly, eventually exceeding LLM context limits with no graceful degradation.

## Proposed Solution

Collapse the multi-session model into a **single fixed chat channel** per runtime deployment. The agent is the deployment unit. The chat channel is its one persistent conversation thread.

### Core changes

1. **Remove session creation** — the chat channel exists at boot. No `POST /sessions` needed. `POST /chat` sends a message to the agent directly.

2. **One agent, one history** — a single items log for the chat channel. All transports (web UI, WhatsApp, future integrations) feed into this one thread.

3. **Sliding window + compaction** — keep the last N messages in full. Older messages get summarized into a compacted context block that's prepended to the conversation. This prevents unbounded growth while preserving long-term context.

4. **Transport-agnostic** — plugins (WhatsApp, etc.) are transport adapters. They inject source metadata (e.g., "message from WhatsApp, phone +XXX") but don't own separate channels. The agent sees one unified conversation.

5. **Agent config at deployment level** — model, system prompt, tools, and config come from `lucy.config.json`, not per-session options.

### What the API looks like after

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/chat` | Send message to the agent |
| `GET` | `/chat/history` | Get conversation history (compacted + recent) |
| `GET` | `/health` | Health check |

### Compaction strategy

```
[compacted summary of older messages]
[message N-window]
[message N-window+1]
...
[message N]
[new user message]
```

- Window size configurable via `lucy.config.json` (default: last 50 messages)
- Compaction runs after each exchange when history exceeds window
- Compacted summary is an LLM-generated condensation of the oldest messages being evicted
- Summary is stored as a special item type and prepended to context on each turn

## Key Scenarios

1. **First message** — agent boots with empty history. User sends message via `POST /chat`. Agent responds. No session creation needed.

2. **Long conversation** — after 50+ exchanges, compaction kicks in. Oldest messages are summarized. Agent still has full recent context + compressed history.

3. **WhatsApp message** — plugin receives webhook, extracts text, calls `POST /chat` internally (or `runtime.sendMessage()`). Response sent back via WhatsApp API. No phone-to-session mapping needed.

4. **Multiple transports simultaneously** — web UI and WhatsApp both send messages. They interleave in one thread. Agent can distinguish source via metadata in the message if needed.

5. **Restart/reboot** — agent restarts, loads existing history from disk. Conversation continues where it left off.

## Out of Scope

- **Events channel** — a second channel for webhooks/triggers/scheduled events. Will be a separate PRD.
- **Multi-agent orchestration** — multiple agents collaborating. Different concern entirely.
- **Memory Observer** — the extraction/synthesis pipeline (existing PRD). Compaction here is simpler — just summarization of old messages, not knowledge extraction.
- **Per-user separation within chat** — if multiple humans talk to the same agent, their messages interleave. Separation by user identity is a future concern.

## Technical Notes

### What gets removed

- `SessionStore` port and `FileSessionStore` adapter
- `POST /sessions`, `GET /sessions`, `GET /sessions/{id}` routes
- `createSession()`, `getSession()`, `listSessions()` from `AgentRuntime`
- `sessionId` parameter from `sendMessage()` and chat routes
- WhatsApp `PhoneSessionStore` (phone-to-session mapping)
- `sessions/` directory in `.agents-data/`

### What gets added

- `ChatChannel` — manages the single conversation (items log, compaction)
- `CompactionService` — summarizes old messages when window is exceeded
- Config section in `lucy.config.json` for window size and compaction settings

### What gets modified

- `AgentRuntime` — boots with a single agent + chat channel instead of session factory
- `POST /chat` — no longer requires `sessionId`
- WhatsApp plugin — removes session mapping, calls runtime directly
- WebUI — no session list/creation, goes straight to chat
- File storage layout simplifies: one agent, one items log

### Storage layout after

```
.agents-data/
  agent.json              # single agent state
  items.jsonl             # conversation history (append-only)
  compaction.json         # current compacted summary
  config/
    agent-config.json     # agent configuration
    system-prompt.json    # system prompt (if custom)
```
