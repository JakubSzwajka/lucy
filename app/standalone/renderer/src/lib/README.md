# Lucy Library Architecture

This document describes the module structure under `renderer/src/lib/` and how they relate to each other.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION                                │
│                                                                          │
│   hooks/useSessionChat.ts ────────────────────────────────────────────┐  │
│            │                                                          │  │
│            │ uses                                                     │  │
│            ▼                                                          │  │
│   ┌─────────────────────────────────────────────────────────┐        │  │
│   │              services/item/item.transformer.ts          │        │  │
│   │  Converts DB items ↔ ChatMessages ↔ AI SDK format       │        │  │
│   └─────────────────────────────────────────────────────────┘        │  │
│                                                                       │  │
│   All hooks use ──► lib/api/client.ts (APIClient)                    │  │
│                        │  Bearer token auth, 401 handling            │  │
│                        │  baseURL from NEXT_PUBLIC_API_URL           │  │
│                        ▼                                              │  │
│                    Cloud Backend (backend/:3001)                      │  │
└──────────────────────────────────────────────────────────────────────┘  │
                                                                           │
┌─────────────────────────────────────────────────────────────────────────┐
│                    API ROUTES (Legacy - kept for Electron standalone)    │
│                                                                          │
│   /api/sessions/[id]/chat ──► ChatService.executeTurn()                  │
│   /api/sessions/[id]/plans ─► PlanService                               │
│   /api/sessions/route.ts ───► SessionService                            │
│                                                                          │
│   NOTE: Frontend now calls Cloud Backend directly via API Client.        │
│   These local routes remain for Electron standalone mode only.           │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                  │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    services/chat/chat.service.ts                │   │
│   │  Turn orchestrator: resolves session, persists messages,         │   │
│   │  prepares AI context, streams response, persists steps          │   │
│   │                                                                 │   │
│   │  Dependencies: SessionService, AgentService, ItemService,       │   │
│   │  StepPersistence, ToolRegistry, AI Providers                    │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│   │  Session    │  │   Agent     │  │    Item     │  │ Integration │  │
│   │  Service    │  │   Service   │  │   Service   │  │   Service   │  │
│   ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤  │
│   │ CRUD for    │  │ CRUD for    │  │ CRUD for    │  │ CRUD for    │  │
│   │ sessions    │  │ agents      │  │ items       │  │ OAuth creds │  │
│   │ (user-      │  │ (runtime    │  │ (messages,  │  │ & 3rd party │  │
│   │ facing      │  │ instances   │  │ tool calls, │  │ connections │  │
│   │ container)  │  │ w/ parent-  │  │ results,    │  │             │  │
│   │             │  │ child tree) │  │ reasoning)  │  │             │  │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│          │                │                │                │          │
│          └────────────────┴────────────────┴────────────────┘          │
│                                    │                                    │
│                                    ▼                                    │
│                        ┌───────────────────┐                           │
│                        │    Repository     │                           │
│                        │     Pattern       │                           │
│                        │  (per service)    │                           │
│                        └─────────┬─────────┘                           │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              TOOLS                                       │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     tools/registry.ts                           │   │
│   │  Central registry: discovers tools from providers, namespaces   │   │
│   │  them, converts to AI SDK format, executes with persistence     │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│            ┌─────────────────┼─────────────────┐                       │
│            ▼                 ▼                 ▼                        │
│   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐             │
│   │ McpToolProvider│ │BuiltinProvider │ │IntegrationProv │             │
│   ├────────────────┤ ├────────────────┤ ├────────────────┤             │
│   │ Wraps MCP      │ │ Code-defined   │ │ Creates tools  │             │
│   │ servers, maps  │ │ tools loaded   │ │ from OAuth     │             │
│   │ their tools to │ │ at startup     │ │ integrations   │             │
│   │ ToolDefinition │ │               │ │ (e.g. Todoist) │             │
│   └───────┬────────┘ └────────────────┘ └────────────────┘             │
│           │                                                             │
│           ▼                                                             │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                   integrations/mcp/pool.ts                      │   │
│   │  Connection pool for MCP servers, manages lifecycle             │   │
│   └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                       db/schema.ts                              │   │
│   │  Drizzle ORM schema: sessions, agents, items, settings, etc.    │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                       db/index.ts                               │   │
│   │  SQLite connection via better-sqlite3                           │   │
│   └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Reference

### `db/` - Database Layer
| File | Purpose |
|------|---------|
| `schema.ts` | Drizzle ORM table definitions: `sessions`, `agents`, `items`, `settings`, `systemPrompts`, `mcpServers`, `integrations` |
| `index.ts` | Creates SQLite connection, exports `db` instance and table references |

**Key insight**: The `items` table is polymorphic - a single table stores messages, tool_calls, tool_results, and reasoning. The `type` column discriminates.

---

### `services/` - Business Logic Layer

Each service follows the pattern:
```
service/
  ├── index.ts           # Re-exports
  ├── *.service.ts       # Business logic, validation, orchestration
  └── *.repository.ts    # Raw DB queries
```

