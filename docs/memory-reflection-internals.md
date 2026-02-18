# Memory Reflection System — Internals Report

How the auto-reflection system works end-to-end.

---

## 1. Overview

Memory reflection is agent-config-driven. When the token threshold is exceeded, `maybeAutoReflect()` creates a dedicated child session using the user's configured `reflectionAgentConfigId` and runs the reflection agent non-streaming via `ChatService.runAgent()`. The agent uses its configured tools (read/create/update memories, resolve questions, etc.) to decide what to persist — there is no hardcoded extraction prompt or structured JSON schema.

---

## 2. Trigger Chain

**File:** `backend/src/lib/memory/auto-reflection.service.ts`

```
ChatService.onFinish()
  → maybeAutoReflect(sessionId, userId, agentId)  // fire-and-forget
    → checks settings.autoExtract (must be true, default: false)
    → checks in-memory mutex (Set<sessionId>)
    → counts tokens in unreflected window
    → if tokens >= threshold → runReflection()
```

### Token Counting

Counts ALL item types:

```typescript
function countItemTokens(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    switch (item.type) {
      case "message":     total += estimateTokens(item.content); break;
      case "tool_call":   total += estimateTokens(item.toolName + JSON.stringify(item.toolArgs)); break;
      case "tool_result": total += estimateTokens(item.toolOutput + item.toolError); break;
      case "reasoning":   total += estimateTokens(item.reasoningContent); break;
    }
  }
  return total;
}
```

### Settings

- **Default threshold:** 5000 tokens (`reflectionTokenThreshold`)
- **Default autoExtract:** `false` (must be enabled by user)
- **Mutex:** In-memory `Set<string>` prevents concurrent reflections per session

### Window Tracking

- `session.lastReflectionItemCount` = index where last reflection ended
- Unreflected window = `items.slice(lastReflectionItemCount)`
- Window always advances after reflection (even on failure), preventing re-triggers on same content

---

## 3. Reflection Execution

**File:** `backend/src/lib/memory/auto-reflection.service.ts` — `runReflection()`

1. Requires `settings.reflectionAgentConfigId` to be set (skips with a warning if not)
2. Formats a plain-text transcript from the unreflected items (messages, tool calls, tool results)
3. Creates a child reflection session via `SessionService.create()` with `agentConfigId = reflectionAgentConfigId` and `parentSessionId = sessionId`
4. Runs `ChatService.runAgent(reflectionSession.rootAgentId, ..., { streaming: false })`
5. The agent's tools and system prompt come entirely from its agent config — no hardcoded behavior

The reflection agent session serves as a complete audit trail. The `reflections` table is retained but not written to by the current implementation.

---

## 4. Configuration (via `PUT /api/memory-settings`)

| Setting | Default | Description |
|---------|---------|-------------|
| `autoExtract` | `false` | Master toggle — reflection does not run unless true |
| `reflectionTokenThreshold` | `5000` | Tokens accumulated since last reflection before triggering |
| `reflectionAgentConfigId` | `null` | Agent config to use for the reflection agent (required) |

---

## 5. Frontend Indicator

`ReflectionIndicator` reads `session.reflectionTokenCount` (persisted after each chat turn) and `memorySettings.reflectionTokenThreshold` to display a progress ring in the chat header showing how close the session is to the next reflection.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/lib/memory/auto-reflection.service.ts` | Trigger logic, token counting, transcript formatting, agent execution |
| `backend/src/lib/memory/context-retrieval.service.ts` | Memory retrieval, scoring, dedup, question surfacing, prompt formatting |
| `backend/src/lib/memory/memory.service.ts` | Memory CRUD, supersede logic |
| `backend/src/lib/memory/question.service.ts` | Question management |
| `backend/src/lib/memory/settings.ts` | User settings defaults and loading |
| `backend/src/lib/memory/storage/memory-store.interface.ts` | Storage interface |
| `backend/src/lib/tools/modules/continuity/index.ts` | Continuity tool (manual memory ops, question resolution) |
