# Data Flows

End-to-end request flows through the Lucy system. For module-level details, see linked READMEs.

## 1. Chat Message Flow

User sends a message from the desktop frontend through to AI streaming response.

```
Frontend (useSessionChat)
  │  useChat() via DefaultChatTransport + prepareSendMessagesRequest
  │  POST ${API_BASE_URL}/api/sessions/${sessionId}/chat
  │  Headers: Authorization: Bearer <jwt>
  │  Body: { message: { content, parts? }, model, thinkingEnabled }
  │  (sends only the new user message, not full history)
  ▼
API Route (sessions/[id]/chat/route.ts)
  │  requireAuth(request) → userId
  │  getChatService().executeTurn(sessionId, userId, message, options)
  ▼
ChatService.executeTurn()
  │  1. SessionService.getById() → validate session exists, get rootAgentId
  │  2. persistUserMessage() → ItemService.createMessage(agentId, "user", ..., contentParts)
  │  3. SessionService.maybeGenerateTitle() → auto-title from first message
  │  4. Load all items from DB → itemsToModelMessages() → build timestamped ModelMessage[]
  │  5. runAgent(rootAgentId, ..., { streaming: true })
  ▼
ChatService.runAgent() — streaming mode
  │  1. prepareChat() → resolve model, tools, system prompt (see §4)
  │  2. prependSystemPrompt() → inject system message
  │  3. streamText() with Langfuse tracing
  │     ├─ onStepFinish → persistStepContent() (tool calls, tool results, reasoning)
  │     ├─ onFinish → finalizeChat() → agent status → "waiting", turnCount++
  │     └─ onFinish → maybeAutoReflect() (fire-and-forget, see §5)
  ▼
SSE Response
  │  result.stream.toUIMessageStreamResponse({ sendReasoning: true })
  ▼
Frontend
  │  useChat() processes SSE stream → rawMessages
  │  mergeWithStreaming(loadedItems, rawMessages) → unified ChatMessage[]
  └─ UI renders messages, tool calls, reasoning
```

**Key files:**
- [`desktop/renderer/src/hooks/useAgentChat.ts`](../desktop/renderer/src/hooks/useAgentChat.ts) — `useSessionChat` hook
- [`backend/src/app/api/sessions/[id]/chat/route.ts`](../backend/src/app/api/sessions/[id]/chat/route.ts) — API route
- [`backend/src/lib/services/chat/`](../backend/src/lib/services/chat/README.md) — ChatService

## 2. Session Creation Flow

Creating a new session with its root agent.

```
POST /api/sessions  { title?, agentConfigId? }
  ▼
SessionService.create(userId, data)
  │  1. If agentConfigId provided → validate via AgentConfigService.getById()
  │  2. Else → AgentConfigService.getDefault(userId) → fallback config
  │  3. Resolve agentName from config if not explicit
  ▼
SessionRepository.create()
  │  1. Generate sessionId + agentId (UUIDs)
  │  2. INSERT sessions (rootAgentId = agentId, agentConfigId, parentSessionId?)
  │  3. INSERT agents  (sessionId, agentConfigId, status = "pending")
  │  4. Return session
  └─ Session ready — rootAgentId points to the new agent
```

**Key files:**
- [`backend/src/lib/services/session/`](../backend/src/lib/services/session/README.md) — SessionService + Repository

## 3. Delegation / Sub-Agent Flow

Parent agent delegates a task to a child agent via a delegate tool.

```
Parent agent calls delegate_to_<name>(task)
  ▼
generateDelegateTools() — built at prepareChat() time
  │  Reads agentConfig.tools where toolType="delegate"
  │  For each: loads target AgentConfig, creates tool definition
  ▼
Delegate tool execute(args, context)
  │  1. SessionService.create() → child session
  │     ├─ agentConfigId = target config
  │     ├─ parentSessionId = caller's session
  │     └─ sourceCallId = tool call ID
  │  2. ItemService.createMessage(childRootAgentId, "user", task)
  │  3. ChatService.runAgent(childRootAgentId, ..., { streaming: false })
  ▼
ChatService.runAgent() — non-streaming mode
  │  Loop up to maxTurns:
  │    1. Re-read items from DB each turn
  │    2. generateText() with tools
  │    3. Persist assistant text + tool calls + tool results
  │    4. Break if no tool calls in last step
  │  Agent status → "completed" or "failed"
  ▼
Result string returned to parent agent as tool result
```

