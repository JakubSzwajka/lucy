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

### [Draft] Plugin seam for runtime capabilities
- **Found:** `agents-runtime` already has clean dependency injection for storage and models, but no extension surface for capabilities that want to observe or enrich execution.
- **Decision:** Scope this PRD to the plugin seam plus a thin memory package scaffold, not the full durable memory system.
- **Watch out:** if the first interface is shaped too much around memory, future capabilities will either bypass it or force a breaking redesign.

### [Tasks] Initial decomposition
- **Found:** the cleanest current hook points are `prepareContext()` and `run()` finalization inside `agents-runtime/src/runtime.ts`; runtime consumers are thin and easy to update.
- **Decision:** sequence the work as runtime contract -> runtime wiring -> memory package scaffold -> gateway registration -> smoke verification.
- **Watch out:** task 6 assumes the gateway is the first real integration path; if you prefer to keep the gateway plugin-free, swap that task for a dedicated example package instead.

### [Correction] Configured runtime bootstrap
- **Found:** the desired deployment model is "runtime + config" reused by multiple transports, not each transport manually attaching plugins.
- **Decision:** move plugin selection into runtime config plus a bootstrap/registry layer; keep HTTP and CLI as consumers of a configured runtime instance, not owners of plugin wiring.
- **Watch out:** config should select from installed plugin ids, not dynamically import arbitrary packages by name.
