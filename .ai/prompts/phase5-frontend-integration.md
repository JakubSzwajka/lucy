# Phase 5: Connect Desktop Frontend to Cloud Backend

## Context

Lucy is a monorepo with two independent stacks:

1. **Desktop App** (`renderer/` + `main/`): Electron + embedded Next.js server, local SQLite, no auth
2. **Cloud Backend** (`backend/`): Standalone Next.js API server on port 3001, JWT auth, multi-user, dual SQLite/Postgres

They were just separated. The backend is a copy of the desktop's business logic with auth + userId added. **They are NOT connected yet.** The desktop frontend still calls its own embedded `/api/*` routes via relative URLs (`fetch("/api/sessions")`).

**Your job**: Rewire the desktop frontend to call the cloud backend instead, through an authenticated API client. The backend becomes the single source of truth. The desktop app becomes a thin UI shell.

Read the full spec at `.ai/specs/backend-separation-migration.md` for architecture details. Read `CLAUDE.md` for dev conventions.

---

## Step 0: Validate the Backend Compiles

Before touching the frontend, make the backend actually run:

```bash
cd backend
npm install
cp .env.example .env.local
# In .env.local set: JWT_SECRET=dev-secret-key-12345, DATABASE_PROVIDER=sqlite
# Copy API keys from root .env if available
npm run db:push
npm run dev
```

Fix any TypeScript / import errors until `http://localhost:3001/api/health` returns 200. This is critical - the agents that generated the backend code may have introduced import mismatches or missing exports. Common issues to expect:
- Missing exports from `@/lib/services/item` (the backend index.ts removed `extractContent`, `extractContentPartsFromStreamingMessage`, `mergeWithStreaming` exports that exist in renderer)
- `drizzle-orm` import differences between sqlite and postgres drivers
- `require()` calls in `lib/db/index.ts` that may need adjustment for Next.js bundling
- Missing `@/types` directory or type exports

Then verify the full auth flow works:
```bash
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/auth/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"testtest","name":"Test"}'
# Should return { token: "...", user: { id, email, name } }
```

---

## Step 1: Create API Client (`renderer/src/lib/api/client.ts`)

Create a centralized API client that all hooks will use instead of raw `fetch("/api/...")`.

