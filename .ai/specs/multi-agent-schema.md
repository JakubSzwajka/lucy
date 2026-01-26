# Multi-Agent System Schema Migration

## Overview

Migrate Lucy from a simple chat app to a multi-agent orchestration platform where:
- A **session** is the user-facing conversation container
- **Agents** are runtime instances that can form hierarchies (parent spawns children)
- **Items** are polymorphic conversation entries (messages, tool calls, results, reasoning)

## Target Schema

### 1. `sessions` (renamed from `conversations`)

User-facing conversation container.

```typescript
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Optional user association (for future multi-user support)
  userId: text("user_id"),

  // Points to the orchestrating agent for this session
  rootAgentId: text("root_agent_id"),

  // Display
  title: text("title").default("New Chat"),

  // Session lifecycle
  status: text("status", { enum: ["active", "archived"] }).default("active"),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

### 2. `agents` (new table)

Runtime instances with parent-child hierarchy.

```typescript
export const agentStatus = ["pending", "running", "waiting", "completed", "failed", "cancelled"] as const;

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Relationships
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references(() => agents.id, { onDelete: "cascade" }),

  // If spawned by a tool call, which one?
  sourceCallId: text("source_call_id"),

  // Task definition
  name: text("name").notNull(),                    // e.g., "orchestrator", "researcher", "coder"
  task: text("task"),                              // The goal/instruction for this agent
  systemPrompt: text("system_prompt"),             // Agent-specific system prompt
  model: text("model"),                            // Which model to use
  config: text("config", { mode: "json" }),        // Additional config (temperature, tools enabled, etc.)

  // Runtime state
  status: text("status", { enum: agentStatus }).default("pending"),
  waitingForCallId: text("waiting_for_call_id"),   // Blocked on this tool call
  result: text("result"),                          // Final result/output
  error: text("error"),                            // Error message if failed
  turnCount: integer("turn_count").default(0),     // Number of turns completed

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
```

### 3. `items` (replaces `messages`)

Polymorphic conversation entries per agent.

```typescript
export const itemType = ["message", "tool_call", "tool_result", "reasoning"] as const;
export const messageRole = ["user", "assistant", "system"] as const;
export const toolCallStatus = ["pending", "running", "completed", "failed"] as const;

