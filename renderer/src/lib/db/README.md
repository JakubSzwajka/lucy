# Database

> **Note:** This is the **desktop-only** database. The cloud backend (`backend/`) has its own database with additional `users` table and `userId` columns on all data tables. In the current architecture, the frontend connects to the backend database via API calls.

SQLite database using Drizzle ORM. Schema defined in `renderer/src/lib/db/schema.ts`.

## Entity Relationship

```
sessions
    │
    ├── rootAgentId ──────────────────┐
    │                                 │
    ├─── 1:many ───► agents ◄─────────┘
    │                   │
    │                   ├── parentId (self-referential hierarchy)
    │                   │
    │                   └─── 1:many ───► items (polymorphic)
    │
    └─── 1:1 ───► plans
                    │
                    └─── 1:many ───► planSteps
```

## Tables

### sessions

User-facing conversation container.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `userId` | text | Future multi-user support |
| `rootAgentId` | text | Points to orchestrating agent |
| `title` | text | Display title |
| `status` | enum | `active` \| `archived` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### agents

Runtime instances with parent-child hierarchy. Agents can spawn child agents via tool calls.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `sessionId` | text | FK to sessions (CASCADE delete) |
| `parentId` | text | Self-reference for hierarchy |
| `sourceCallId` | text | Tool call that spawned this agent |
| `name` | text | Agent type (e.g., "orchestrator", "researcher") |
| `task` | text | Goal/instruction for this agent |
| `systemPrompt` | text | Agent-specific system prompt |
| `model` | text | Which model to use |
| `config` | json | Additional configuration |
| `status` | enum | `pending` \| `running` \| `waiting` \| `completed` \| `failed` \| `cancelled` |
| `waitingForCallId` | text | Blocked on this tool call |
| `result` | text | Final output |
| `error` | text | Error message if failed |
| `turnCount` | integer | Number of turns completed |
| `createdAt` | timestamp | |
| `startedAt` | timestamp | |
| `completedAt` | timestamp | |

**Indexes:** `sessionId`, `parentId`

### items

Polymorphic conversation entries per agent. Discriminated by `type` field.

| Column | Type | Used By | Description |
|--------|------|---------|-------------|
| `id` | text | all | Primary key |
| `agentId` | text | all | FK to agents (CASCADE delete) |
| `sequence` | integer | all | Ordering within thread |
| `type` | enum | all | `message` \| `tool_call` \| `tool_result` \| `reasoning` |
| `role` | enum | message | `user` \| `assistant` \| `system` |
| `content` | text | message | Message content |
| `callId` | text | tool_call, tool_result | Links call to result |
| `toolName` | text | tool_call | Tool name |
| `toolArgs` | json | tool_call | Tool arguments |
| `toolStatus` | enum | tool_call | `pending` \| `pending_approval` \| `running` \| `completed` \| `failed` |
| `toolOutput` | text | tool_result | Tool output |
| `toolError` | text | tool_result | Tool error |
| `reasoningSummary` | text | reasoning | Summary of reasoning |
| `reasoningContent` | text | reasoning | Full reasoning content |
| `createdAt` | timestamp | all | |

**Indexes:** `(agentId, sequence)`, `callId`

### plans

Execution plans owned by orchestrator agents. One plan per session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `sessionId` | text | FK to sessions (CASCADE delete) |
| `agentId` | text | FK to agents (CASCADE delete) |
| `title` | text | Plan title |
| `description` | text | Optional context/goal |
| `status` | enum | `pending` \| `in_progress` \| `completed` \| `failed` \| `cancelled` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `completedAt` | timestamp | |

**Indexes:** `sessionId`, `agentId`

### planSteps

Individual steps within a plan.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `planId` | text | FK to plans (CASCADE delete) |
| `sequence` | integer | Step ordering |
| `description` | text | What this step accomplishes |
| `assignedAgentId` | text | FK to agents (SET NULL on delete) |
| `status` | enum | `pending` \| `in_progress` \| `completed` \| `failed` \| `skipped` |
| `result` | text | Outcome summary |
| `error` | text | Error message |
| `createdAt` | timestamp | |
| `startedAt` | timestamp | |
| `completedAt` | timestamp | |

**Indexes:** `planId`, `assignedAgentId`, `(planId, sequence)`

### systemPrompts

Reusable system prompts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `name` | text | Display name |
| `content` | text | Prompt content |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### settings

App-wide settings (single row with id="default").

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Fixed "default" |
| `defaultModelId` | text | Default model |
| `defaultSystemPromptId` | text | Default prompt |
| `enabledModels` | json | Array of enabled model IDs |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### mcpServers

Model Context Protocol external tool providers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `name` | text | Display name |
| `description` | text | |
| `transportType` | enum | `stdio` \| `sse` \| `http` |
| `command` | text | Stdio: executable command |
| `args` | json | Stdio: command arguments |
| `env` | json | Stdio: environment variables |
| `url` | text | HTTP/SSE: server URL |
| `headers` | json | HTTP/SSE: request headers |
| `requireApproval` | boolean | Require user approval for tools |
| `enabled` | boolean | |
| `iconUrl` | text | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### sessionMcpServers

Junction table for session-to-MCP server mapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `sessionId` | text | FK to sessions |
| `mcpServerId` | text | FK to mcpServers |
| `createdAt` | timestamp | |

### integrations

Third-party service integrations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (e.g., "todoist", "knowledge") |
| `name` | text | Display name |
| `enabled` | boolean | |
| `credentials` | json | Service credentials |
| `config` | json | Integration-specific config |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

## Type Exports

```typescript
// Sessions
type SessionRecord = typeof sessions.$inferSelect;
type NewSession = typeof sessions.$inferInsert;

// Agents
type AgentRecord = typeof agents.$inferSelect;
type NewAgent = typeof agents.$inferInsert;
type AgentStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

// Items
type ItemRecord = typeof items.$inferSelect;
type NewItem = typeof items.$inferInsert;
type ItemType = "message" | "tool_call" | "tool_result" | "reasoning";
type MessageRole = "user" | "assistant" | "system";
type ToolCallStatus = "pending" | "pending_approval" | "running" | "completed" | "failed";

// Plans
type PlanRecord = typeof plans.$inferSelect;
type NewPlan = typeof plans.$inferInsert;
type PlanStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

type PlanStepRecord = typeof planSteps.$inferSelect;
type NewPlanStep = typeof planSteps.$inferInsert;
type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

// MCP
type McpTransportType = "stdio" | "sse" | "http";
type McpServerRecord = typeof mcpServers.$inferSelect;

// Integrations
type IntegrationRecord = typeof integrations.$inferSelect;
```

## Usage

```typescript
import { db } from "@/lib/db";
import { sessions, agents, items } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Get session with root agent
const session = await db.query.sessions.findFirst({
  where: eq(sessions.id, sessionId),
});

// Get agent hierarchy
const agentTree = await db.query.agents.findMany({
  where: eq(agents.sessionId, sessionId),
});

// Get conversation thread for an agent
const thread = await db.query.items.findMany({
  where: eq(items.agentId, agentId),
  orderBy: items.sequence,
});
```

## Database Location

- **Development:** `lucy.db` in project root
- **Production:** User data directory (via `LUCY_USER_DATA_PATH` env var)
