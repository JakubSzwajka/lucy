# Lucy Library Architecture

This document describes the module structure under `renderer/src/lib/` and how they relate to each other.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION                                │
│                                                                          │
│   hooks/useAgentChat.ts ─────────────────────────────────────────────┐  │
│            │                                                          │  │
│            │ uses                                                     │  │
│            ▼                                                          │  │
│   ┌─────────────────────────────────────────────────────────┐        │  │
│   │              services/item/item.transformer.ts          │        │  │
│   │  Converts DB items ↔ ChatMessages ↔ AI SDK format       │        │  │
│   └─────────────────────────────────────────────────────────┘        │  │
└──────────────────────────────────────────────────────────────────────┘  │
                                                                           │
┌─────────────────────────────────────────────────────────────────────────┐
│                           API ROUTES (Next.js)                          │
│                                                                          │
│   /api/chat/route.ts ──────► ChatService.prepareChat()                  │
│   /api/sessions/route.ts ──► SessionService                             │
│   /api/agents/route.ts ────► AgentService                               │
│   /api/agents/[id]/items ──► ItemService                                │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                  │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    services/chat/chat.service.ts                │   │
│   │  Orchestrates AI chat: prepares context, converts messages,     │   │
│   │  handles finish callbacks, persists results                     │   │
│   │                                                                 │   │
│   │  Dependencies: AgentService, ToolRegistry, AI Providers         │   │
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
│   │                         mcp/pool.ts                             │   │
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
| **ChatService** | Orchestrates AI chat streaming. Prepares context, resolves prompts, handles finish. | AgentService, ToolRegistry, AI providers |
| **IntegrationService** | OAuth credentials and third-party service connections. | - |
| **McpService** | CRUD for MCP server configurations. | McpClientPool |
| **SettingsService** | App-wide settings (default model, system prompt, etc.) | - |
| **SystemPromptService** | Reusable system prompt templates. | - |

---

### `services/item/item.transformer.ts` - Format Conversion

This is a **critical complexity point**. It bridges three different message formats:

| Format | Source | Shape |
|--------|--------|-------|
| **DB Items** | `items` table | `{type, role, content, callId, toolName, ...}` |
| **ChatMessage** | Display layer | `{id, role, content, activities[]}` |
| **AI SDK UIMessage** | Streaming | `{id, role, parts: [{type: "tool-*", state, ...}]}` |

Key functions:
- `itemsToChatMessages()` - DB → ChatMessage (groups activities with messages)
- `extractActivitiesFromParts()` - AI SDK parts → AgentActivity[]
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

### `mcp/` - MCP Protocol

| File | Purpose |
|------|---------|
| `client.ts` | Creates MCP client connections, executes tool calls |
| `pool.ts` | Global connection pool, manages server lifecycle |
| `index.ts` | Re-exports |

The pool is used by `McpToolProvider` to discover and execute tools from configured MCP servers.

---

### `ai/` - AI Provider Abstraction

| File | Purpose |
|------|---------|
| `models.ts` | Model registry: defines available models with capabilities (supportsReasoning, etc.) |
| `providers.ts` | Creates AI SDK language model instances for Anthropic/OpenAI/Google |

---

### `generative-ui/` - Custom UI Components for Tools

Optional system for rendering rich UI from tool results (e.g., Todoist task cards).

| File | Purpose |
|------|---------|
| `registry.ts` | Maps tool names → React components |
| `register-components.ts` | Registers all custom renderers |

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
