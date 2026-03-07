---
prd: whatsapp-integration
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: WhatsApp Integration

> Summary: Add a gateway plugin system to `agents-gateway-http` and implement WhatsApp as the first plugin, enabling users to chat with their Lucy agent via WhatsApp Business Cloud API.

## Task List

- [x] **1. Define gateway plugin interface** — types and contracts for HTTP gateway plugins
- [x] **2. Add gateway plugin resolution and lifecycle** — resolve, init, and destroy gateway plugins from config
- [x] **3. Wire gateway plugin system into startup** — load config, resolve plugins, mount routes, teardown on shutdown
- [x] **4. Create whatsapp plugin package scaffold** — new `agents-plugin-whatsapp` package with entry point and config types
- [x] **5. Implement webhook verification endpoint** — `GET /whatsapp/webhook` responds to Meta's challenge
- [x] **6. Implement WhatsApp reply sender** — send agent response back via WhatsApp Cloud API
- [x] **7. Add phone-to-session mapping store** — persist phone number to session ID mapping in a JSON file
- [x] **8. Implement inbound message handler** — `POST /whatsapp/webhook` receives messages async, checks allowlist, calls runtime `[blocked by: 6, 7]`
- [x] **9. Handle long responses** — split agent replies exceeding 4096 chars into multiple WhatsApp messages `[blocked by: 6]`
- [x] **10. Register whatsapp plugin in gateway** — add to plugin registry and document configuration `[blocked by: 3, 8, 9]`

---

### 1. Define gateway plugin interface
<!-- status: done -->

Create a `GatewayPlugin` interface in `agents-gateway-http` that mirrors the runtime plugin pattern. The `onInit` input receives the Hono app instance (for registering routes) and the `AgentRuntime` instance (for calling `sendMessage`, `createSession`, etc.). Include `onDestroy` for cleanup. Define `GatewayPlugin`, `GatewayPluginRegistry`, `ResolvedGatewayPlugin`, and the config shape (`GatewayPluginsConfig`) with `enabled` and `configById` fields matching the runtime pattern.

**Files:** `agents-gateway-http/src/types/gateway-plugins.ts` (new)
**Depends on:** —
**Validates:** Types compile, `onInit` input includes both `app: Hono` and `runtime: AgentRuntime`

---

### 2. Add gateway plugin resolution and lifecycle
<!-- status: done -->

Implement `resolveGatewayPlugins()` (mirroring `agents-runtime/src/plugins/registry.ts`) to resolve enabled plugins from the registry and config. Implement `initGatewayPlugins()` and `destroyGatewayPlugins()` lifecycle functions (mirroring `agents-runtime/src/plugins/lifecycle.ts`). The init function passes the Hono app, the AgentRuntime, and plugin config to each plugin's `onInit`.

**Files:** `agents-gateway-http/src/gateway-plugins/registry.ts` (new), `agents-gateway-http/src/gateway-plugins/lifecycle.ts` (new)
**Depends on:** 1
**Validates:** Resolution throws on missing plugins, init calls `onInit` with app + runtime, destroy calls `onDestroy`

---

### 3. Wire gateway plugin system into startup
<!-- status: done -->

Update `agents-gateway-http` startup to load the `agents-gateway-http.plugins` section from `lucy.config.json`, resolve gateway plugins, call `initGatewayPlugins(app, runtime)` after core routes are mounted, and call `destroyGatewayPlugins()` during shutdown. Update `LucyConfig` type in `agents-runtime/src/config/types.ts` to type the gateway config's `plugins` field.

**Files:** `agents-gateway-http/src/index.ts`, `agents-gateway-http/src/runtime.ts`, `agents-gateway-http/src/server.ts`, `agents-runtime/src/config/types.ts`
**Depends on:** 2
**Validates:** Gateway starts with no plugins enabled (no regression), logs loaded gateway plugins at boot

---

### 4. Create whatsapp plugin package scaffold
<!-- status: done -->

Create a new workspace package `agents-plugin-whatsapp` with `package.json`, `tsconfig.json`, and entry point. Define the plugin config type (`WhatsAppPluginConfig` with `phoneNumberId`, `verifyToken`, `allowedNumbers`). Export a `createWhatsAppPlugin()` factory that returns a `GatewayPlugin`. The API token is read from `WHATSAPP_API_TOKEN` env var at init time. Add the package to root `package.json` workspaces.

