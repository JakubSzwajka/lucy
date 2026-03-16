---
status: implemented
date: 2025-07-11
decision-makers: "Kuba Szwajka"
---

# Add abort interaction to stop in-flight agent processing

## Context and Problem Statement

When a user sends a message and the agent is processing, there was no way to abort the interaction from the product surface. Users had to wait for the full response.

The runtime already exposed an `abort()` RPC method, but it was not wired through the gateway API or frontend layers.

## Decision

Wire abort through all layers so users can stop in-flight interactions from the UI:

1. Add a gateway abort endpoint that calls `runtime.abort()`.
2. Add frontend API support via `abortGeneration()` and `AbortSignal` support on streaming requests.
3. Add streaming-hook cancellation plumbing with `AbortController` and a `cancel()` callback.
4. Show a stop button in the input while streaming.

### Non-goals

- No Escape key shortcut.
- No "keep partial response" mode.

## Consequences

- Good, because abort is now available end-to-end across gateway, client, hook, and UI.
- Good, because users can stop unwanted generations and save tokens.
- Good, because the user message remains in history after abort.

## Implementation

- **Gateway route**
  - `POST /api/chat/abort` calls `runtime.abort()`.
  - Runtime sends RPC `{ type: "abort" }` to pi-bridge.

- **Frontend API client**
  - Add `abortGeneration()`.
  - Add `AbortSignal` support on `sendMessageStream`.

- **Streaming hook (`useAgentStream`)**
  - Keep an `AbortController` in a ref for active streams.
  - Expose `cancel()` callback.
  - Handle `AbortError` safely in stream error handling.

- **Chat input UI**
  - Render a conditional stop button while streaming.
  - Use Square icon and destructive button variant.

## Verification

- [ ] `POST /api/chat/abort` is documented and calls runtime abort behavior.
- [ ] Frontend can cancel an active stream via API client + hook callback.
- [ ] Stop button appears only while streaming and triggers cancellation.
- [ ] User message remains in history after abort.
- [ ] No Escape shortcut and no partial-response preservation mode are introduced.