**Continuing a sub-agent:** The `continue_session` tool sends a follow-up message to an existing child session, validates `parentSessionId` matches, and runs another non-streaming `runAgent` loop.

**Key files:**
- [`backend/src/lib/tools/delegate/`](../backend/src/lib/tools/delegate/README.md) — `generateDelegateTools()`
- [`backend/src/lib/services/chat/`](../backend/src/lib/services/chat/README.md) — `runAgent()` non-streaming path

## 4. Agent Config Resolution

How `agentConfigId` determines tools, system prompt, and model.

```
ChatService.prepareChat(agentId, userId, options)
  ▼
loadAgentWithConfig()
  │  1. AgentService.getById(agentId) → agent record
  │  2. If agent.agentConfigId → AgentConfigService.getById() → config + tools
  │  3. buildToolFilter(config) → { allowedMcpServerIds, allowedBuiltinModuleIds }
  ▼
Model resolution (first non-null wins):
  │  options.modelId  →  agent.model  →  agentConfig.defaultModelId
  ▼
System prompt resolution (first non-null wins):
  │  agent.systemPrompt
  │  → agentConfig.systemPromptOverride
  │  → agentConfig.systemPromptId → SystemPromptService.getById()
  │  → user default settings → defaultSystemPromptId
  │
  │  Then append: memory context + environment context
  ▼
Tool assembly:
  │  1. initializeToolRegistry() + mcpProvider.refreshServers()
  │  2. registry.toAiSdkTools(context, toolFilter) → filtered builtin + MCP tools
  │  3. generateDelegateTools(agentConfig, ...) → delegate tools from config
  │  4. Merge all into single tools object
  ▼
Returns ChatContext { agent, languageModel, tools, systemPrompt, ... }
```

**Key files:**
- [`backend/src/lib/services/agent-config/`](../backend/src/lib/services/agent-config/README.md) — AgentConfigService
- [`backend/src/lib/services/chat/chat.service.ts`](../backend/src/lib/services/chat/chat.service.ts) — `prepareChat()`, `resolveSystemPrompt()`

## 5. Auto-Reflection Flow

Automatic memory extraction triggered by token accumulation during chat.

```
ChatService.runAgent() — onFinish callback
  │  maybeAutoReflect(sessionId, userId, agentId)  ← fire-and-forget
  ▼
maybeAutoReflect()  (auto-reflection.service.ts)
  │  1. getMemorySettings(userId) → check autoExtract === true
  │  2. Check in-memory mutex (skip if reflection already in flight)
  │  3. Load session → read persisted reflectionTokenCount, lastReflectionItemCount
  │  4. Load items since last check → count tokens from ALL types:
  │     messages, tool calls (name+args), tool results, reasoning
  │  5. Persist updated counters to session (frontend reads these for indicator)
  │  6. If totalTokens < reflectionTokenThreshold → return
  ▼
Threshold exceeded
  │  7. ExtractionService.extract(userId, sessionId)
  │     → loads transcript, calls LLM (gpt-4o-mini default), returns memories + questions
  │  8. ExtractionService.confirm() with auto-approval:
  │     memories where confidenceScore ≥ autoSaveThreshold → approved
  │     questions where curiosityScore ≥ autoSaveThreshold → approved
  │  9. Reset session.reflectionTokenCount to 0
  └─ Reflection audit logged in `reflections` table
```

**Frontend indicator:** `ReflectionIndicator` component reads `session.reflectionTokenCount` and `memorySettings.reflectionTokenThreshold` to show a progress ring in the chat header.

**Configuration** (via `PUT /api/memory-settings`):
- `autoExtract` — master toggle (default: false)
- `reflectionTokenThreshold` — tokens before trigger (default: 5000)
- `autoSaveThreshold` — min confidence to auto-save (default: 0.8)
- `extractionModel` — LLM for extraction (default: openai/gpt-4o-mini)

**Key files:**
- [`backend/src/lib/memory/auto-reflection.service.ts`](../backend/src/lib/memory/auto-reflection.service.ts) — `maybeAutoReflect()`
- [`backend/src/lib/memory/extraction.service.ts`](../backend/src/lib/memory/extraction.service.ts) — `ExtractionService`
- [`backend/src/lib/memory/`](../backend/src/lib/memory/README.md) — Memory module
- [`desktop/renderer/src/components/chat/ReflectionIndicator.tsx`](../desktop/renderer/src/components/chat/ReflectionIndicator.tsx) — Frontend indicator
