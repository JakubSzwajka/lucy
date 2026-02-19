---
status: implemented
date: 2026-02-19
decision-makers: "kuba"
---

# Persist incomplete plans across page refreshes, hide completed plans after refresh

## Context and Problem Statement

Lucy uses a sliding-window conversation model where only recent messages are kept in context. The agent can create a **plan** (task list) for a session via the `create_plan` tool. Plans are stored server-side and fetched on page load by `usePlan`.

Currently, `ChatContainer` renders `<PlanPanel>` whenever a plan exists (`{plan && <PlanPanel plan={plan} />}`). This means:

- **Incomplete plans** correctly survive refresh (good).
- **Completed plans** also survive refresh and remain visible indefinitely (bad) — they clutter the UI long after they're relevant.

The desired behavior:
1. **Incomplete plan** (pending, in_progress) — always show, even after refresh, even if created days ago.
2. **Completed plan** (completed, failed, cancelled) — show during the current page session (so the user sees the transition), but disappear on next page refresh.
3. Only the **latest plan** per session matters.

## Decision

Add a visibility filter in the `usePlan` hook:

- Track whether a plan's completion was **witnessed** during this page session (i.e., the plan transitioned from a non-terminal to a terminal status while the component was mounted).
- On initial DB fetch (page load/refresh): return `null` for plans with terminal status (`completed`, `failed`, `cancelled`). This makes completed plans disappear on refresh.
- During streaming or when a plan transitions to terminal while mounted: continue showing it. Use a React ref to track "witnessed completion" — if the plan was non-terminal at any point during this mount cycle and then became terminal, keep showing it until the next refresh.

No backend changes. The backend already returns the plan with its status. The filtering is purely a frontend presentation concern.

**Non-goals:**
- No multi-plan UI (only latest plan shown).
- No plan history or archive view.
- No backend API changes.

## Consequences

* Good, because incomplete plans are always visible regardless of conversation length — users never lose track of in-progress work.
* Good, because completed plans auto-clean on refresh, reducing UI clutter.
* Good, because no backend changes needed — pure frontend logic.
* Bad, because if a user refreshes mid-streaming while a plan is being created, the plan won't show until the stream completes and the DB is written. This is existing behavior and acceptable.

## Implementation Plan

* **Affected paths**: `desktop/renderer/src/hooks/usePlan.ts`
* **Dependencies**: none
* **Patterns to follow**: existing `usePlan` hook structure with `useRef` for tracking state across renders (see `prevStreamPlanRef` pattern already in the file)
* **Patterns to avoid**: do not add backend filtering — this is a UI-layer concern. Do not store "witnessed" state in localStorage or any persistent store.

### Steps

1. **`usePlan.ts`** — Add terminal-status filtering:
   - Define `TERMINAL_STATUSES = ['completed', 'failed', 'cancelled']`.
   - Add a `useRef<boolean>` called `witnessedCompletionRef` (default `false`).
   - When `dbPlan` or `streamPlan` has a non-terminal status, set `witnessedCompletionRef.current = true` (we've seen it alive).
   - In the final `plan` derivation: if the resolved plan has a terminal status AND `witnessedCompletionRef` is `false` (meaning we never saw it non-terminal — it was already complete on mount), return `null`.
   - If it has a terminal status AND `witnessedCompletionRef` is `true`, return the plan (user witnessed completion).

### Verification

- [ ] Create a plan via agent, verify PlanPanel appears during streaming
- [ ] Let plan complete, verify PlanPanel still shows (witnessed completion)
- [ ] Refresh page after plan completed, verify PlanPanel is gone
- [ ] Create a plan, leave it incomplete, refresh page, verify PlanPanel still shows
- [ ] Create a new plan in same session after previous completed, verify new plan shows

## Alternatives Considered

* **Backend filtering** (add `?hideCompleted=true` query param): Rejected because this is a presentation concern — the backend shouldn't decide what the UI shows based on page lifecycle. Also adds unnecessary API surface.
* **localStorage timestamp tracking** (store "last seen plan ID" and hide if completed before session start): Rejected as over-engineered. The ref-based approach is simpler and stateless across refreshes, which is exactly the desired behavior.

## More Information

- Related: Plans are created by agents via `create_plan` / `update_plan` tools in `ChatService`
- The `usePlanStream` hook extracts plans from SSE — this ADR does not change that flow
- Revisit if multi-plan support is added (would need a list view with per-plan visibility)


