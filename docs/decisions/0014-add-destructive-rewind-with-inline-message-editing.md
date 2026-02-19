---
status: proposed
date: 2026-02-19
decision-makers: "Kuba Szwajka"
---

# Add destructive rewind with inline message editing

## Context and Problem Statement

Once a user sends a message in a session, there is no way to edit it or redo the conversation from that point. If the user makes a typo, asks the wrong question, or wants to try a different prompt, they must start a new session or continue with the existing (unwanted) conversation history.

ADR-0003 added cancel-generation (stop streaming + discard partial response), but that only works during active streaming and keeps the user message intact. There is no mechanism to go back to an earlier point in the conversation.

The backend already has `ItemRepository.delete(id)` but no API route exposes it, and there is no bulk-delete or rewind operation.

## Decision

Add a **destructive rewind** feature: the user can inline-edit any of their sent messages, and upon submitting the edit, all items that came after that message are deleted and a new AI generation starts from that point.

### How it works

1. Each user message bubble shows a **pencil icon** (next to the existing copy button).
2. Clicking the pencil makes the message content editable via `contentEditable` — it looks like the same bubble, just editable.
3. The user edits the text and presses **Enter** to submit (Shift+Enter for newline).
4. The frontend **optimistically removes** all messages below the edited one.
5. A request is sent to `POST /api/sessions/[id]/rewind` with `{ itemId, newContent }`.
6. The backend, in a **single transaction**: deletes all items with `createdAt` greater than the target item's `createdAt` within the same agent, then updates the target item's content.
7. After the transaction commits, the backend triggers a new chat generation for that agent (same as a normal chat request).
8. The frontend streams the new response via the existing SSE mechanism.

### Scope

- Works on **any user message** in the session, not just the last one.
- Works regardless of which agent's conversation is being viewed (root or sub-agent) — the rewind operates on the agent that owns the target item.
- Orphaned sub-agent items (from delegations that happened after the rewind point) are left in the database but become unreachable. This is acceptable — they cause no harm and can be cleaned up later if needed.

### Non-goals

- No fork/branch model — history is destroyed, not preserved.
- No "retry without editing" (resend same message). Can be added later.
- No undo of the rewind itself.
- No cleanup of orphaned sub-agent items in this phase.
- No Escape-to-cancel-edit (clicking outside or pressing Escape just cancels the edit and restores original text).

## Consequences

- Good, because users can fix mistakes and explore alternative prompts without starting a new session.
- Good, because it reuses the existing chat generation flow — the rewind endpoint only handles the delete+update, then delegates to the normal streaming path.
- Good, because the destructive approach is simple — no branching, no version tracking, no complex UI for navigating history.
- Bad, because edits are irreversible — the old conversation is permanently lost.
- Bad, because sub-agent items orphaned by a rewind will accumulate in the database. Acceptable for now; a cleanup job can be added later.
- Neutral, because the optimistic UI removal means the frontend state and backend state can briefly diverge if the rewind request fails. This is acceptable per user's stated preference.

## Implementation Plan

- **Affected paths**:
  - `backend/src/app/api/sessions/[id]/rewind/route.ts` — new POST endpoint
  - `backend/src/lib/services/item/item.repository.ts` — add `deleteAfter(agentId, createdAt)` method
  - `backend/src/lib/services/item/item.service.ts` — add `rewindToItem(itemId, newContent, userId)` method
  - `desktop/renderer/src/components/chat/MessageBubble.tsx` (or equivalent message component) — add pencil button, contentEditable state
  - `desktop/renderer/src/hooks/useAgentChat.ts` — add `rewindToMessage(itemId, newContent)` function
  - `desktop/renderer/src/lib/api/client.ts` — add `rewindSession(sessionId, itemId, newContent)` API call

- **Dependencies**: None — uses existing DB operations, existing SSE streaming, existing contentEditable browser API.

