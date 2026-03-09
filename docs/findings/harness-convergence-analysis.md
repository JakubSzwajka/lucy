# Harness Convergence Analysis: Lucy ↔ Pi

_Date: 2026-03-09_
_Context: Architectural comparison between Lucy's agents-runtime and Pi coding agent harness_

## Background

While evaluating Pi's architecture (session management, compaction, extensions) against Lucy's `agents-runtime` and `agents-gateway-http` packages, a striking pattern emerged: **Lucy independently converged on the same harness architecture that Pi implements**, without direct influence.

This document captures the findings for future reference, potential blog material, and as the basis for a migration PRD.

## What "Harness" Means

The harness is the minimal loop that connects an LLM to tools, manages context, and persists state. Everything else is pluggable. A harness provides:

1. **The agent loop** — receive input → build context → call LLM → execute tools → repeat
2. **Session management** — persist conversation, resume, branch, compact
3. **Context window management** — compaction, summarization, file tracking
4. **Extension points** — hooks to customize every phase without forking

Everything else — what tools exist, how prompts are shaped, what happens after a run, where data lives — is plugin territory.

Reference: [The Harness Is a Framework](https://joelclaw.com/the-harness-is-a-framework) by Joel Claw

## Convergence Map

| Harness Concern | Pi | Lucy |
|---|---|---|
| Agent loop | Built-in (interactive + SDK) | `runStreamingAgent` / `runNonStreamingAgent` in `execution.ts` |
| Context assembly | `buildSessionContext()` | `prepareRuntimeContext()` in `context.ts` |
| Persistence | `SessionManager` (JSONL tree) | `AgentStore` + `ItemStore` (port interfaces) |
| Compaction | Token-based, structured, in-tree | `CompactionService` (message-count, sidecar file) |
| Plugin: modify context | Extensions (`session_before_compact`, etc.) | `RuntimePlugin.prepareContext()` → system prompt sections |
| Plugin: react to completion | Extension events | `RuntimePlugin.onRunComplete()` |
| Plugin: add routes | Extension HTTP hooks | `GatewayPlugin.onInit({ app })` — direct Hono access |
| Plugin: lifecycle | `onInit` / `onDestroy` | Same pattern, same names |
| Port abstraction | Minimal (file-based defaults) | Clean interfaces (`AgentStore`, `ItemStore`, `ConfigStore`, `ModelProvider`, `IdentityProvider`) |
| Identity injection | Not built-in | `IdentityProvider` port + `injectIdentityContext()` |
| Environment context | Not built-in | `EnvironmentContextService` |

## Where Lucy Is Ahead

**Port interfaces.** Lucy's `ports.ts` defines clean abstractions (`AgentStore`, `ItemStore`, `ConfigStore`, `ModelProvider`, `IdentityProvider`) that Pi doesn't have — Pi bakes in file-based session storage. Lucy's ports make any backing store swappable without touching the runtime.

**Identity as a first-class concept.** Lucy has `IdentityProvider` and injects identity context into the system prompt. Pi has no built-in equivalent.

**HTTP gateway as a separate package.** Lucy cleanly separates the HTTP surface (`agents-gateway-http`) from the runtime. Pi is terminal-native with no HTTP API.

**Gateway plugin model.** `GatewayPlugin` gets direct access to the Hono app instance, enabling arbitrary route registration. Pi's extensions are terminal-focused.

## Where Pi Is Ahead

**Session tree structure.** Pi stores conversations as JSONL trees with `id`/`parentId` linking, enabling branching, labeling, and navigation between approaches without losing history. Lucy uses flat sequences.

**Token-aware compaction.** Pi triggers compaction when `contextTokens > contextWindow - reserveTokens`. Lucy counts user messages (default: 50). Token-based is more accurate — a single tool-heavy turn can blow context while 50 short messages fit easily.

**Structured summary format.** Pi's compaction produces structured summaries (Goal / Constraints / Progress / Key Decisions / Next Steps / Critical Context) with file tracking. Lucy uses free-form "third person" prose.

**File tracking across compactions.** Pi cumulatively tracks `readFiles` and `modifiedFiles` across compaction boundaries. After compaction, the agent still knows which files were touched.

**Branch summarization.** When navigating away from a branch, Pi summarizes the abandoned work and injects it into the new branch. Lucy has no equivalent.

**Richer hook surface.** Pi exposes `session_before_compact`, `session_before_tree`, and message interception hooks. Lucy has `prepareContext` and `onRunComplete` — no mid-run or pre-compaction hooks.

**Extensible compaction.** Extensions can fully replace Pi's compaction logic via hooks, using custom models or formats.

## The Self-Modification Boundary

A key future requirement for Lucy: the agent should eventually be able to modify its own code. This makes the harness argument critical:

1. **The harness must be stable, external, and not self-modifiable.** If the agent loop lives in Lucy's own repo and the agent can edit that repo, you get infinite regress. An external harness (like Pi) solves this.

2. **Extensions are the safe boundary.** The agent can write/modify extensions at runtime. The harness loads them but remains immutable from the agent's perspective.

3. **Lucy's plugin system is already compatible.** A `RuntimePlugin` maps to a Pi extension. The migration path: Lucy plugins become Pi extensions, Lucy's gateway calls Pi SDK instead of `AgentRuntime`.

## Replacement Assessment

If Pi SDK replaced `agents-runtime` internals:

**Replaced (~70%):**
- The agent loop (`execution.ts`)
- Session management (replaces `AgentStore` + `ItemStore` for conversation state)
- Compaction (`CompactionService`)
- Context assembly (`prepareRuntimeContext` partially)
- Tool registration and execution

**Kept (~30%):**
- `agents-gateway-http` — Pi has no HTTP surface
- `IdentityProvider` — domain-specific
- `ModelProvider` port — Lucy's abstraction is more flexible
- `EnvironmentContextService` — Lucy-specific context enrichment
- Gateway plugins — different surface than Pi extensions
- Domain-specific runtime plugins (memory observer, etc.)

## Recommended Path

### Short term (improve Lucy's runtime without Pi dependency)
- Switch compaction to token-based triggering
- Adopt structured summary format
- Add `beforeCompact` hook to plugin interface
- Embed compaction entries in item stream

### Medium term (evaluate Pi SDK integration)
- Prototype replacing `AgentRuntime.run()` with Pi SDK's agent loop
- Map `RuntimePlugin` to Pi extensions
- Keep gateway layer and port interfaces

### Long term (if agent self-modification is the goal)
- Pi SDK as the execution chassis (immutable, external)
- Lucy becomes a Pi extension package (identity, memory, gateway, domain tools)
- Gateway stays as thin Hono layer talking to Pi SDK
- Agent can modify Lucy extensions but not the Pi harness
