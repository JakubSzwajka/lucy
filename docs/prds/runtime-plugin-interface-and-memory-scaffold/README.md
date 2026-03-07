---
status: draft
date: 2026-03-07
author: "Codex"
gh-issue: ""
---

# Add Runtime Plugin Interface And Memory Scaffold

## Problem

`agents-runtime` is intentionally narrow today: it owns the execution loop and storage ports, but it has no formal extension surface for capabilities like memory, planning, or tool bundles. The runtime extraction PRD explicitly deferred plugins and tool injection, which was the right call for the first cut, but it leaves no clean place to attach durable memory without hard-coding it into the runtime or gateway.

That blocks the next architectural step. We want memory to live as a separate module that can be added or removed, not as special-case logic inside `AgentRuntime`. Before building a real memory system, the runtime needs a stable interface for plugin registration and lifecycle hooks, plus a minimal memory package that proves the shape works end-to-end.

## Proposed Solution

Introduce a runtime plugin interface in `agents-runtime` and a runtime configuration model that declares which installed plugins are enabled for a given deployment. A plugin can contribute behavior through a small set of lifecycle hooks around context preparation and run completion, without reaching into runtime internals. The first concrete plugin will be a new memory package that implements this interface and wires only the scaffold needed to participate in runtime execution.

Runtime configuration should not require each transport consumer to manually assemble plugins. Instead, a bootstrap layer should create a configured runtime instance from a runtime config plus a registry of installed plugin implementations. HTTP, CLI, and future transports should all reuse that same configured runtime shape. This PRD is intentionally about the seam and bootstrap model, not the full memory feature. The memory package should be installable and selectable by config, but its initial responsibility is to prove plugin composition, plugin resolution, and hook invocation. Any durable extraction, retrieval ranking, reflection jobs, or storage complexity beyond the scaffold is deferred to later PRDs.

## Key Cases

- Construct `AgentRuntime` with no plugins and preserve current behavior exactly.
- Enable one or more installed plugins through runtime configuration without forcing each transport to wire plugins manually.
- Let a memory plugin observe runtime lifecycle events and contribute prompt/context data through the defined interface.
- Keep plugin code in a separate package so memory can evolve independently from the runtime core.
- Bootstrap one configured runtime instance that can be reused by multiple consumers such as HTTP and CLI.
- Make the plugin boundary generic enough that future capabilities such as planning, auto-reflection, or telemetry can use the same mechanism.

## Out of Scope

- Full durable memory implementation from the external memory-system spec.
- Vector search, semantic ranking, decay, consolidation, or `MEMORY.md` curation flows.
- Background workers, schedulers, or async reflection orchestration.
- A full tool/plugin marketplace or remote plugin loading model.
- Transport-specific plugin wiring in HTTP, CLI, or UI layers.
- Dynamic code loading of plugins directly from arbitrary package names in runtime config.

## Open Questions

- What is the smallest useful hook surface: `prepareContext`, `beforeRun`, `afterRun`, or something narrower?
- Should plugins mutate runtime context directly, or return structured contributions that the runtime merges?
- What concrete runtime config shape should declare enabled plugins and plugin-specific settings?
- Where should the bootstrap live: inside `agents-runtime` or as a thin sibling package that assembles config plus installed plugin registry?
- Should plugin-specific persistence be entirely owned by the plugin package, or should the runtime expose additional ports for shared capability storage?
- How will plugin ordering and conflict resolution work if multiple plugins want to inject system prompt/context?

## References

- `docs/prds/extract-agent-runtime-and-gateways/README.md`
- `docs/prds/extract-agent-runtime-and-gateways/notebook.md`
- `agents-runtime/src/runtime.ts`
- `agents-runtime/src/ports.ts`
- `agents-gateway-http/src/routes/chat.ts`
- `docs/data-flows.md`
- `https://joelclaw.com/the-memory-system`
