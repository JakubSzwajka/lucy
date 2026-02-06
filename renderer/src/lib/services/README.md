# Services Layer

This directory contains the business logic and data access layer for Lucy. It implements a clean separation between API routes (presentation) and database operations (persistence) using the **Repository Pattern** and **Service Pattern**.

## Purpose

The services layer provides:

1. **Business Logic Encapsulation** - Services contain domain logic, validation, and orchestration
2. **Data Access Abstraction** - Repositories handle all database operations via Drizzle ORM
3. **Type Safety** - Strong TypeScript types for all inputs and outputs
4. **Testability** - Dependency injection allows easy mocking in tests
5. **Single Responsibility** - Each service/repository handles one domain

## Architecture

```
API Routes (app/api/*)
       |
       v
   Services (*.service.ts)     <-- Business logic, validation, orchestration
       |
       v
  Repositories (*.repository.ts)  <-- Data access, SQL queries
       |
       v
   Drizzle ORM + SQLite
```

## Services Overview

| Service | Responsibility |
|---------|---------------|
| **SessionService** | Manage conversation sessions (create, archive, title generation) |
| **AgentService** | Manage agents within sessions (hierarchy, status, turns) |
| **ItemService** | Manage polymorphic items (messages, tool calls, reasoning) |
| **ChatService** | Turn orchestrator (resolve session, persist messages, stream AI, persist steps, finalize) |
| **PlanService** | Manage task plans and steps (create, track progress) |
| **SettingsService** | Manage app settings (default model, enabled models) |
| **SystemPromptService** | CRUD for system prompts (with seed data) |
| **FilesystemService** | Safe file operations in memory directory |
| **ConversationSearchRepository** | Search past conversations with context |
| **McpService** | Manage MCP server connections |

---

## Session Service

**File:** `session/session.service.ts`

Manages user-facing conversation containers. Each session has a root agent and can be archived/reactivated.

### Key Methods

```typescript
class SessionService {
  // Queries
  getAll(): Session[]
  getById(id: string): Session | null
  getWithAgents(id: string): SessionWithAgents | null  // Includes agent tree

  // Mutations
  create(data?: CreateSessionOptions): CreateSessionResult
  update(id: string, data: SessionUpdate): UpdateSessionResult
  updateTitle(id: string, title: string): UpdateSessionResult
  maybeGenerateTitle(id: string, content: string): void  // Auto-title from first message
  delete(id: string): { success: boolean; notFound?: boolean }

  // Lifecycle
  touch(id: string): void  // Update timestamp
  archive(id: string): UpdateSessionResult
  reactivate(id: string): UpdateSessionResult
}
```

### Usage

```typescript
import { getSessionService } from "@/lib/services";

const sessionService = getSessionService();
const { session } = sessionService.create({ title: "My Chat" });
```

---

## Agent Service

**File:** `agent/agent.service.ts`

Manages runtime agent instances. Agents form a parent-child hierarchy within sessions and track execution state.

### Key Methods

```typescript
class AgentService {
  // Queries
  getById(id: string): Agent | null
  getByIdWithItems(id: string): AgentWithItems | null
  getBySessionId(sessionId: string): Agent[]
  getTreeBySessionId(sessionId: string): AgentWithItems[]  // Hierarchical tree

  // Mutations
  create(data: AgentCreate): CreateAgentResult
  update(id: string, data: AgentUpdate): UpdateAgentResult
  delete(id: string): { success: boolean; notFound?: boolean }

  // Status Helpers
  updateStatus(id: string, status: AgentStatus): UpdateAgentResult
  markRunning(id: string): UpdateAgentResult
  markCompleted(id: string, result?: string): UpdateAgentResult
  markFailed(id: string, error: string): UpdateAgentResult
  incrementTurnCount(id: string): UpdateAgentResult
}
```

---

## Item Service

**File:** `item/item.service.ts`

Manages polymorphic conversation items: messages, tool calls, tool results, and reasoning blocks.

### Key Methods

