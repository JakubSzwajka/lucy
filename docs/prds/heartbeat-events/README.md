---
status: draft
date: 2026-03-16
author: kuba
---

# Heartbeat & Event-Driven Agent Activation

## Problem

Lucy's agent only activates when a user sends a message via HTTP. There is no mechanism for the agent to wake up autonomously — no periodic self-reflection, no reaction to external signals like time-of-day changes, environment shifts, or incoming data from integrations. This makes the agent purely reactive: it can only think when spoken to.

Additionally, the current prompt system is a single monolithic `PROMPT.md` file loaded once at pi-bridge startup. There's no way to inject different instructions based on context — a heartbeat tick needs different framing than a user conversation, and the prompt can't adapt to that today.

## Proposed Solution

Introduce an **event-driven interface** on the runtime module. Instead of only accepting user messages, the runtime accepts typed **events** — where a user message is just one event type. A new **heartbeat scheduler** in the gateway layer periodically emits tick events, and the runtime processes them with context-appropriate instructions.

The prompt system gets restructured from one static file into **composable prompt sections** that can be assembled per-event-type. A heartbeat event carries different system instructions than a conversation event — e.g. "review your memory," "check pending tasks," or "reflect on recent context."

When done: the agent can wake up on a timer, process a heartbeat with tailored instructions, and the same event interface is ready for future event types (webhooks, environment signals, integration triggers).

## Key Cases

- **Periodic heartbeat**: Gateway emits a tick event on a configurable interval (e.g. every 30 min). Runtime receives it, runs the agent with heartbeat-specific prompt sections, produces output (internal reflection, memory updates, or a proactive message to user).
- **Environment events**: Generic event shape like `{type: "environment", source: "geo", payload: {event: "user-got-home"}}` — runtime dispatches to agent with appropriate context injection. Not implemented in this PRD, but the interface must support it.
- **Event-specific prompt composition**: Each event type maps to a prompt assembly recipe — which sections to include, what system instructions to prepend. A heartbeat gets "reflect on memory + check tasks," a user message gets the full conversational prompt.
- **Prompt restructuring**: Break `PROMPT.md` into named sections (personality, capabilities, memory context, task context, etc.) that can be composed programmatically per event type.
- **Heartbeat output routing**: Heartbeat results may not always go to the user. Some produce internal state changes (memory writes), some produce proactive messages. The gateway needs to decide what to surface.
- **Heartbeat suppression during active conversation**: If the user is actively chatting, skip or defer heartbeat ticks to avoid contention on the single-session pi-bridge.

## Out of Scope

- Specific environment event source implementations (geofencing, calendar, etc.) — only the generic event interface
- Multi-session support (pi-bridge is still single-session; heartbeat must share it)
- Persistent event queue or replay — events are fire-and-forget for now
- UI for configuring heartbeat schedules — hardcoded or env-var config only
- Changes to pi-bridge protocol itself — we work within the existing `{type: "prompt", message}` RPC

## Open Questions

- **Pi SDK contention**: Pi-bridge handles one request at a time. How do we queue a heartbeat behind an active conversation? Simple mutex + skip-if-busy, or proper queue?
- **Heartbeat prompt format**: Should heartbeat messages arrive as a special "system" message, or as a synthetic "user" message with a prefix like `[heartbeat]`? Pi SDK may constrain this.
- **Output disposition**: How does the agent signal "this is internal reflection, don't show the user" vs. "send this to the user proactively"? Tool-based? Structured output? Convention in response text?
- **Prompt section storage**: Individual `.md` files in a `prompts/` directory? Or a single structured file with frontmatter-delimited sections?

## References

- Current runtime: `src/runtime/core/src/runtime/agent-runtime.ts` — `sendMessageStreaming()` is the only activation path
- Current prompt: `PROMPT.md` (repo root) — monolithic, loaded once at bridge startup
- Pi-bridge protocol: `src/runtime/core/src/runtime/socket-client.ts` — JSONL over Unix socket
- Dynamic context injection: `.pi/extensions/prompt-context.ts` — existing `before_agent_start` hook (Pi SDK level)
- Research on context engineering: `docs/research/2026-03-14-context-memory-harness.md`