- **Patterns to follow**:
  - Backend endpoint follows the same auth pattern as other session routes: `requireAuth(request)` → extract userId → validate session ownership.
  - `ItemRepository` already has `delete(id)` — the new `deleteAfter` method follows the same style but with a range condition.
  - Frontend optimistic updates follow the same pattern as ADR-0003's cancel-generation (manipulate messages via `setMessages` before backend confirms).
  - The pencil button should sit next to the copy button, matching existing icon button styling.

- **Patterns to avoid**:
  - Do NOT create a custom streaming mechanism — after the rewind transaction, trigger generation through the existing chat endpoint/flow.
  - Do NOT attempt to clean up orphaned sub-agent items in the rewind transaction — keep the transaction simple.
  - Do NOT use a textarea for editing — use `contentEditable` on the existing message element to preserve the "editing in place" feel.

### Steps

**Backend:**

1. Add `deleteAfter(agentId: string, afterTimestamp: Date): Promise<number>` to `ItemRepository` — deletes all items for that agent where `createdAt > afterTimestamp`. Returns count of deleted rows.
2. Add `rewindToItem(itemId: string, newContent: string, userId: string)` to `ItemService` — in a single transaction: look up the item, verify it's a user message and belongs to the user's session, call `deleteAfter`, then update the item's content. Returns the updated item.
3. Create `POST /api/sessions/[id]/rewind` route — calls `requireAuth`, validates request body (`{ itemId, newContent }`), calls `ItemService.rewindToItem()`, then calls `ChatService` to trigger a new generation for the agent. Streams the response back via SSE (same as the chat endpoint).

**Frontend:**

4. Add `rewindSession(sessionId, itemId, newContent)` to the API client — POST to the new endpoint, returns an SSE stream.
5. In the message component: add a pencil icon button next to the copy button (visible on hover, only on user messages). Clicking it sets a local `isEditing` state.
6. When `isEditing`: render the message content in a `contentEditable` div. Enter submits, Shift+Enter adds newline, Escape/click-outside cancels.
7. On submit: optimistically remove all messages after this one via `setMessages`, call `rewindToMessage(itemId, newContent)` on the hook, which calls the API client and feeds the SSE stream into the existing message handling.
8. In `useAgentChat.ts`: add `rewindToMessage` function that truncates local messages and initiates the rewind+stream request.

### Verification

- [ ] Pencil icon appears on hover for user messages (not assistant messages, not tool calls).
- [ ] Clicking pencil makes the message editable in-place with `contentEditable`.
- [ ] Pressing Enter submits the edit; Shift+Enter inserts a newline.
- [ ] Pressing Escape cancels the edit and restores original content.
- [ ] After submitting an edit, all messages below the edited one are removed from the UI immediately (optimistic).
- [ ] The backend deletes all items after the target item within the same agent in a single transaction.
- [ ] The backend updates the target item's content to the new text.
- [ ] A new AI generation streams in after the rewind.
- [ ] Editing a message mid-conversation (not the last message) correctly removes multiple subsequent messages.
- [ ] Orphaned sub-agent items from post-rewind delegations remain in DB but don't appear in the UI.
- [ ] The rewind endpoint rejects requests for items that don't belong to the user's session.

## Alternatives Considered

- **Fork/branch model** (ChatGPT-style): Preserve old conversation branches and let the user navigate between them. Rejected because it adds significant complexity (branch tracking, UI for branch navigation, storage growth) for a feature that can be added later if needed. The destructive approach covers the core need now.
- **Retry-only (no editing)**: Just re-send the same message without allowing edits. Rejected because editing is the primary use case — if you want to retry the same message, you can "edit" it without changing anything.

## More Information

- Related: ADR-0003 (cancel generation) — similar pattern of discarding AI responses, but this ADR is broader (rewinds to any point, edits the message).
- Revisit trigger: If users frequently regret rewinds, consider adding an undo buffer or switching to the fork model.
