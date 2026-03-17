---
status: draft
date: 2026-03-16
author: kuba
---

# New Session — Start a fresh conversation without restarting the gateway

## Problem

The gateway currently loads a single Pi SDK session on startup via `SessionManager.continueRecent()` and rides it for the entire process lifetime. There is no way to start a fresh conversation — you have to restart the gateway. This makes Lucy feel like a single unending chat thread rather than an assistant you can start new topics with.

## Proposed Solution

Add a "New Session" capability at two layers:

1. **Runtime** — `AgentRuntime` gets a `newSession()` method that creates a fresh `AgentSession` via the Pi SDK's `SessionManager`, replacing the current one in-place. The old session is automatically preserved on disk by Pi SDK (no extra work needed).

2. **Gateway** — A new `POST /api/session/new` endpoint that calls `runtime.newSession()` and returns the new `SessionInfo`.

3. **WebUI** — A button in the `SessionBar` (or near it) that calls the endpoint, clears local message state, and refreshes the session info display. The user sees an empty chat ready to go.

The default behavior on gateway startup stays the same — continue the most recent session. "New session" is an explicit user action.

## Key Cases

- User clicks "New Session" → chat clears, session bar shows fresh stats (0 messages, $0 cost), new session ID
- User clicks "New Session" while a message is streaming → stream should be aborted/completed before creating new session (or button disabled during streaming)
- Gateway restarts after a new session was created → Pi SDK loads the latest session (the new one), previous sessions remain on disk
- API key protected — `POST /api/session/new` respects existing `LUCY_API_KEY` auth middleware

## Out of Scope

- Session history / listing / switching between past sessions
- Per-user sessions or multi-tenant support
- Naming sessions
- Telegram/WhatsApp triggers for new session (UI only for now)

## Open Questions

- Does Pi SDK's `createAgentSession` work cleanly when called a second time in the same process, or does it expect to be called once? Need to verify.
- Should we show a confirmation dialog before clearing the session, or just do it?

## References

- `src/runtime/core/src/runtime/agent-runtime.ts` — current single-session lifecycle
- `src/gateway/core/src/routes/session.ts` — existing `GET /api/session` route
- `src/gateway/extensions/webui/src/components/SessionBar.tsx` — session display component
- `src/gateway/extensions/webui/src/hooks/useAgentStream.ts` — chat state management
