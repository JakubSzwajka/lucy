---
status: draft
date: 2026-02-23
author: kuba
gh-issue: ""
---

# URL-Based Chat Routing

## Problem

Chat sessions are not reflected in the URL. Navigating between sessions swaps content via React state (`activeSessionId` in `MainContext`) but the URL stays at `/`. This means:

- You can't bookmark or share a link to a specific chat
- Browser back/forward buttons don't navigate between chats
- Refreshing the page loses the active session selection
- Future features like in-message "follow up here" links are impossible without URL-addressable chats

## Proposed Solution

Move from state-driven to URL-driven session navigation using Next.js dynamic routes. The chat page becomes `/chat/[sessionId]` instead of `/`. Clicking a session in the sidebar navigates to `/chat/:sessionId`. The active session is derived from the URL param, not React state. Loading states cover the transition between sessions.

## Key Cases

- Clicking a session in the sidebar navigates to `/chat/:sessionId`
- Navigating to `/chat/:sessionId` directly loads that session (deep link)
- Browser back/forward navigates between previously visited sessions
- Refreshing preserves the active session
- `/` (root) redirects to `/chat` or shows empty state / last session
- Creating a new session navigates to `/chat/:newSessionId`
- Invalid or inaccessible session ID shows appropriate error/not-found state
- Loading state while session data is being fetched

## Out of Scope

- Clickable in-message links to other sessions (future feature that builds on this)
- Changing the session ID format (keep using existing DB IDs)
- URL-based state for anything beyond session selection (e.g., scroll position, selected message)

## Decisions

- `/` redirects to `/dashboard` — no empty chat state needed
- Fully replace `activeSessionId` React context with URL-driven routing; caching handled by TanStack Query

## References

- `src/app/(main)/layout.tsx` — MainLayout with `activeSessionId` state + `MainContext`
- `src/app/(main)/page.tsx` — current chat page reading from context
- `src/components/Sidebar.tsx` — session click handler
- `src/components/SessionItem.tsx` — session list items