```typescript
class ItemService {
  // Queries
  getByAgentId(agentId: string): Item[]
  getById(id: string): Item | null
  getByCallId(callId: string): Item | null  // For tool_call/tool_result

  // Create (with type-specific validation)
  create(agentId: string, data: CreateItemData): CreateItemResult
  createMessage(agentId: string, role: "user" | "assistant" | "system", content: string): CreateItemResult
  createToolCall(agentId: string, callId: string, toolName: string, args?: object, status?: ToolCallStatus): CreateItemResult
  createToolResult(agentId: string, callId: string, output?: unknown, error?: string): CreateItemResult
  createReasoning(agentId: string, content: string, summary?: string): CreateItemResult

  // Updates
  updateToolCallStatus(callId: string, status: ToolCallStatus): boolean
}
```

### Item Types

```typescript
type CreateItemData =
  | { type: "message"; role: "user" | "assistant" | "system"; content: string }
  | { type: "tool_call"; callId: string; toolName: string; toolArgs?: object; toolStatus?: ToolCallStatus }
  | { type: "tool_result"; callId: string; toolOutput?: string; toolError?: string }
  | { type: "reasoning"; reasoningContent: string; reasoningSummary?: string }
```

### Item Transformer

**File:** `item/item.transformer.ts`

Pure functions for converting items to/from different formats (AI SDK UIMessage, ChatMessage with parts).

```typescript
class ItemTransformer {
  static extractContent(message: Record<string, unknown>): string
  static extractContentPartsFromStreamingMessage(message: Record<string, unknown>): ContentPart[]
  static itemsToContentParts(items: Item[], toolResultsByCallId: Map<string, Item>): ContentPart[]
  static itemsToChatMessages(loadedItems: Item[]): ChatMessage[]
  static mergeWithStreaming(loadedItems: Item[], rawMessages: Record<string, unknown>[]): ChatMessage[]
}
```

---

## Chat Service

**File:** `chat/chat.service.ts`

Turn orchestrator. Owns the full chat turn: resolves session and agent, persists user messages, prepares AI context, calls `streamText()`, persists streaming steps, and finalizes agent status.

### Key Methods

```typescript
class ChatService {
  // Turn orchestration (main entry point)
  async executeTurn(sessionId: string, chatMessages: unknown[], options?: ExecuteTurnOptions):
    Promise<{ stream: StreamTextResult } | { error: string; status: number }>

  // Preparation (internal, called by executeTurn)
  async prepareChat(agentId: string, options?: ChatPrepareOptions): Promise<ChatContext | null>
  async resolveSystemPrompt(agent: Agent): Promise<string | null>

  // Message Conversion (internal)
  convertToModelMessages(chatMessages: unknown[]): ModelMessage[]
  prependSystemPrompt(messages: ModelMessage[], systemPrompt: string | null): ModelMessage[]

  // Finalization (internal, called via onFinish callback)
  async finalizeChat(agentId: string): Promise<ChatFinishResult>
}

interface ChatContext {
  agent: Agent;
  languageModel: LanguageModel;
  modelConfig: ModelConfig;
  tools: Record<string, unknown>;
  providerOptions?: unknown;
  maxOutputTokens?: number;
  systemPrompt: string | null;
  isThinkingActive: boolean;
}
```

### Step Persistence

**File:** `chat/step-persistence.service.ts`

Persists step content from AI SDK's `onStepFinish` callback, maintaining interleaved order.

```typescript
async function persistStepContent(
  agentId: string,
  content: ContentPart[],
  reasoning?: ReasoningBlock[]
): Promise<void>
```

---

## Plan Service

**File:** `plan/plan.service.ts`

Manages task plans with ordered steps. One plan per session, with automatic status derivation.

### Key Methods