**Requirements:**
- Configurable `baseURL` from env var `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001`)
- Auto-attaches `Authorization: Bearer <token>` header to every request
- Token storage: `localStorage` for now (we'll move to Electron keytar later)
- Handles 401 responses → clears token, redirects to login
- Supports both JSON requests and SSE streaming (for chat)
- Export a singleton instance

**Key interface:**
```typescript
class APIClient {
  private baseURL: string;

  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;

  // Generic request with auth
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;

  // SSE streaming request (for chat) - returns raw Response
  stream(endpoint: string, options?: RequestInit): Promise<Response>;
}

export const api = new APIClient();
```

---

## Step 2: Create Auth State & UI

### 2.1 Auth Hook (`renderer/src/hooks/useAuth.ts`)

Simple auth state using React state (no need for zustand - the project doesn't use it):

```typescript
interface AuthState {
  user: { id: string; email: string; name?: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean; // true during initial token verification
}

export function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};
```

On mount, check if a token exists in localStorage. If so, call `/api/auth/verify` to validate it. If invalid, clear it.

### 2.2 Auth Pages

Create minimal login and register pages. The existing app uses Tailwind + Radix UI. Keep it simple.

- `renderer/src/app/login/page.tsx` - Login form (email + password)
- `renderer/src/app/register/page.tsx` - Register form (email + password + optional name)
- Both redirect to `/` on success

### 2.3 Auth Guard

Create a wrapper component or layout that checks auth state. If not authenticated, redirect to `/login`. The main app layout at `renderer/src/app/(main)/layout.tsx` or similar should use this.

---

## Step 3: Rewire All Hooks to Use API Client

Every hook in `renderer/src/hooks/` currently does `fetch("/api/...")` with relative URLs. Change them ALL to use the API client.

### Hooks to update:

**`useSessions.ts`** - Currently:
```typescript
const response = await fetch("/api/sessions");
```
Change to:
```typescript
import { api } from "@/lib/api/client";
const data = await api.request<Session[]>("/api/sessions");
```

Same pattern for all methods (create, delete, etc).

**`useSettings.ts`** - Same pattern. `fetch("/api/settings")` → `api.request("/api/settings")`

**`useSystemPrompts.ts`** - Same pattern.

**`useQuickActions.ts`** - Same pattern.

**`useMcpServers.ts`** - Same pattern.

**`useMcpStatus.ts`** - Same pattern.

**`usePlan.ts`** - Same pattern.

### The Critical One: `useAgentChat.ts` (contains `useSessionChat`)

This is the most complex hook. It uses `@ai-sdk/react`'s `useChat` with `DefaultChatTransport` for SSE streaming. Currently:

```typescript
const transport = new DefaultChatTransport({
  api: `/api/sessions/${sessionId}/chat`,
  body: () => ({ model: modelRef.current, thinkingEnabled: thinkingEnabledRef.current }),
});
```

This needs to change to point to the backend URL AND include the auth token. `DefaultChatTransport` accepts a `headers` option:

```typescript
const transport = new DefaultChatTransport({
  api: `${API_BASE_URL}/api/sessions/${sessionId}/chat`,
  headers: () => ({
    Authorization: `Bearer ${api.getToken()}`,
  }),
  body: () => ({ model: modelRef.current, thinkingEnabled: thinkingEnabledRef.current }),
});
```

It also loads session data via `fetch(\`/api/sessions/${sessionId}\`)` on line ~98. Change this to use the API client too.

---

## Step 4: Environment Configuration

### `renderer/.env.local` (development)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### For production builds
The API URL needs to be baked into the Electron app. For now, hardcode it or use a config file that the build script generates.

---

## Step 5: Handle CORS

The backend already has CORS middleware at `backend/src/middleware.ts` that allows origins from `CORS_ORIGINS` env var. Make sure `http://localhost:8888` (Electron dev port) is in the allowed list. It already is by default.

For production Electron, the origin will be `file://` or a custom protocol. The backend CORS needs to handle this. Add `file://` to allowed origins or use `*` for the Electron builds (since it's a desktop app, CORS is less of a concern).

---

## Important Notes

### Don't Touch Backend Code
The backend should work as-is (after Step 0 fixes). All changes are in `renderer/` and `main/`.

### Don't Remove Local API Routes Yet
Keep the existing `renderer/src/app/api/*` routes in place for now. They're still used by the embedded Electron server. We can remove them later when we're confident the backend proxy works.

### The `main/background.ts` Electron Setup
Currently, the Electron main process spawns a Next.js standalone server in production (`startProductionServer()`). In development, it loads `http://localhost:8888`. The renderer still needs a dev server for the React UI, but API calls will go to `http://localhost:3001` (the backend). So in dev:
- `npm run dev` (root) → starts Electron + Next.js dev server on :8888 (for UI)
- `cd backend && npm run dev` → starts backend on :3001 (for API)
- Frontend fetches hit :3001, not :8888

### Preload Script
The existing `main/preload.ts` exposes `window.electron` with IPC methods. For now we're using `localStorage` for token storage. Later, we can add `auth:get-token` / `auth:set-token` IPC handlers to store tokens securely in the macOS Keychain via `safeStorage` or `keytar`.

### File Listing for Reference

Hooks that need updating (all in `renderer/src/hooks/`):
- `useAgentChat.ts` - **Critical**: Chat SSE streaming + session data loading
- `useSessions.ts` - Session CRUD
- `useSettings.ts` - Settings GET/PATCH
- `useSystemPrompts.ts` - System prompt CRUD
- `useQuickActions.ts` - Quick action CRUD
- `useMcpServers.ts` - MCP server CRUD
- `useMcpStatus.ts` - MCP server status polling
- `usePlan.ts` - Plan data loading

New files to create:
- `renderer/src/lib/api/client.ts` - API client singleton
- `renderer/src/hooks/useAuth.ts` - Auth state management
- `renderer/src/app/login/page.tsx` - Login page
- `renderer/src/app/register/page.tsx` - Register page

### Testing Checklist

After all changes:
1. Start backend: `cd backend && npm run dev`
2. Start desktop: `npm run dev` (from root)
3. Open app → should redirect to login
4. Register a new account → should redirect to main app
5. Sessions list should load (empty)
6. Create a new session → should appear in list
7. Send a chat message → should stream response from AI
8. Settings page should load and save
9. Refresh the app → should still be logged in (token persists)
10. Open a second browser/window → login with same account → should see same sessions
