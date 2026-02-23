---
prd: url-based-chat-routing
generated: 2026-02-23
last-updated: 2026-02-23
---

# Tasks: URL-Based Chat Routing

> Summary: Replace React state-driven session navigation with Next.js dynamic route `/chat/[sessionId]`, remove `activeSessionId` from MainContext, and add loading/error states.

## Task List

- [ ] **1. Create `/chat/[sessionId]` route** — new dynamic route page that reads sessionId from params
- [ ] **2. Redirect `/` to `/dashboard`** — root page becomes a redirect
- [ ] **3. Update Sidebar to use Link navigation** — session clicks navigate to `/chat/:id` instead of setting state
- [ ] **4. Remove `activeSessionId` from MainContext** — strip state, derive from URL params
- [ ] **5. Update Sidebar active state from URL** — highlight based on pathname, not context state
- [ ] **6. Update `handleNewChat` to navigate** — creating a session pushes to `/chat/:newId`
- [ ] **7. Update TriggerRunList navigation** — replace `setActiveSessionId` with router push `[blocked by: 4]`
- [ ] **8. Add loading state to chat page** — show skeleton/spinner while session data loads
- [ ] **9. Add not-found handling for invalid sessionId** — error UI for missing/unauthorized sessions

---

### 1. Create `/chat/[sessionId]` route
<!-- status: pending -->

Create `src/app/(main)/chat/[sessionId]/page.tsx`. Extract the chat rendering logic from current `src/app/(main)/page.tsx` — read `sessionId` from `params`, pass it to `ChatContainer` with `selectedModel`. This page always has a sessionId (no empty state needed since `/` redirects to dashboard).

**Files:** `src/app/(main)/chat/[sessionId]/page.tsx` (new), `src/app/(main)/page.tsx`
**Depends on:** —
**Validates:** Navigating to `/chat/<valid-id>` renders the chat for that session

---

### 2. Redirect `/` to `/dashboard`
<!-- status: pending -->

Replace the current `src/app/(main)/page.tsx` chat page with a redirect to `/dashboard`. Use Next.js `redirect()` from `next/navigation` in a server component, or a simple client-side redirect. The old chat rendering logic moves to task 1.

**Files:** `src/app/(main)/page.tsx`
**Depends on:** —
**Validates:** Visiting `/` in the browser redirects to `/dashboard`

---

### 3. Update Sidebar to use Link navigation
<!-- status: pending -->

Change `handleSessionClick` in `Sidebar.tsx` to call `router.push(\`/chat/${id}\`)` instead of `onSelectSession(id)`. Remove the `onSelectSession` prop. Session clicks should use Next.js navigation so the URL updates and back/forward work naturally.

**Files:** `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/SessionItem.tsx`
**Depends on:** —
**Validates:** Clicking a session in sidebar changes URL to `/chat/:id` and renders that session

---

### 4. Remove `activeSessionId` from MainContext
<!-- status: pending -->

Remove `activeSessionId` and `setActiveSessionId` from `MainContext` in `layout.tsx`. Remove the `onSelectSession` prop passed to Sidebar. Remove auto-select-first-session logic. Components that need the current sessionId will get it from URL params or props.

**Files:** `src/app/(main)/layout.tsx`
**Depends on:** 1, 2, 3
**Validates:** `MainContext` no longer exposes `activeSessionId`; app compiles without errors

---

### 5. Update Sidebar active state from URL
<!-- status: pending -->

Replace `activeSessionId` prop comparison in Sidebar/SessionItem with `usePathname()` — extract sessionId from `/chat/:id` path and compare. This decouples the active highlight from React state.

**Files:** `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/SessionItem.tsx`
**Depends on:** 4
**Validates:** Active session in sidebar stays highlighted on page refresh; matches URL

---

### 6. Update `handleNewChat` to navigate
<!-- status: pending -->

Change `handleNewChat` in `layout.tsx` to create the session via API then `router.push(\`/chat/${newSessionId}\`)` instead of setting state. The Cmd+N shortcut should trigger this navigation flow.

**Files:** `src/app/(main)/layout.tsx`
**Depends on:** 4
**Validates:** Cmd+N creates session and URL changes to `/chat/:newId`

---

### 7. Update TriggerRunList navigation
<!-- status: pending -->

`TriggerRunList` currently calls `setActiveSessionId` then `router.push("/")`. Replace with `router.push(\`/chat/${sessionId}\`)` directly. Remove its dependency on `useMainContext` for session navigation.

**Files:** `src/components/settings/TriggerRunList.tsx`
**Depends on:** 4
**Validates:** Clicking a trigger run navigates to `/chat/:sessionId` with correct URL

---

### 8. Add loading state to chat page
<!-- status: pending -->

Add a `loading.tsx` in `src/app/(main)/chat/[sessionId]/` or a loading skeleton inside the page component. Show a brief loading indicator while `useSessionChat` fetches session data. Keep it minimal — a pulsing container matching chat layout dimensions.

**Files:** `src/app/(main)/chat/[sessionId]/loading.tsx` (new) or `src/app/(main)/chat/[sessionId]/page.tsx`
**Depends on:** 1
**Validates:** Navigating between sessions shows a brief loading state before content appears

---

### 9. Add not-found handling for invalid sessionId
<!-- status: pending -->

Handle the case where a user navigates to `/chat/:id` with an invalid or unauthorized session ID. Either use Next.js `notFound()` with an `not-found.tsx` in the chat route segment, or show an inline error. Should cover: deleted sessions, other user's sessions, malformed IDs.

**Files:** `src/app/(main)/chat/[sessionId]/not-found.tsx` (new), `src/app/(main)/chat/[sessionId]/page.tsx`
**Depends on:** 1
**Validates:** `/chat/nonexistent-id` shows a user-friendly error, not a crash