```typescript
class PlanService {
  // Queries
  getById(id: string): PlanWithSteps | null
  getBySessionId(sessionId: string): PlanWithSteps | null
  getByAgentId(agentId: string): PlanWithSteps | null
  hasplan(sessionId: string): boolean
  getProgress(planId: string): { completed: number; total: number; percentage: number } | null

  // Mutations
  create(data: CreatePlanInput): CreatePlanResult
  update(planId: string, input: UpdatePlanInput): UpdatePlanResult  // Handles add/update/remove steps
  delete(planId: string): { success: boolean; notFound?: boolean }

  // Step Convenience Methods
  startStep(stepId: string): UpdatePlanResult
  completeStep(stepId: string, result?: string): UpdatePlanResult
  failStep(stepId: string, error: string): UpdatePlanResult
}

interface CreatePlanInput {
  sessionId: string;
  agentId: string;
  title: string;
  description?: string;
  steps: Array<{ description: string }>;
}
```

---

## Settings Service

**File:** `config/settings.service.ts`

Manages application-wide settings with auto-initialization.

### Key Methods

```typescript
class SettingsService {
  ensureSettings(): UserSettings  // Creates default if not exists
  get(): UserSettings
  update(data: SettingsUpdate): UserSettings
  clearDefaultSystemPrompt(promptId: string): void  // Called when deleting a prompt
}

interface UserSettings {
  id: string;
  defaultModelId: string | null;
  defaultSystemPromptId: string | null;
  enabledModels: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## System Prompt Service

**File:** `config/system-prompt.service.ts`

CRUD for reusable system prompts with seed data on first access.

### Key Methods

```typescript
class SystemPromptService {
  ensureSeedPrompts(): void  // Creates defaults if table empty
  getAll(): SystemPrompt[]
  getById(id: string): SystemPrompt | null
  create(data: SystemPromptCreate): { prompt?: SystemPrompt; error?: string }
  update(id: string, data: SystemPromptUpdate): { prompt?: SystemPrompt; notFound?: boolean }
  delete(id: string): { success: boolean; notFound?: boolean }
}
```

**Seed Prompts:** "Helpful Assistant", "Code Expert", "Writing Assistant"

---

## Filesystem Service

**File:** `filesystem/filesystem.service.ts`

Safe file operations within the memory directory. Prevents directory traversal attacks.

### Key Methods

```typescript
class FilesystemService {
  constructor(config: { subdir: string })  // Creates subdirectory in memory path

  getBasePath(): string
  exists(relativePath: string): boolean
  async readFile(relativePath: string): Promise<string>
  async writeFile(relativePath: string, content: string): Promise<void>
  async deleteFile(relativePath: string): Promise<void>
  async listFiles(subdir?: string, pattern?: RegExp): Promise<string[]>
  async getFileInfo(relativePath: string): Promise<FileInfo>
}

// Factory function
function createFilesystemService(subdir: string): FilesystemService
```

**Memory Path:**
- Development: `${cwd}/memory/${subdir}`
- Production: `${LUCY_USER_DATA_PATH}/memory/${subdir}`

---

## Conversation Search Repository

**File:** `conversation-search/conversation-search.repository.ts`

Searches past conversations with surrounding context. Useful for memory/recall features.

### Key Methods

```typescript
class ConversationSearchRepository {
  searchWithContext(
    query: string,
    options?: ConversationSearchOptions
  ): ConversationSearchResult[]
}

interface ConversationSearchOptions {
  limit?: number;           // Max results (default: 5)
  contextWindow?: number;   // Items before/after match (default: 3)
  excludeSessionId?: string; // Avoid circular references
  itemTypes?: ItemType[];   // Filter to specific types
}

interface ConversationSearchResult {
  sessionId: string;
  sessionTitle: string;
  matchedItem: { id, type, content, role?, toolName?, sequence, createdAt };
  context: {
    before: ContextItem[];
    after: ContextItem[];
  };
}
```

---

## MCP Service

**File:** `../integrations/mcp/service.ts` (re-exported from services/index.ts)

Manages Model Context Protocol (MCP) server configurations and connections.

### Key Methods

```typescript
class McpService {
  // CRUD
  getAll(): McpServer[]
  getAllEnabled(): McpServer[]
  getById(id: string): McpServer | null
  create(data: McpServerCreate): { server?: McpServer; error?: string }
  update(id: string, data: McpServerUpdate): { server?: McpServer; error?: string; notFound?: boolean }
  delete(id: string): { success: boolean; notFound?: boolean }

  // Validation
  validateCreate(data: McpServerCreate): ValidationResult

