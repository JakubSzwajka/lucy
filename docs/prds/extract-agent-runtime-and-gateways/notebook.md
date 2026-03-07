# Notebook

Shared scratchpad for agents working on this PRD. Read before starting a task. Append notes as you go.

---

<!--
Suggested note format (not enforced):

### [Task N] Short title
- **Found:** what you discovered
- **Decision:** what you chose and why
- **Watch out:** gotchas for future agents
-->

### [Draft] Runtime split baseline
- **Found:** `src/lib/server/chat` currently acts as execution runtime, gateway helper, and infrastructure coordinator at the same time.
- **Decision:** Frame the target architecture around a standalone runtime plus gateways and adapters, rather than around a generic `server/` cleanup.
- **Watch out:** process-local state exists today for cancellation, reflection locking, and some tool discovery; any multi-instance design must replace those assumptions early.

### [Analysis] Codebase mapping — chat module
- **Found:** `chat.service.ts` (710 lines) contains both gateway logic (`executeTurn`) and runtime logic (`runAgent`, `prepareChat`). The split point is clean — these are already separate methods.
- **Found:** `step-persistence.service.ts` (168 lines) bridges AI SDK output → DB items. Currently imports `getItemService()` directly. Must accept `ItemStore` port instead.
- **Found:** Tool system (`tools/`) is ~700 lines with clean provider abstraction. Deferred to future `agents-plugins` package.
- **Found:** Builtin capabilities (continuity, plan, delegate) are ~630 lines. Also deferred.

### [Decision] Repo structure — monorepo with sibling packages
- **Decision:** Sibling directories at repo root, each its own package. Monorepo workspaces for dependency management.
- **Rationale:** The current `src/` Next.js app will eventually become `agents-gateway-http` and split further (frontend + gateway). Runtime must be importable as an external library.
- **Hard rule:** Runtime imports nothing. Gateways import runtime. Never reverse.

### [Decision] Runtime scope — conversation only
- **Decision:** For the tracer bullet, runtime = execution loop + context assembly + message history + step persistence. No tools, no plugins, no capabilities.
- **Rationale:** Tool injection needs its own design (how to configure, install, and inject plugins into the runtime). Deferring this keeps the tracer bullet focused.
- **Implication:** The runtime's first version will run agents without tools. The gateway can still use the full tool system through the existing `ChatService` until the plugin system is designed.

### [Decision] Auto-reflection deferred
- **Decision:** Auto-reflection mechanism is not part of this extraction. Will be added later as a capability/plugin.
- **Rationale:** It's a one-liner hook in `onFinish` that creates child sessions and runs sub-agents. Tightly coupled to the tool and memory systems which are also deferred.

### [Decision] Process-local state — acknowledged, not solved
- **Decision:** `activeAbortControllers`, reflection mutex, and MCP client pool are known single-instance limitations. Not addressed in this PRD.
- **Rationale:** Solving these requires distributed coordination (Redis, DB-backed locks, etc.) which is a separate concern from the architectural extraction.

### [Decision] File-based storage as default — no Postgres in runtime
- **Decision:** The runtime ships with built-in file-based adapters (JSON for entities, JSONL for items). No database dependency. Postgres adapters live in the gateway.
- **Rationale:** Makes the runtime truly standalone — deployable anywhere with just a filesystem. Gateway wiring (Postgres adapters, monorepo setup) is a separate PRD: `wire-gateway-to-runtime`.
- **Storage layout:** `.agents-data/` with `config/`, `sessions/<id>/agents/`, `sessions/<id>/items/`, `identity/` subdirectories.
- **Watch out:** JSONL item store needs care for `updateToolCallStatus` (read-modify-write on the whole file). No file locking for concurrent access — acceptable for single-instance tracer bullet.
