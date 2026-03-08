---
prd: gateway-webui-mount
generated: 2026-03-08
last-updated: 2026-03-08
---

# Tasks: Mount WebUI and Landing Page in Gateway with Route Prefixes

> Summary: Move API routes behind `/api`, serve the WebUI SPA at `/chat`, and keep the landing page at `/`. All served from one Hono server on one port.

## Task List

- [x] **1. Prefix API routes with `/api`** — move chat and health routes from `/` to `/api`
- [x] **2. Update WebUI API client to use `/api` prefix** — switch from absolute URL to relative `/api/*` paths
- [x] **3. Configure WebUI Vite build for `/chat/` base path** — assets resolve correctly under `/chat/`
- [x] **4. Mount WebUI static files at `/chat` in gateway** — serve `agents-webui/dist` with SPA fallback
- [x] **5. Verify route ordering and SPA fallback** — ensure API, WebUI, and landing page don't collide `[blocked by: 1, 3, 4]`

---

### 1. Prefix API routes with `/api`

<!-- status: done -->

Change the gateway to mount chat and health route groups under `/api` instead of root. In `server.ts`, change `app.route("/", chat)` to `app.route("/api", chat)` and same for health. This moves endpoints to `POST /api/chat`, `GET /api/chat/history`, `GET /api/models`, `GET /api/health`.

**Files:** `agents-gateway-http/src/server.ts`
**Depends on:** —
**Validates:** `curl localhost:3080/api/health` returns `{"ok":true}`, old `/health` returns 404 or landing page

---

### 2. Update WebUI API client to use `/api` prefix

<!-- status: done -->

Change the `BASE_URL` default from `http://localhost:3080` to empty string (same-origin) and update all request paths to include the `/api` prefix (`/api/chat`, `/api/chat/history`, `/api/models`). Keep `VITE_API_URL` env var support so the WebUI can still run standalone against a different host during development.

**Files:** `agents-webui/src/api/client.ts`
**Depends on:** 1
**Validates:** WebUI fetches from `/api/chat/history` and `/api/models` when served same-origin; still works standalone with `VITE_API_URL=http://localhost:3080/api`

---

### 3. Configure WebUI Vite build for `/chat/` base path

<!-- status: done -->

Add `base: "/chat/"` to `vite.config.ts` so that the built `index.html` references assets at `/chat/assets/...` instead of `/assets/...`. This prevents collision with landing page assets and ensures correct loading when the SPA is mounted at `/chat`.

**Files:** `agents-webui/vite.config.ts`
**Depends on:** —
**Validates:** After `npm run build`, `dist/index.html` contains `src="/chat/assets/..."` references

---

### 4. Mount WebUI static files at `/chat` in gateway

<!-- status: done -->

Serve `agents-webui/dist` at `/chat` using a **two-call `serveStatic` chain** (Hono's `index` option is directory-index only, not SPA fallback — confirmed in honojs/hono#1859). Use the same conditional-existence pattern as the landing page. Mount both calls after API routes but before the landing page catch-all.

**Call 1 — real files:** Mount `serveStatic` at `/chat/*` with `root` pointing at `agents-webui/dist` and `rewriteRequestPath` stripping the `/chat` prefix so `/chat/assets/index-abc.js` resolves to `dist/assets/index-abc.js`. This serves JS, CSS, and other static assets.

**Call 2 — SPA fallback:** Mount a second `serveStatic` at `/chat/*` with explicit `path` pointing at `dist/index.html`. Because call 1 calls `next()` when no file matches, this catch-all returns the app shell for any `/chat/foo/bar` route, enabling client-side routing.

**Files:** `agents-gateway-http/src/server.ts`
**Depends on:** 3
**Validates:** `curl localhost:3080/chat` returns WebUI HTML; `curl localhost:3080/chat/assets/index-*.js` returns JS bundle; `curl localhost:3080/chat/nonexistent` returns WebUI HTML (not 404); `curl localhost:3080/` still returns landing page

---

### 5. Verify route ordering and SPA fallback

<!-- status: done -->

Review and test the final route order in `server.ts`: (1) logging + CORS middleware, (2) `/api/*` routes, (3) `/chat/*` static with SPA fallback, (4) `/*` landing page static. Confirm no route shadows another. Verify that unknown paths under `/chat/foo` serve the WebUI index.html (SPA routing), while unknown paths under `/` serve the landing page index.html.

**Files:** `agents-gateway-http/src/server.ts`
**Depends on:** 1, 3, 4
**Validates:** All key cases from the PRD pass: `/` → landing, `/chat` → WebUI, `/api/health` → JSON, `/chat/nonexistent` → WebUI index.html, `/api/nonexistent` → 404 JSON error