  // Connection Testing
  async testConnection(id: string): Promise<McpTestResult & { notFound?: boolean }>

  // Status
  async getStatus(): Promise<McpStatusResult>
}
```

---

## Patterns

### Singleton Pattern

All services and repositories use lazy singleton initialization:

```typescript
let instance: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!instance) {
    instance = new SessionService();
  }
  return instance;
}
```

**Why:** Services are stateless and thread-safe. Singletons avoid unnecessary instantiation and ensure consistent behavior.

### Repository Pattern

Repositories handle all database operations, providing:
- Type-safe queries via Drizzle ORM
- Record-to-entity transformation
- CRUD abstraction

```typescript
export class SessionRepository implements Repository<Session, SessionCreate, SessionUpdate> {
  findById(id: string): Session | null { /* ... */ }
  findAll(): Session[] { /* ... */ }
  create(data: SessionCreate): Session { /* ... */ }
  update(id: string, data: SessionUpdate): Session | null { /* ... */ }
  delete(id: string): boolean { /* ... */ }
}
```

### Result Types

Services return typed result objects for consistency:

```typescript
interface CreateSessionResult {
  session?: Session;
  error?: string;
}

interface UpdateAgentResult {
  agent?: Agent;
  error?: string;
  notFound?: boolean;
}
```

**Pattern:**
- Success: `{ entity: T }`
- Validation error: `{ error: "message" }`
- Not found: `{ notFound: true }`

---

## Dependency Graph

```
SessionService
    |
    +---> SessionRepository ---> db (sessions, agents tables)
    +---> AgentService (for getWithAgents)

AgentService
    |
    +---> AgentRepository ---> db (agents, items tables)

ItemService
    |
    +---> ItemRepository ---> db (items, agents, sessions tables)

ChatService (turn orchestrator)
    |
    +---> SessionService (resolve session, auto-title, touch timestamp)
    +---> AgentService (get agent, update status)
    +---> ItemService (persist user message)
    +---> StepPersistence (persist streaming steps)
    +---> ToolRegistry
    +---> AI Providers (getLanguageModel)
    +---> db (settings, systemPrompts tables)

PlanService
    |
    +---> PlanRepository ---> db (plans, planSteps tables)

SettingsService
    |
    +---> db (settings table)

SystemPromptService
    |
    +---> SettingsService (for clearing default on delete)
    +---> db (systemPrompts table)

FilesystemService
    |
    +---> Node.js fs module

ConversationSearchRepository
    |
    +---> db (items, agents, sessions tables)

McpService
    |
    +---> McpRepository ---> db (mcpServers table)
    +---> MCP Client Pool
```

---

## Adding a New Service

1. **Create directory:** `services/[domain]/`

2. **Create repository:** `[domain].repository.ts`
   ```typescript
   export class FooRepository implements Repository<Foo, FooCreate, FooUpdate> {
     findById(id: string): Foo | null { /* ... */ }
     // ... CRUD methods
   }

   let instance: FooRepository | null = null;
   export function getFooRepository(): FooRepository {
     if (!instance) instance = new FooRepository();
     return instance;
   }
   ```

3. **Create service:** `[domain].service.ts`
   ```typescript
   export class FooService {
     private repository: FooRepository;

     constructor(repository?: FooRepository) {
       this.repository = repository || getFooRepository();
     }

     // Business logic methods...
   }

   let instance: FooService | null = null;
   export function getFooService(): FooService {
     if (!instance) instance = new FooService();
     return instance;
   }
   ```

4. **Create index:** `[domain]/index.ts`
   ```typescript
   export { FooRepository, getFooRepository } from "./foo.repository";
   export { FooService, getFooService } from "./foo.service";
   export type { /* types */ } from "./foo.service";
   ```

5. **Export from main index:** Add to `services/index.ts`

---

## Testing

Services support dependency injection for testing:

```typescript
// In tests
const mockRepository = {
  findById: jest.fn().mockReturnValue({ id: "1", name: "Test" }),
  // ...
};

const service = new SessionService(mockRepository as unknown as SessionRepository);
```
