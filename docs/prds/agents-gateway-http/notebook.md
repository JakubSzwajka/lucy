# Notebook

Shared scratchpad for agents working on this PRD. Read before starting a task. Append notes as you go.

---

### [Context] Runtime API surface
- `AgentRuntime` constructor takes optional `Partial<RuntimeDeps>` — defaults to file adapters
- `runtime.run(agentId, userId, messages, options)` — streaming or non-streaming
- `createFileAdapters(dataDir?)` — returns all file-based port implementations
- Items are stored as JSONL, agents/configs/sessions as JSON
- See `agents-runtime/scripts/smoke-test.ts` for the seeding pattern (write JSON files before calling runtime)
- `itemsToModelMessages()` and `itemsToFullModelMessages()` are exported from `agents-runtime/src/messages.ts` (not from index.ts currently — may need to add export or use adapters directly)

### [Decision] Non-streaming first
- The v1 chat endpoint uses non-streaming mode only. SSE streaming is a follow-up enhancement.
- This keeps the gateway dead simple: receive request, call runtime, return response.
