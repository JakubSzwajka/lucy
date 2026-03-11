# Notebook

Shared scratchpad for agents working on this PRD. Read before starting a task. Append notes as you go.

---

### [Discovery] RPC protocol already exists
- **Found:** Pi SDK has a full RPC mode (`pi --mode rpc`) with JSONL over stdin/stdout. Documented at `packages/coding-agent/docs/rpc.md` in pi-mono. Supports prompt, abort, steer, follow_up, get_state, get_messages, compaction, model switching — everything we need.
- **Decision:** Use Pi's RPC protocol as-is. Don't invent our own. Just transport it over a unix socket instead of stdio.
- **Watch out:** Pi's RPC uses strict JSONL with LF only. Node's `readline` splits on Unicode line separators (U+2028, U+2029) which breaks the protocol. Use manual `\n` splitting.

### [Discovery] Current AgentRuntime wraps Pi SDK directly
- **Found:** `AgentRuntime` in `src/runtime/core/src/runtime/agent-runtime.ts` directly imports and uses `createAgentSession` from `@mariozechner/pi-coding-agent`. The session is in-process.
- **Decision:** The new approach replaces this with a client that talks to the pi-bridge over unix socket. `AgentRuntime` becomes a thin RPC client instead of a direct SDK wrapper.
- **Watch out:** `sendMessage` currently subscribes to Pi SDK events in-process. The new version will receive these as JSONL events over the socket — same data, different transport.
