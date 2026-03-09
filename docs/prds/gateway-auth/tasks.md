---
prd: gateway-auth
generated: 2026-03-08
last-updated: 2026-03-09
---

# Tasks: Gateway API Key Authentication

> Summary: Add API key authentication to the HTTP gateway, convert WebUI and landing page into proper gateway plugins, and add a login screen to the WebUI.

## Task List

- [x] **1. Add auth config type and loading** — extend gateway config with `auth.apiKey` field
- [x] **2. Create auth middleware** — Hono middleware that validates Bearer token on `/api/*` routes
- [x] **3. Wire auth middleware into gateway** — mount middleware in server.ts, exempt health endpoint
- [x] **4. Add Bearer header to WebUI API client** — inject auth token into all outgoing requests
- [x] **5. Add WebUI login screen** — simple API key input that stores key and gates access to chat
- [x] **6. Handle 401 in WebUI** — detect unauthorized responses and redirect to login
- [x] **7. Extract WebUI into a gateway plugin** — register as plugin in lucy.config.json instead of hardcoding
- [x] **8. Extract landing page into a gateway plugin** — register as plugin in lucy.config.json instead of hardcoding
- [x] **9. Update lucy.config.json with new plugins** — add WebUI and landing page plugin entries

---

### 1. Add auth config type and loading
<!-- status: done -->

Extend the gateway config type to include an optional `auth` section with an `apiKey` field. The config should also support reading the API key from an env var (`LUCY_API_KEY`) as a fallback, since committing secrets to config files is bad practice for deployed environments. Update `getGatewayConfig()` to merge the env var.

**Files:** `agents-runtime/src/config/types.ts`, `agents-gateway-http/src/gateway-config.ts`
**Depends on:** —
**Validates:** TypeScript compiles. Config with `agents-gateway-http.auth.apiKey` is accepted.

---

### 2. Create auth middleware
<!-- status: done -->

Create a Hono middleware that extracts the Bearer token from the `Authorization` header and compares it against the configured API key. Return `401 { error: "Unauthorized" }` on mismatch. If no API key is configured (field absent or empty), skip validation entirely — this preserves backwards compatibility for local dev.

**Files:** `agents-gateway-http/src/middleware/auth.ts` (new)
**Depends on:** 1
**Validates:** Middleware returns 401 for missing/wrong token, passes through for correct token, and is a no-op when no key is configured.

---

### 3. Wire auth middleware into gateway
<!-- status: done -->

Mount the auth middleware in `server.ts` on `/api/*` routes, after logging middleware but before route handlers. Exempt the health endpoint from auth. The middleware needs access to gateway config, so wire it after config is loaded.

**Files:** `agents-gateway-http/src/server.ts`
**Depends on:** 2
**Validates:** `curl /api/chat/history` returns 401 when API key is set. `/api/health` returns 200 without auth. Everything works normally when no key is configured.

---

### 4. Add Bearer header to WebUI API client
<!-- status: done -->

Modify the `request()` helper in the WebUI API client to read an API key from a shared location (e.g., exported getter function or module-level variable) and attach it as `Authorization: Bearer <key>` header on all requests. The key source will be set by the login screen (task 5).

**Files:** `agents-webui/src/api/client.ts`
**Depends on:** —
**Validates:** API requests include the Authorization header when a key is set. Requests work without a key when none is stored.

---

### 5. Add WebUI login screen
<!-- status: done -->

Create a simple login component with a single password/API key input field and a submit button. On submit, store the key (in localStorage under a namespaced key like `lucy-api-key`) and set it in the API client. The App component should check for a stored key on mount — if present, show chat; if not, show login. Keep it minimal: one input, one button, mono font, consistent with existing UI.

**Files:** `agents-webui/src/components/LoginScreen.tsx` (new), `agents-webui/src/App.tsx`
**Depends on:** 4
**Validates:** User sees login screen when no key is stored. After entering a valid key, chat loads. Key persists across page reloads.

---

### 6. Handle 401 in WebUI
<!-- status: done -->

Update the API client's `request()` helper to detect 401 responses. When a 401 is received, clear the stored API key and trigger a re-render that shows the login screen (e.g., via a callback or event). This handles key invalidation without a full page reload.

**Files:** `agents-webui/src/api/client.ts`, `agents-webui/src/App.tsx`
**Depends on:** 5
**Validates:** If the API key becomes invalid (changed on server), the next API call clears the key and shows the login screen.

---

### 7. Extract WebUI into a gateway plugin
<!-- status: done -->

Create a gateway plugin package entry point for the WebUI. The plugin's `onInit` hook registers the `/chat/*` static file serving routes on the Hono app (move the existing logic from `server.ts`). Follow the same manifest pattern as `agents-plugin-whatsapp`. The plugin needs no config beyond being enabled.

**Files:** `agents-webui/src/plugin.ts` (new), `agents-webui/package.json`, `agents-gateway-http/src/server.ts`
**Depends on:** —
**Validates:** WebUI is served at `/chat` when the plugin is registered in config. Not served when removed from config.

---

### 8. Extract landing page into a gateway plugin
<!-- status: done -->

Same pattern as task 7 but for the landing page. The plugin serves static files at `/` from `agents-landing-page/dist`. These routes must be registered last (catch-all) so they don't shadow other routes.

**Files:** `agents-landing-page/src/plugin.ts` (new), `agents-landing-page/package.json`, `agents-gateway-http/src/server.ts`
**Depends on:** —
**Validates:** Landing page is served at `/` when plugin is registered. Not served when removed.

---

### 9. Update lucy.config.json with new plugins
<!-- status: done -->

Add WebUI and landing page as plugin entries in `lucy.config.json`. Remove the hardcoded static file serving from `server.ts` (if not already done in tasks 7-8). Ensure plugin load order is correct — landing page plugin should load last since it registers a catch-all route.

**Files:** `lucy.config.json`, `agents-gateway-http/src/server.ts`
**Depends on:** 7, 8
**Validates:** Full system works end-to-end: landing page at `/`, chat at `/chat`, API at `/api/*` with auth, health at `/api/health` without auth.
