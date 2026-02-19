---
status: accepted
date: 2026-02-18
decision-makers: "Kuba Szwajka"
---

# Add cancel generation to stop in-flight AI responses

## Context and Problem Statement

When a user accidentally hits Enter in the chat input, a message is sent and the AI begins streaming a response. There is currently no way to cancel this — the user must wait for the full response to complete, wasting time and tokens.

The frontend uses `@ai-sdk/react`'s `useChat` hook, which exposes a `stop()` function, but it is not destructured or wired to any UI control. The backend streams responses via SSE through `DefaultChatTransport`.

## Decision

Add a stop button that replaces the send button while the AI is streaming. When clicked:

1. Call `useChat`'s `stop()` to abort the SSE stream.
2. **Discard only the partial assistant response** — remove it from the conversation, but keep the user's message so it can be edited or resent.
3. Return the UI to the idle/ready-to-send state.

### Non-goals

- No Escape key shortcut (stop button only).
- No "keep partial response" mode.
- No edit/retry of the cancelled user message.
- No backend-side abort signaling beyond SSE connection close.

## Consequences

- Good, because users can instantly recover from accidental sends without waiting.
- Good, because it saves tokens on unwanted generations.
- Good, because it uses the existing `stop()` mechanism from `@ai-sdk/react` — no custom abort logic needed.
- Good, because the user's original message is preserved, allowing them to edit and resend without retyping.

## Implementation Plan

- **Affected paths**:
  - `desktop/renderer/src/hooks/useAgentChat.ts` — destructure `stop` from `useChat`, expose it + wrap with message cleanup
  - `desktop/renderer/src/components/chat/ChatInput.tsx` — swap send button for stop button when `isLoading` is true
  - `desktop/renderer/src/components/chat/ChatContainer.tsx` — pass `stop` through to `ChatInput`

- **Dependencies**: None — `stop()` is already available from `@ai-sdk/react`.

- **Patterns to follow**:
  - `useSessionChat` already exposes `isLoading` (derived from `status === "streaming" || status === "submitted"`) — use this to toggle button state.
  - The hook already exposes `setMessages` — use it to remove the discarded partial response after `stop()`.

- **Patterns to avoid**:
  - Do NOT implement a custom `AbortController` — use the SDK's built-in mechanism.
  - Do NOT add keyboard shortcuts (keep scope minimal).

### Steps

1. In `useAgentChat.ts`: destructure `stop` from `useChat`. Create a `cancelGeneration` function that calls `stop()`, then removes only the last assistant message via `setMessages` (keep the user message).
2. In `useAgentChat.ts`: export `cancelGeneration` from the hook's return value.
3. In `ChatContainer.tsx`: pass `cancelGeneration` and `isLoading` down to `ChatInput`.
4. In `ChatInput.tsx`: when `isLoading` is true, render a stop button (square icon) in place of the send button. On click, call `cancelGeneration`.

### Verification

- [ ] While AI is streaming, the send button is replaced by a stop button.
- [ ] Clicking the stop button immediately halts the stream.
- [ ] After clicking stop, the partial assistant response is removed but the user's message remains in the conversation.
- [ ] The chat input returns to the ready state and accepts new input.
- [ ] When not streaming, the normal send button is shown (no stop button visible).