| Service | Responsibility | Key Dependencies |
|---------|---------------|------------------|
| **SessionService** | User-facing conversation container. Creates sessions with a root agent. | AgentService |
| **AgentService** | Runtime agent instances. Supports parent-child hierarchy for sub-agents. | - |
| **ItemService** | Polymorphic items (messages, tool calls, results, reasoning). Validates and persists. | - |
| **ChatService** | Turn orchestrator. Owns the full chat turn: resolve session, persist messages, prepare AI context, stream, persist steps, finalize. | SessionService, AgentService, ItemService, StepPersistence, ToolRegistry, AI providers |
| **PlanService** | Plan lifecycle — create, update, track progress of execution plans. | - |
| **FilesystemService** | Local filesystem operations for file tools. | - |
| **SettingsService** | App-wide settings (default model, system prompt, etc.) | - |
| **SystemPromptService** | Reusable system prompt templates. | - |
| **ConversationSearchRepository** | Full-text search across past conversation items. | - |

Note: **McpService** lives in `lib/integrations/mcp/` alongside the MCP client pool.

---

### `services/item/item.transformer.ts` - Format Conversion

This is a **critical complexity point**. It bridges three different message formats:

| Format | Source | Shape |
|--------|--------|-------|
| **DB Items** | `items` table | `{type, role, content, callId, toolName, ...}` |
| **ChatMessage** | Display layer | `{id, role, content, parts: ContentPart[]}` |
| **AI SDK UIMessage** | Streaming | `{id, role, parts: [{type: "tool-*", state, ...}]}` |

Key functions:
- `itemsToChatMessages()` - DB → ChatMessage (groups interleaved parts)
- `extractContentPartsFromStreamingMessage()` - AI SDK parts → ContentPart[]
- `mergeWithStreaming()` - Combines DB items + live streaming messages

---

### `tools/` - Tool System

| File | Purpose |
|------|---------|
| `types.ts` | Core types: `ToolDefinition`, `ToolProvider`, `ToolSource`, `ToolExecutionContext` |
| `registry.ts` | Central registry. Discovers tools, namespaces them (`mcp__server__tool`), converts to AI SDK, executes with persistence |
| `index.ts` | Initialization: registers all providers, exposes `initializeToolRegistry()` |
| `providers/mcp.ts` | Wraps MCP servers as `ToolProvider` |
| `providers/builtin.ts` | Loads code-defined tools |
| `integrations/provider.ts` | Creates tools from OAuth integrations |
| `utils/persistence.ts` | Thin wrappers for saving tool_call/tool_result items |

**Tool Namespacing**:
```
MCP:         mcp__serverId__toolName
Builtin:     builtin__category__toolName
Integration: integration__integrationId__toolName
Agent:       agent__agentId__toolName
```

**Execution Flow**:
```
AI requests tool → registry.executeWithPersistence()
  1. Generate callId
  2. Save tool_call item (status: running)
  3. Run validation (if defined)
  4. Execute tool.execute(args, context)
  5. Save tool_result item
  6. Update tool_call status → completed/failed
  7. Return result to AI
```

---

### `integrations/mcp/` - MCP Protocol

| File | Purpose |
|------|---------|
| `client.ts` | Creates MCP client connections, executes tool calls |
| `pool.ts` | Global connection pool, manages server lifecycle |
| `index.ts` | Re-exports |

The pool is used by `McpToolProvider` to discover and execute tools from configured MCP servers.

---

### `api/` - API Client Layer
| File | Purpose |
|------|---------|
| `client.ts` | Authenticated HTTP client for cloud backend. Configurable `baseURL` from `NEXT_PUBLIC_API_URL`, auto-attaches Bearer token, handles 401 by clearing token and redirecting to `/login`. Supports JSON requests (`request<T>()`) and SSE streaming (`stream()`). |

**Key exports:**
- `api` - Singleton APIClient instance
- `API_BASE_URL` - The configured backend URL

---

### `ai/` - AI Provider Abstraction

| File | Purpose |
|------|---------|
| `models.ts` | Model registry: defines available models with capabilities (supportsReasoning, etc.) |
| `providers.ts` | Creates AI SDK language model instances for Anthropic/OpenAI/Google |

---

## Data Model Relationships

```
Session (user-facing conversation)
   │
   └─► rootAgentId ──► Agent (root)
                          │
                          ├─► items[] ──► Item (message | tool_call | tool_result | reasoning)
                          │
                          └─► children[] ──► Agent (child, spawned by tool)
                                               │
                                               └─► items[]
```

- **Session** is the user-facing container (appears in sidebar)
- **Agent** is a runtime instance that can spawn child agents
- **Item** is polymorphic: messages, tool calls, results, reasoning

---

## Common Patterns

### Singleton Services
All services use lazy singleton pattern:
```typescript
let instance: SomeService | null = null;

export function getSomeService(): SomeService {
  if (!instance) {
    instance = new SomeService();
  }
  return instance;
}
```

### Repository Pattern
Services delegate DB queries to repositories:
```typescript
class SomeService {
  private repository: SomeRepository;

  getById(id: string) {
    return this.repository.findById(id);  // Raw query
  }
}
```

### Result Types
Operations return structured results:
```typescript
interface CreateResult {
  entity?: Entity;
  error?: string;
  notFound?: boolean;
}
```