**Files:** `agents-plugin-whatsapp/package.json` (new), `agents-plugin-whatsapp/src/index.ts` (new), `agents-plugin-whatsapp/src/config.ts` (new), `package.json` (workspace entry)
**Depends on:** 1
**Validates:** Package installs, exports compile, factory returns a valid `GatewayPlugin`

---

### 5. Implement webhook verification endpoint
<!-- status: done -->

In the WhatsApp plugin's `onInit`, register `GET /whatsapp/webhook` on the Hono app. The endpoint reads `hub.mode`, `hub.verify_token`, and `hub.challenge` from query params. If mode is `subscribe` and the token matches `verifyToken` from config, respond with 200 and the challenge string. Otherwise respond with 403.

**Files:** `agents-plugin-whatsapp/src/routes/webhook.ts` (new), `agents-plugin-whatsapp/src/index.ts`
**Depends on:** 4
**Validates:** GET request with correct token returns 200 + challenge, wrong token returns 403

---

### 6. Implement WhatsApp reply sender
<!-- status: done -->

Create a small client module that sends a text message via the WhatsApp Cloud API (`POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages`). Takes the recipient number, message text, and config (phoneNumberId + API token). Handles HTTP errors with logging but does not throw (best-effort delivery).

**Files:** `agents-plugin-whatsapp/src/whatsapp-client.ts` (new)
**Depends on:** 4
**Validates:** Sends correct payload shape to Meta's API, logs errors on failure

---

### 7. Add phone-to-session mapping store
<!-- status: done -->

Create a simple JSON-file-backed store that maps phone numbers to session IDs. On first message from an allowed number, call `runtime.createSession()` and persist the mapping. On subsequent messages, look up the existing session ID. If the mapped session no longer exists (data dir wiped), catch the "Session not found" error and create a fresh session. Store file lives in the data directory. The runtime reference is received via `onInit`.

**Files:** `agents-plugin-whatsapp/src/session-store.ts` (new)
**Depends on:** 4
**Validates:** First message creates session and persists mapping, second message reuses same session ID, stale mapping auto-recovers

---

### 8. Implement inbound message handler
<!-- status: done -->

Register `POST /whatsapp/webhook` on the Hono app. Respond 200 immediately to Meta (required within 20s), then process the message asynchronously. Parse the Meta webhook payload — filter out delivery status updates (no `messages` array), extract sender phone number and text from actual inbound messages. Check number against `allowedNumbers`. If allowed, deduplicate using an in-memory TTL cache of Meta message IDs (e.g. 5-minute TTL), look up or create session, call `runtime.sendMessage()`, and send the reply via the WhatsApp client. Log errors but don't crash.

**Files:** `agents-plugin-whatsapp/src/routes/webhook.ts`, `agents-plugin-whatsapp/src/handler.ts` (new), `agents-plugin-whatsapp/src/dedup-cache.ts` (new)
**Depends on:** 5, 6, 7
**Validates:** Allowed number triggers `sendMessage`, disallowed number dropped, status updates ignored, duplicate message IDs dropped, Meta always gets 200 immediately

---

### 9. Handle long responses
<!-- status: done -->

Before sending the agent's reply, check if it exceeds WhatsApp's 4096-character limit. If so, split on paragraph boundaries (double newlines), falling back to sentence boundaries, then hard-split at 4096. Send each chunk as a separate message in order via the reply sender.

**Files:** `agents-plugin-whatsapp/src/message-splitter.ts` (new), `agents-plugin-whatsapp/src/handler.ts`
**Depends on:** 6
**Validates:** A 5000-char response is split into 2+ messages, short responses sent as-is

---

### 10. Register whatsapp plugin in gateway
<!-- status: done -->

Add `agents-plugin-whatsapp` as a dependency of `agents-gateway-http`. Register it in the gateway plugin registry (similar to how `agents-memory` is registered in `plugins.ts` for runtime plugins). Add a `whatsapp` example to the `agents-gateway-http.plugins` section in `lucy.config.json`.

**Files:** `agents-gateway-http/package.json`, `agents-gateway-http/src/gateway-plugins/registry.ts`, `lucy.config.json`
**Depends on:** 3, 8, 9
**Validates:** Gateway starts with whatsapp enabled in config, webhook endpoints are reachable
