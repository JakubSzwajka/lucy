---
prd: pi-session-keepalive
generated: 2026-03-11
last-updated: 2026-03-11
---

# Tasks: Pi Session Keepalive

> Separate the Pi SDK session into its own process so it survives gateway hot-reloads. Gateway talks to Pi over a unix socket using Pi's existing RPC protocol.

## Task List

- [x] **1. pi-bridge daemon** — spawn `pi --mode rpc`, expose over unix socket
- [x] **2. Runtime RPC client** — replace direct Pi SDK usage with socket client
- [x] **3. Reconnect on gateway restart** — client auto-reconnects, catches up on state
- [x] **4. Dev orchestration** — `npm run dev` starts bridge + gateway together
- [x] **5. Cleanup old runtime** — remove direct Pi SDK imports from gateway/runtime

---

### 1. pi-bridge daemon
<!-- status: done -->

Create `src/runtime/pi-bridge/index.ts` — a standalone script that:
1. Spawns `pi --mode rpc` as a child process (with session persistence on)
2. Listens on a unix socket at `/tmp/lucy-pi.sock` (configurable via env)
3. When a client connects, pipes JSONL bidirectionally: socket ↔ pi's stdin/stdout
4. Handles cleanup: removes socket file on exit, kills pi child on SIGTERM

This is intentionally minimal — no logic, no transforms. Just a pipe between a socket and stdio. The daemon should log `[pi-bridge] listening on /tmp/lucy-pi.sock` on start.

**Edge case:** If the socket file already exists (stale from a crashed run), unlink it before listening. If pi subprocess crashes, log the error and exit (let the orchestrator restart it).

**Files:** `src/runtime/pi-bridge/index.ts` (new)
**Depends on:** —
**Validates:** Run the bridge manually (`npx tsx src/runtime/pi-bridge/index.ts`), connect with `nc -U /tmp/lucy-pi.sock`, send `{"type": "get_state"}\n`, get a JSON response back.

---

### 2. Runtime RPC client
<!-- status: done -->

Rewrite `AgentRuntime` to be a **socket client** instead of a direct Pi SDK wrapper. It connects to the unix socket, sends JSONL commands, and parses JSONL events back.

Current interface to preserve (used by gateway routes + extensions):
- `sendMessage(message)` → sends `{"type": "prompt", "message": "..."}`, collects `text_delta` events, resolves on `agent_end`
- `getHistory()` → sends `{"type": "get_messages"}`, returns parsed messages
- `getModels()` → sends `{"type": "get_available_models"}`
- `abort()` → sends `{"type": "abort"}`
- `init()` → connects to socket, verifies pi-bridge is alive via `get_state`
- `destroy()` → closes socket connection (does NOT kill pi-bridge)

The key change: `sendMessage` no longer subscribes to in-process Pi SDK events. Instead it reads JSONL events from the socket and reconstructs the same response shape. The public API stays identical — gateway routes and extensions don't change.

**JSONL parsing note:** Split on `\n` only. Do NOT use Node's `readline` (it splits on Unicode line separators U+2028/U+2029 which can appear inside JSON strings).

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts` (rewrite), `src/runtime/core/src/runtime/socket-client.ts` (new)
**Depends on:** 1
**Validates:** Gateway starts, connects to bridge, `POST /chat` sends a message and gets a response back through the full socket→pi→socket path.

---

### 3. Reconnect on gateway restart
<!-- status: done -->

The runtime client must handle the socket connection dropping (gateway restart) and reconnecting. Specifically:

1. On `init()`, if socket isn't available yet, retry with backoff (bridge might still be starting)
2. If socket drops mid-idle, reconnect silently on next `sendMessage` call
3. If socket drops mid-request (gateway restarted while agent was working), on reconnect: call `get_state` to check if pi is still busy or finished, then either re-subscribe to events or fetch the completed result via `get_messages`
4. Expose a `status()` method that returns `"connected" | "disconnected" | "reconnecting"` for the gateway health endpoint

This is the task that makes hot-reload actually work end-to-end. Without it, the gateway restarts but can't find the bridge.

**Files:** `src/runtime/core/src/runtime/socket-client.ts`, `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** Start bridge + gateway. Send a message that triggers a long agent turn. While agent is running, restart the gateway (`touch src/gateway/core/src/index.ts`). Gateway reconnects and the response eventually arrives.

---

### 4. Dev orchestration
<!-- status: done -->

Update `npm run dev` to start both the pi-bridge and gateway. Options:

- **Shell script** (`scripts/dev.sh`): start bridge in background, wait for socket, start gateway with tsx watch. Trap SIGINT to kill both.
- **`concurrently`** package: `concurrently "tsx src/runtime/pi-bridge/index.ts" "tsx watch src/gateway/core/src/index.ts"`
- **Make target**: if a Makefile exists, add a `dev` target.

Pick the simplest option that gives clean log output with `[pi-bridge]` and `[gateway]` prefixes. The bridge must NOT be under tsx watch — that's the whole point.

Also update `npm start` (production) — in prod there's no tsx watch, so the bridge separation is optional. Keep `npm start` working as a single process for now (it can use the bridge later if needed).

**Files:** `package.json` (scripts), `scripts/dev.sh` (new, if shell script approach)
**Depends on:** 1
**Validates:** `npm run dev` starts both processes. Editing a gateway file restarts only the gateway. Pi session survives.

---

### 5. Cleanup old runtime
<!-- status: done -->

Remove the direct Pi SDK imports that are no longer used:

- `AgentRuntime` no longer imports `createAgentSession`, `SessionManager`, `SettingsManager`, `AuthStorage`, `ModelRegistry`, `DefaultResourceLoader` from `@mariozechner/pi-coding-agent`
- Remove the `readPromptFile()` helper (pi handles prompt.md itself in RPC mode)
- Remove model resolution logic (pi handles `--model` flag)
- Remove session persistence logic (pi handles `--session-dir`)
- Update `agents-runtime` tsconfig path alias if the entry point changed
- Verify `npm run typecheck` still passes

Don't remove `@mariozechner/pi-coding-agent` from `package.json` — it's still needed to run `pi --mode rpc`.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`, `src/runtime/core/src/types.ts`, `tsconfig.json`
**Depends on:** 2, 3
**Validates:** `npm run typecheck` passes. No imports from `@mariozechner/pi-coding-agent` in `src/runtime/core/` (only in pi-bridge if needed). Gateway still works end-to-end.

---