export const items = sqliteTable("items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Belongs to an agent's conversation thread
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  // Ordering within the agent's thread
  sequence: integer("sequence").notNull(),

  // Discriminator for polymorphism
  type: text("type", { enum: itemType }).notNull(),

  // === TYPE: message ===
  role: text("role", { enum: messageRole }),
  content: text("content"),                        // Text content (can be JSON for structured)

  // === TYPE: tool_call ===
  callId: text("call_id"),                         // Unique ID for linking call → result
  toolName: text("tool_name"),                     // e.g., "web_search", "spawn_agent"
  toolArgs: text("tool_args", { mode: "json" }),   // Arguments passed to the tool
  toolStatus: text("tool_status", { enum: toolCallStatus }),

  // === TYPE: tool_result ===
  // Uses callId to link back to the tool_call
  toolOutput: text("tool_output"),                 // Result from tool execution
  toolError: text("tool_error"),                   // Error if tool failed

  // === TYPE: reasoning ===
  reasoningSummary: text("reasoning_summary"),     // Short displayable summary
  reasoningContent: text("reasoning_content"),     // Full thinking content

  // Metadata
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Index for efficient queries
// - Get all items for an agent, ordered by sequence
// - Find tool_result by callId
```

### Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           SESSION                               │
│  (user-facing conversation, has title, status)                  │
│                                                                 │
│  root_agent_id ─────────────────────────────────┐               │
└─────────────────────────────────────────────────┼───────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT (orchestrator)                       │
│  name: "orchestrator"                                           │
│  status: running                                                │
│  session_id: ←─────────────────────────────────────────────────┐│
│                                                                 │
│  items[] ──────────────────────────────────────────────────────┐│
│    ├── message (user: "Research AI agents and write summary")  ││
│    ├── reasoning (thinking about approach...)                  ││
│    ├── tool_call (spawn_agent, call_id: "abc123")              ││
│    │         │                                                 ││
│    │         └── source_call_id ────────────────────┐          ││
│    │                                                │          ││
│    ├── tool_result (call_id: "abc123", output...)  ◄┼──────┐   ││
│    └── message (assistant: "Here's the summary...")│      │   ││
└─────────────────────────────────────────────────────┼──────┼───┘│
                                                      │      │    │
                                                      ▼      │    │
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT (researcher)                         │
│  name: "researcher"                                             │
│  parent_id: orchestrator.id                                     │
│  source_call_id: "abc123" ──────────────────────────────────────┘
│  status: completed                                              │
│  result: "Research findings..." ────────────────────────────────┘
│                                                                 │
│  items[]                                                        │
│    ├── message (system: "You are a research agent...")          │
│    ├── message (user: "Research AI agents")                     │
│    ├── tool_call (web_search, call_id: "def456")                │
│    ├── tool_result (call_id: "def456", search results...)       │
│    ├── reasoning (analyzing results...)                         │
│    └── message (assistant: "Based on my research...")           │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Steps

### Step 1: Create New Schema

```bash
# Create new migration file
# renderer/src/lib/db/schema.ts - replace entire contents
```

### Step 2: Drop Old Tables, Create New

Since data loss is acceptable:

```typescript
// In a migration script or db:push
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

// Then create new tables via drizzle-kit push
```

### Step 3: Update API Routes

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `/api/conversations` | `/api/sessions` | CRUD for sessions |
| `/api/conversations/[id]` | `/api/sessions/[id]` | Single session |
| `/api/conversations/[id]/messages` | `/api/sessions/[id]/agents/[agentId]/items` | Items per agent |
| — | `/api/agents` | Agent management |
| — | `/api/agents/[id]` | Single agent CRUD |
| — | `/api/agents/[id]/items` | Items for an agent |
| `/api/chat` | `/api/agents/[id]/run` | Run agent turn |

### Step 4: Update Types

```typescript
// types/index.ts

export type ItemType = "message" | "tool_call" | "tool_result" | "reasoning";
export type AgentStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";
export type ToolCallStatus = "pending" | "running" | "completed" | "failed";

export interface Session {
  id: string;
  title: string;
  status: "active" | "archived";
  rootAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  sessionId: string;
  parentId: string | null;
  sourceCallId: string | null;
  name: string;
  task: string | null;
  systemPrompt: string | null;
  model: string | null;
  config: Record<string, unknown> | null;
  status: AgentStatus;
  waitingForCallId: string | null;
  result: string | null;
  error: string | null;
  turnCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface BaseItem {
  id: string;
  agentId: string;
  sequence: number;
  type: ItemType;
  createdAt: Date;
}

export interface MessageItem extends BaseItem {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCallItem extends BaseItem {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolStatus: ToolCallStatus;
}

export interface ToolResultItem extends BaseItem {
  type: "tool_result";
  callId: string;
  toolOutput: string | null;
  toolError: string | null;
}

export interface ReasoningItem extends BaseItem {
  type: "reasoning";
  reasoningSummary: string | null;
  reasoningContent: string;
}

export type Item = MessageItem | ToolCallItem | ToolResultItem | ReasoningItem;
```

### Step 5: Update Hook - `useAgentChat`

Replace `usePersistentChat` with `useAgentChat`:

```typescript
export function useAgentChat(sessionId: string, agentId: string) {
  // Load items for this agent
  // Stream new items during AI generation
  // Handle tool calls, results, reasoning
  // Support agent spawning
}
```

### Step 6: Update UI Components

```
SessionList (sidebar)
  └── AgentTree (shows agent hierarchy for selected session)
        └── AgentThread (items for selected agent)
              ├── MessageBubble (type: message)
              ├── ToolCallCard (type: tool_call)
              ├── ToolResultCard (type: tool_result)
              └── ReasoningBlock (type: reasoning, collapsible)
```

## Data Flow: User Sends Message

```
1. User types message in UI

2. POST /api/sessions/{sessionId}/agents/{agentId}/items
   → Creates item { type: "message", role: "user", content: "..." }
   → Returns item with sequence number

3. POST /api/agents/{agentId}/run
   → Starts agent execution
   → Streams response via SSE

4. During streaming, server creates items:
   → item { type: "reasoning", ... } (if model supports)
   → item { type: "tool_call", callId: "xxx", toolName: "...", status: "pending" }
   → [tool executes]
   → item { type: "tool_result", callId: "xxx", output: "..." }
   → item { type: "message", role: "assistant", content: "..." }

5. If tool is "spawn_agent":
   → Create new Agent { parentId: currentAgent, sourceCallId: "xxx" }
   → Run child agent
   → When child completes, create tool_result with child's result
   → Continue parent agent execution

6. UI updates in real-time via streaming
```

## Special Tool: `spawn_agent`

Built-in tool that creates child agents:

```typescript
const spawnAgentTool = {
  name: "spawn_agent",
  description: "Spawn a specialized sub-agent to handle a specific task",
  parameters: {
    name: { type: "string", description: "Name/role of the agent" },
    task: { type: "string", description: "The task for this agent" },
    systemPrompt: { type: "string", description: "System prompt for the agent" },
    model: { type: "string", description: "Model to use (optional)" },
  },
  execute: async ({ name, task, systemPrompt, model }, context) => {
    // 1. Create agent record
    const childAgent = await db.insert(agents).values({
      sessionId: context.sessionId,
      parentId: context.agentId,
      sourceCallId: context.callId,
      name,
      task,
      systemPrompt,
      model: model || context.parentModel,
      status: "pending",
    });

    // 2. Run the child agent
    const result = await runAgent(childAgent.id);

    // 3. Return result to parent
    return result;
  },
};
```

## Sequence Numbers

Items are ordered by `sequence` within each agent. When inserting:

```typescript
const nextSequence = await db
  .select({ max: sql`MAX(sequence)` })
  .from(items)
  .where(eq(items.agentId, agentId));

await db.insert(items).values({
  agentId,
  sequence: (nextSequence[0]?.max ?? -1) + 1,
  // ... rest of item
});
```

## UI Considerations

### Session View (Main Chat)
- Shows the root agent's items by default
- Tree view in sidebar showing agent hierarchy
- Click on child agent to view its thread
- Collapsible tool calls showing input/output
- Collapsible reasoning blocks

### Agent Status Indicators
- 🟡 pending - Agent created, not started
- 🔵 running - Agent actively processing
- 🟠 waiting - Agent blocked on tool call (e.g., child agent)
- 🟢 completed - Agent finished successfully
- 🔴 failed - Agent encountered error
- ⚫ cancelled - Agent was stopped

### Real-time Updates
- Stream items as they're created
- Update tool_call status (pending → running → completed)
- Update agent status in tree view
- Auto-scroll to new items

## Files to Modify

1. `renderer/src/lib/db/schema.ts` - New schema
2. `renderer/src/types/index.ts` - New types
3. `renderer/src/app/api/sessions/` - New routes (replaces conversations)
4. `renderer/src/app/api/agents/` - New routes
5. `renderer/src/hooks/useAgentChat.ts` - New hook (replaces usePersistentChat)
6. `renderer/src/components/chat/` - Update components for items
7. `renderer/src/components/sidebar/` - Agent tree view
8. `renderer/src/app/page.tsx` - Wire up new components

## Implementation Order

1. **Schema** - Define tables, run migration
2. **Types** - Define TypeScript interfaces
3. **API: Sessions** - Basic CRUD
4. **API: Agents** - Basic CRUD + run endpoint
5. **API: Items** - CRUD with sequence handling
6. **Hook: useAgentChat** - Load items, stream updates
7. **UI: Item rendering** - Message, ToolCall, ToolResult, Reasoning components
8. **UI: Agent tree** - Show hierarchy in sidebar
9. **Streaming** - Wire up real-time item creation
10. **spawn_agent tool** - Enable multi-agent orchestration

## Open Questions

1. **Tool registry** - Where do we define available tools per agent?
2. **Max depth** - Should we limit agent hierarchy depth?
3. **Concurrent agents** - Can multiple child agents run in parallel?
4. **Agent templates** - Pre-defined agent configurations?
5. **Item attachments** - File uploads, images in items?
