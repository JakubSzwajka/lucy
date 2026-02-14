# PRD: Agent Configurations

> **Status**: V1 Complete (all 6 phases implemented)
> **Author**: Human + Claude
> **Created**: 2026-02-13

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Conceptual Model](#3-conceptual-model)
4. [Data Model](#4-data-model)
5. [Tool Resolution Changes](#5-tool-resolution-changes)
6. [Multi-Agent Delegation](#6-multi-agent-delegation)
7. [System Prompt & Model Resolution](#7-system-prompt--model-resolution)
8. [API Routes](#8-api-routes)
9. [Session Creation Changes](#9-session-creation-changes)
10. [Frontend Changes](#10-frontend-changes)
11. [Implementation Phases](#11-implementation-phases)
12. [Files to Modify](#12-files-to-modify)
13. [Files to Create](#13-files-to-create)
14. [README Updates Required](#14-readme-updates-required)
15. [Edge Cases & Error Handling](#15-edge-cases--error-handling)
16. [Implementation Progress & Notes](#16-implementation-progress--notes)
17. [Out of Scope for V1](#17-out-of-scope-for-v1)

---

## 1. Problem Statement

Today, Lucy has no concept of a reusable agent profile. Every session creates a blank root agent with nullable `systemPrompt`, `model`, and `config` fields. The system prompt and model are resolved lazily from global user defaults at chat time. All enabled MCP servers and all builtin tool modules are available to every agent.

There is no way to say: "I want an agent that uses Claude Opus, has the 'Code Review' system prompt, only has GitHub + filesystem MCP tools, and has memory recall enabled but plan tools disabled."

There is also no mechanism for agents to delegate work to other agents.

## 2. Solution Overview

Introduce **Agent Configs** — reusable, per-user templates that define an agent's identity:

- **System prompt** (reference to existing `systemPrompts` table or inline override)
- **Default model** (override for user-global default)
- **Allowed tools** (which MCP servers, which builtin modules, which other agent configs can be delegated to)
- **Max turns** (safety limit for autonomous sub-agent execution)
- **Visual identity** (icon, color for the UI picker)

The core principle: **everything is a tool**. MCP servers provide tools. Builtin modules (memory, notes, plan, continuity) provide tools. Other agent configs become delegate tools. The agent config simply defines which tools are allowed.

### Key Relationships

```
agentConfigs  (blueprint, reusable, per-user)
     │
     │  "instantiated as"
     ▼
agents        (runtime instance, per-session, ephemeral)
     │
     │  "belongs to"
     ▼
sessions      (workspace/conversation container)
```

- **`agentConfigs`** = Class / Docker image / Blueprint
- **`agents`** = Instance / Docker container / Running process
- **`sessions`** = Workspace that orchestrates one or more agent instances

## 3. Conceptual Model

### How Items Are Stored

Items (messages, tool calls, tool results, reasoning) are stored **per agent, not per session**. Each item has an `agentId` FK. A session is just a container; the conversation lives on agents.

```
SESSION (id: S1, rootAgentId: A1)
│
└─ AGENT A1 (root)
     ├─ ITEM: message (user)
     ├─ ITEM: message (assistant)
     ├─ ITEM: tool_call
     ├─ ITEM: tool_result
     └─ ...
```

### How Multi-Agent Works

When a root agent delegates to a sub-agent, the sub-agent is created **within the same session** as a child agent. The existing `agents.parentId` and `agents.sourceCallId` columns track the relationship.

```
SESSION (id: S1, rootAgentId: A1)
│
└─ AGENT A1 (root, agentConfigId: "orchestrator")
     ├─ ITEM: message, role=user
     │    "Help me review this PR for security issues"
     │
     ├─ ITEM: message, role=assistant
     │    "I'll delegate this to the security reviewer..."
     │
     ├─ ITEM: tool_call, id=TC1
     │    name: "delegate_to_reviewer"
     │    args: { task: "Review PR #123. Here's the diff: ..." }
     │    │
     │    │── creates ──▶ AGENT A2 (child, parentId=A1, sourceCallId=TC1,
     │    │                         agentConfigId: "security-reviewer")
     │    │                 │
     │    │                 ├─ ITEM: message, role=user
     │    │                 │    "Review PR #123. Here's the diff: ..."
     │    │                 │
     │    │                 ├─ ITEM: tool_call (A2 uses its own tools)
     │    │                 ├─ ITEM: tool_result
     │    │                 │
     │    │                 ├─ ITEM: message, role=assistant
     │    │                 │    "Found SQL injection risk. Question: ORM or raw queries?"
     │    │                 │
     │    │                 └─ status=completed, result="Found SQL injection risk..."
     │    │
     ├─ ITEM: tool_result (for TC1)
     │    "Found SQL injection risk. Question: ORM or raw queries?"
     │
     ├─ ITEM: message, role=assistant  ← ROOT AGENT THINKS
     │    "The reviewer needs more context. We use Drizzle ORM..."
     │
     ├─ ITEM: tool_call, id=TC2
     │    name: "continue_agent"
     │    args: { agentId: "A2", message: "We use Drizzle ORM with parameterized queries..." }
     │    │
     │    │── continues ──▶ AGENT A2 (same agent, resumes with full history)
     │    │                   │
     │    │                   ├─ (all previous items still here)
     │    │                   │
     │    │                   ├─ ITEM: message, role=user  ← NEW
     │    │                   │    "We use Drizzle ORM with parameterized queries..."
     │    │                   │
     │    │                   ├─ ITEM: message, role=assistant
     │    │                   │    "With Drizzle, SQL injection is mitigated. Found 2 other issues..."
     │    │                   │
     │    │                   └─ status=completed, result="2 issues found: XSS, missing CSRF..."
     │    │
     ├─ ITEM: tool_result (for TC2)
     │    "2 issues found: XSS in line 42, missing CSRF token..."
     │
     └─ ITEM: message, role=assistant
          "The security review found 2 issues in your PR: ..."  ← BACK TO USER
```

### Context Passing

The root agent decides what context to pass to sub-agents. The task argument in `delegate_to_X({ task: "..." })` is the root agent's compiled context — it knows what the user wants and how to instruct the sub-agent. The sub-agent receives this as its initial user message alongside its own system prompt from its agent config.

### One-Turn vs Multi-Turn

- **V1**: One tool call = one sub-agent lifecycle. The sub-agent runs autonomously (up to `maxTurns`), returns a result.
- **Multi-turn**: The root agent can call `continue_agent({ agentId, message })` to resume a completed sub-agent with additional context. The sub-agent keeps its full item history across continuations.
- **No direct back-and-forth**: Sub-agents cannot initiate communication. Only the root (or parent) agent decides when to continue a conversation.

## 4. Data Model

### New Table: `agentConfigs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT PK | No | UUID | Unique identifier |
| `userId` | TEXT FK → users | No | | Owner (multi-user scoping) |
| `name` | TEXT | No | | Display name (e.g. "Code Reviewer") |
| `description` | TEXT | Yes | | Short description of the agent's purpose |
| `systemPromptId` | TEXT FK → systemPrompts | Yes | | Reference to saved system prompt |
| `systemPromptOverride` | TEXT | Yes | | Inline prompt text (used if `systemPromptId` is null) |
| `defaultModelId` | TEXT | Yes | | Model override (null = use user default) |
| `maxTurns` | INTEGER | Yes | 25 | Safety limit for autonomous sub-agent execution |
| `icon` | TEXT | Yes | | Emoji or icon identifier for UI |
| `color` | TEXT | Yes | | Hex color for UI |
| `isDefault` | BOOLEAN | No | false | Is this the user's default config? (one per user) |
| `createdAt` | TIMESTAMP | No | now() | |
| `updatedAt` | TIMESTAMP | No | now() | |

**Index**: `(userId)` for listing user's configs.

### New Table: `agentConfigTools`

Unified junction table for all tool types (MCP servers, builtin modules, delegate agent configs).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT PK | No | UUID |
| `agentConfigId` | TEXT FK → agentConfigs (CASCADE) | No | Parent config |
| `toolType` | TEXT ENUM: `mcp` \| `builtin` \| `delegate` | No | What kind of tool reference |
| `toolRef` | TEXT | No | Reference ID: mcpServerId, builtinModuleId, or agentConfigId |
| `toolName` | TEXT | Yes | Custom name override for delegates (e.g. "ask_researcher") |
| `toolDescription` | TEXT | Yes | Custom description override for delegates |

**Composite unique**: `(agentConfigId, toolType, toolRef)` — prevent duplicates.

**Index**: `(agentConfigId)` for loading config tools.

**Note on stale references**: MCP servers and builtin modules can be deleted/removed independently. At tool resolution time, missing references are skipped gracefully with a warning log. The config management UI should show a "missing tool" indicator.

### Schema Changes to Existing Tables

**`sessions` table** — add column:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `agentConfigId` | TEXT FK → agentConfigs (SET NULL) | Yes | Which config was used to create this session |

**`agents` table** — add column:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `agentConfigId` | TEXT FK → agentConfigs (SET NULL) | Yes | Blueprint this agent was instantiated from |

Both FKs use `SET NULL` on delete — if a config is deleted, existing sessions/agents keep working but lose the reference.

### Current Builtin Module IDs

These are the valid `toolRef` values when `toolType = "builtin"`:

| Module ID | Name | Description | File |
|-----------|------|-------------|------|
| `memory` | Memory | Recall and save memories | `backend/src/lib/tools/modules/memory/index.ts` |
| `notes` | Notes | Session-scoped notes | `backend/src/lib/tools/modules/notes/index.ts` |
| `plan` | Plan | Multi-step plan tracking | `backend/src/lib/tools/modules/plan/index.ts` |
| `continuity` | Continuity | Context continuity tools | `backend/src/lib/tools/modules/continuity/index.ts` |

## 5. Tool Resolution Changes

### Current Flow (in `ChatService.prepareChat()`)

```
1. initializeToolRegistry()
2. McpToolProvider.refreshServers() → connects ALL enabled MCP servers
3. registry.toAiSdkTools() → returns ALL tools from ALL providers
```

### New Flow

```
1. initializeToolRegistry()  (unchanged)
2. Load agent's agentConfigId → fetch agentConfig + agentConfigTools rows
3. Build tool allowlist from agentConfigTools:
   a. MCP tools: only connect servers where toolType="mcp" and toolRef is in allowlist
   b. Builtin tools: only include modules where toolType="builtin" and moduleId is in allowlist
   c. Delegate tools: for each toolType="delegate", generate delegate_to_X and add to tools
4. Also generate the generic "continue_agent" tool (always available if any delegates exist)
5. registry.toAiSdkTools(context, allowlist) → returns FILTERED tools
```

### Backward Compatibility

If an agent has **no `agentConfigId`** (legacy sessions), all tools are available as before. The filtering only applies when an agent config is set.

### Where to Modify

**File**: `backend/src/lib/tools/registry.ts`

Add a method: `toAiSdkTools(contextPartial, filter?: ToolFilter)` where `ToolFilter` specifies allowed MCP server IDs and builtin module IDs. If filter is undefined, return all tools (backward compat).

**File**: `backend/src/lib/services/chat/chat.service.ts`

In `prepareChat()`:
1. After fetching agent, check `agent.agentConfigId`
2. If set, load config + config tools from DB
3. Build `ToolFilter` object
4. Pass filter to `registry.toAiSdkTools()`
5. Generate delegate tools and add them to the tools map

**File**: `backend/src/lib/tools/providers/mcp.ts`

`McpToolProvider.getTools()` needs to accept an optional `allowedServerIds: string[]` parameter. If provided, only return tools from those servers.

**File**: `backend/src/lib/tools/providers/builtin.ts`

`BuiltinToolProvider.getTools()` needs to accept an optional `allowedModuleIds: string[]` parameter. If provided, only return tools from those modules.

## 6. Multi-Agent Delegation

### Two New Tools

These are **not** registered as builtin tool modules. They are dynamically generated by the ChatService based on the agent config's delegate entries.

#### 6.1 `delegate_to_<name>`

One tool per delegate entry in `agentConfigTools` where `toolType = "delegate"`.

**Tool name**: `toolName` from the config row, or auto-generated as `delegate_to_<configName>` (slugified).

**Input schema**:
```typescript
{
  task: string  // Required. The context/instruction for the sub-agent.
}
```

**Execution flow**:
1. Load the target `agentConfig` by `toolRef` (which is the delegate's `agentConfigId`)
2. Create a new child agent row in `agents` table:
   - `sessionId`: same as parent
   - `parentId`: current agent's ID
   - `sourceCallId`: current tool call ID
   - `agentConfigId`: the delegate config's ID
   - `name`: delegate config's name
   - `task`: the task argument
   - `systemPrompt`: resolved from delegate config (see Section 7)
   - `model`: resolved from delegate config
   - `status`: "running"
3. Create initial item for child agent: `type=message, role=user, content=task`
4. Run the child agent's execution loop:
   - Call `prepareChat()` with the child agent's ID (this resolves tools from the CHILD's config)
   - Call `streamText()` / `generateText()` with the child's messages
   - Process tool calls, persist items
   - Repeat until: assistant produces a final text response with no tool calls, OR `maxTurns` reached
5. Write `agent.result` with the final response
6. Set `agent.status` = "completed"
7. Return `agent.result` to the parent's tool call

**Where to implement**: New file `backend/src/lib/services/agent/agent-execution.service.ts` — handles the sub-agent execution loop. The ChatService currently handles the root agent's streaming loop; the sub-agent loop is similar but non-streaming (it runs to completion and returns a result).

#### 6.2 `continue_agent`

A single generic tool, available whenever the agent has any delegate tools.

**Input schema**:
```typescript
{
  agentId: string  // Required. The child agent to continue.
  message: string  // Required. New context/instruction to send.
}
```

**Execution flow**:
1. Validate that `agentId` references a child agent where `parentId` = current agent
2. Validate child agent's status is "completed" or "waiting" (can't continue a running agent)
3. Append new item to child agent: `type=message, role=user, content=message`
4. Set child agent `status` = "running"
5. Run the child agent's execution loop (same as above, with full item history)
6. Update `agent.result` with new final response
7. Set `agent.status` = "completed"
8. Return new `agent.result`

**Safety**: The `continue_agent` tool checks that the caller is the parent. An agent cannot continue an agent it didn't spawn.

### maxTurns Enforcement

During the sub-agent execution loop, track turns. If `turnCount >= agentConfig.maxTurns`:
1. Stop the loop
2. Set `agent.status` = "completed"
3. Set `agent.result` to whatever the last assistant message was, plus a note: "[max turns reached]"
4. Return to parent

## 7. System Prompt & Model Resolution

### System Prompt Resolution (priority order)

1. `agent.systemPrompt` — explicit override on the agent instance (set by parent or tool)
2. `agentConfig.systemPromptOverride` — inline text on the config
3. `agentConfig.systemPromptId` → look up `systemPrompts.content`
4. `settings.defaultSystemPromptId` → look up content (user's global default)
5. `null` — no system prompt

### Model Resolution (priority order)

1. `agent.model` — explicit override on the agent instance
2. `agentConfig.defaultModelId`
3. `settings.defaultModelId` (user's global default)

### Where to Modify

**File**: `backend/src/lib/services/chat/chat.service.ts`

Update `resolveSystemPrompt()` to check agentConfig between agent and user defaults. Update model resolution in `prepareChat()` similarly.

## 8. API Routes

### New Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/agent-configs` | List user's configs |
| POST | `/api/agent-configs` | Create new config |
| GET | `/api/agent-configs/[id]` | Get config with tools list |
| PUT | `/api/agent-configs/[id]` | Update config (including tools) |
| DELETE | `/api/agent-configs/[id]` | Delete config (SET NULL on sessions/agents) |

### Request/Response Schemas

#### POST `/api/agent-configs`

```typescript
// Request
{
  name: string;                   // Required
  description?: string;
  systemPromptId?: string;        // FK to systemPrompts
  systemPromptOverride?: string;  // Inline prompt (mutually exclusive with systemPromptId)
  defaultModelId?: string;
  maxTurns?: number;              // Default: 25
  icon?: string;
  color?: string;
  isDefault?: boolean;
  tools?: {                       // Tool allowlist
    type: "mcp" | "builtin" | "delegate";
    ref: string;                  // mcpServerId | moduleId | agentConfigId
    toolName?: string;            // Custom name (delegates only)
    toolDescription?: string;     // Custom description (delegates only)
  }[];
}

// Response: full AgentConfig object with tools array
```

#### GET `/api/agent-configs/[id]`

```typescript
// Response
{
  id: string;
  name: string;
  description: string | null;
  systemPromptId: string | null;
  systemPromptOverride: string | null;
  systemPrompt?: {                // Populated if systemPromptId is set
    id: string;
    name: string;
    content: string;
  };
  defaultModelId: string | null;
  maxTurns: number;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  tools: {
    type: "mcp" | "builtin" | "delegate";
    ref: string;
    toolName: string | null;
    toolDescription: string | null;
    // Resolved metadata (for display):
    resolvedName?: string;        // MCP server name, module name, or delegate config name
    resolvedExists?: boolean;     // Whether the referenced entity still exists
  }[];
  createdAt: string;
  updatedAt: string;
}
```

### Existing Route Changes

#### POST `/api/sessions` — add `agentConfigId`

```typescript
// Updated request
{
  title?: string;
  agentConfigId?: string;  // NEW: which agent config to use
}
```

When `agentConfigId` is provided:
- Store it on the session row
- Store it on the root agent row
- System prompt, model, and tools will be resolved from the config at chat time

## 9. Session Creation Changes

### Current Flow

**File**: `backend/src/lib/services/session/session.repository.ts` → `create()`

```
1. Generate sessionId, agentId
2. Insert session (rootAgentId = agentId)
3. Insert root agent (name="assistant", systemPrompt=null, model=null, status="pending")
```

### New Flow

```
1. Generate sessionId, agentId
2. If agentConfigId provided:
   a. Validate config exists and belongs to user
   b. Load config for name
3. Insert session (rootAgentId = agentId, agentConfigId = agentConfigId)
4. Insert root agent:
   - name: config.name or "assistant"
   - agentConfigId: agentConfigId
   - systemPrompt: null (resolved at chat time from config)
   - model: null (resolved at chat time from config)
   - status: "pending"
```

If no `agentConfigId` is provided, check if user has a default config (`isDefault = true`). If so, use it. Otherwise, create session with no config (backward compat — all tools available).

### Where to Modify

- `backend/src/lib/services/session/session.repository.ts` — accept `agentConfigId`
- `backend/src/lib/services/session/session.service.ts` — pass through, validate config exists
- `backend/src/app/api/sessions/route.ts` — accept `agentConfigId` in POST body

## 10. Frontend Changes

### Settings Page: Agent Config Management

**Location**: New section in settings page (or new page linked from settings).

UI for CRUD of agent configs:
- List of configs with name, icon, description
- Create/edit form:
  - Name, description, icon picker, color picker
  - System prompt: dropdown (from existing `systemPrompts`) OR inline text editor
  - Model: dropdown (from `settings.enabledModels`)
  - MCP servers: checkboxes (from user's `mcpServers`)
  - Builtin tools: checkboxes for each module (memory, notes, plan, continuity)
  - Delegate agents: multi-select from other agent configs (circular refs prevented)
  - Max turns: number input (default 25)
  - "Set as default" toggle

### New Chat: Agent Config Picker

When user clicks "New Chat":
1. Show a picker with user's agent configs (grid or list with icons/colors)
2. Default config is pre-selected
3. User selects one → session created with that `agentConfigId`
4. Quick path: if user has only one config, skip the picker

### Existing Frontend Files to Modify

| File | Change |
|------|--------|
| `desktop/renderer/src/lib/api/client.ts` | Add agent-config API methods |
| `desktop/renderer/src/hooks/useSessions.ts` | Pass `agentConfigId` to session creation |
| `desktop/renderer/src/components/sidebar/` | Show agent config icon/name on session items |

### New Frontend Files

| File | Purpose |
|------|---------|
| `desktop/renderer/src/hooks/useAgentConfigs.ts` | CRUD hook for agent configs |
| `desktop/renderer/src/components/agent-configs/` | Config management UI |
| `desktop/renderer/src/components/agent-config-picker/` | New chat picker |

## 11. Implementation Phases

### Phase 1: Data Model + CRUD API

**Goal**: Agent configs exist in DB and can be managed via API.

Tasks:
1. Add `agentConfigs` table to `backend/src/lib/db/schema.ts`
2. Add `agentConfigTools` table to `backend/src/lib/db/schema.ts`
3. Add `agentConfigId` column to `sessions` and `agents` tables
4. Create `AgentConfigRepository` at `backend/src/lib/services/agent-config/agent-config.repository.ts`
5. Create `AgentConfigService` at `backend/src/lib/services/agent-config/agent-config.service.ts`
6. Create API routes at `backend/src/app/api/agent-configs/route.ts` and `backend/src/app/api/agent-configs/[id]/route.ts`
7. Push schema changes: `npm run db:push`
8. Write README for the new agent-config service module

### Phase 2: Tool Filtering

**Goal**: Agent configs control which tools are available at chat time.

Tasks:
1. Add `ToolFilter` type to `backend/src/lib/tools/types.ts`
2. Update `ToolRegistry.toAiSdkTools()` to accept `ToolFilter` in `backend/src/lib/tools/registry.ts`
3. Update `McpToolProvider.getTools()` to accept `allowedServerIds` in `backend/src/lib/tools/providers/mcp.ts`
4. Update `BuiltinToolProvider.getTools()` to accept `allowedModuleIds` in `backend/src/lib/tools/providers/builtin.ts`
5. Update `ChatService.prepareChat()` to load agent config and build `ToolFilter` in `backend/src/lib/services/chat/chat.service.ts`
6. Update system prompt resolution in `ChatService.resolveSystemPrompt()` to check agent config
7. Update model resolution in `ChatService.prepareChat()` to check agent config

### Phase 3: Session Creation Integration

**Goal**: Sessions can be created with an agent config.

Tasks:
1. Update `SessionRepository.create()` to accept and store `agentConfigId`
2. Update `SessionService.create()` to validate config and pass through
3. Update `POST /api/sessions` route to accept `agentConfigId`
4. Add default config fallback (if user has a default config and none specified)

### Phase 4: Multi-Agent Delegation

**Goal**: Agents can delegate to sub-agents and continue conversations.

Tasks:
1. Create `AgentExecutionService` at `backend/src/lib/services/agent/agent-execution.service.ts`
   - Implements the sub-agent execution loop (non-streaming)
   - Handles maxTurns enforcement
   - Manages agent status lifecycle (running → completed)
2. Create delegate tool generator in `backend/src/lib/tools/delegate/` (new module)
   - Generates `delegate_to_<name>` tools from config's delegate entries
   - Generates `continue_agent` tool
3. Integrate delegate tools into `ChatService.prepareChat()`
   - After loading tool filter, generate delegate tools and merge into tools map
4. Update `ToolExecutionContext` in `backend/src/lib/tools/types.ts` if needed
5. Add `DelegateToolSource` to `ToolSource` union type

### Phase 5: Frontend — Settings

**Goal**: Users can create and manage agent configs in the desktop app.

Tasks:
1. Create `useAgentConfigs` hook
2. Create agent config list component
3. Create agent config create/edit form
4. Integrate into settings page

### Phase 6: Frontend — New Chat Picker

**Goal**: Users select an agent config when starting a new chat.

Tasks:
1. Create agent config picker component
2. Integrate into new chat flow (sidebar "New Chat" button)
3. Show config identity on session items in sidebar
4. Handle "no configs" state (create first config prompt, or use legacy behavior)

## 12. Files to Modify

| File | Changes |
|------|---------|
| `backend/src/lib/db/schema.ts` | Add `agentConfigs`, `agentConfigTools` tables; add `agentConfigId` to `sessions` and `agents` |
| `backend/src/lib/db/index.ts` | No changes needed (auto-picks up schema) |
| `backend/src/lib/services/chat/chat.service.ts` | Tool filtering in `prepareChat()`, system prompt + model resolution from config, delegate tool generation |
| `backend/src/lib/services/session/session.service.ts` | Accept `agentConfigId`, default config fallback |
| `backend/src/lib/services/session/session.repository.ts` | Store `agentConfigId` on session + root agent |
| `backend/src/lib/services/agent/agent.service.ts` | No direct changes (used as-is by execution service) |
| `backend/src/lib/services/agent/agent.repository.ts` | No direct changes |
| `backend/src/lib/tools/types.ts` | Add `ToolFilter` type, add `DelegateToolSource`, possibly extend `ToolExecutionContext` |
| `backend/src/lib/tools/registry.ts` | Add filter parameter to `toAiSdkTools()` and `getAllTools()` |
| `backend/src/lib/tools/providers/mcp.ts` | Accept `allowedServerIds` filter in `getTools()` |
| `backend/src/lib/tools/providers/builtin.ts` | Accept `allowedModuleIds` filter in `getTools()` |
| `backend/src/lib/tools/index.ts` | Export new types, possibly register delegate provider |
| `backend/src/app/api/sessions/route.ts` | Accept `agentConfigId` in POST |
| `backend/src/app/api/settings/route.ts` | No changes (settings stays as user-global defaults) |
| `desktop/renderer/src/lib/api/client.ts` | Add agent-config CRUD methods |
| `desktop/renderer/src/hooks/useSessions.ts` | Pass `agentConfigId` to session creation |
| `desktop/renderer/src/components/sidebar/SessionItem.tsx` | Show config icon/name |

## 13. Files to Create

| File | Purpose |
|------|---------|
| `backend/src/lib/services/agent-config/agent-config.repository.ts` | DB operations for agent configs + config tools |
| `backend/src/lib/services/agent-config/agent-config.service.ts` | Business logic: CRUD, validation, default management |
| `backend/src/lib/services/agent-config/index.ts` | Barrel export |
| `backend/src/lib/services/agent-config/README.md` | Module documentation |
| `backend/src/lib/services/agent/agent-execution.service.ts` | Sub-agent execution loop (non-streaming, maxTurns) |
| `backend/src/lib/tools/delegate/index.ts` | Delegate tool generator (generates delegate_to_X + continue_agent tools) |
| `backend/src/lib/tools/delegate/README.md` | Module documentation |
| `backend/src/app/api/agent-configs/route.ts` | GET (list) + POST (create) |
| `backend/src/app/api/agent-configs/[id]/route.ts` | GET + PUT + DELETE |
| `backend/src/app/api/agent-configs/README.md` | Route documentation |
| `desktop/renderer/src/hooks/useAgentConfigs.ts` | CRUD hook |
| `desktop/renderer/src/components/agent-configs/AgentConfigList.tsx` | List component |
| `desktop/renderer/src/components/agent-configs/AgentConfigForm.tsx` | Create/edit form |
| `desktop/renderer/src/components/agent-config-picker/AgentConfigPicker.tsx` | New chat picker |

## 14. README Updates Required

Per the project's Lego Rule documentation convention, each modified module needs its README updated.

| README | Update Needed |
|--------|---------------|
| `backend/src/lib/db/README.md` | Document new tables (`agentConfigs`, `agentConfigTools`) and new columns on `sessions`/`agents` |
| `backend/src/lib/services/README.md` | Add link to new `agent-config` service |
| `backend/src/lib/services/agent/README.md` | Document `AgentExecutionService`, how sub-agents are spawned and executed |
| `backend/src/lib/services/session/README.md` | Document `agentConfigId` flow in session creation |
| `backend/src/lib/services/chat/README.md` | Document new tool filtering logic, updated system prompt/model resolution chain, delegate tool generation |
| `backend/src/lib/tools/README.md` | Document `ToolFilter`, delegate tools, updated provider interfaces |
| `backend/src/lib/tools/providers/README.md` | Document filter parameters on MCP and Builtin providers |
| `backend/src/app/api/README.md` | Add `agent-configs` routes to the route table |
| `backend/src/app/api/sessions/README.md` | Document `agentConfigId` parameter |
| `backend/README.md` | Add agent configs to the architecture overview |

New READMEs to create:

| README | Content |
|--------|---------|
| `backend/src/lib/services/agent-config/README.md` | Service contract: CRUD, validation, default management, tool resolution |
| `backend/src/lib/tools/delegate/README.md` | How delegate tools are generated, execution flow, continue_agent semantics |
| `backend/src/app/api/agent-configs/README.md` | Route documentation, request/response schemas |

## 15. Edge Cases & Error Handling

### Stale Tool References

MCP servers or builtin modules referenced in `agentConfigTools` may be deleted or removed.

**Behavior**: At tool resolution time (`ChatService.prepareChat()`), skip missing references with a `console.warn()`. The agent runs with whatever tools are still valid. The config management UI shows a "missing" indicator on stale entries.

### Circular Delegation

Agent config A delegates to B, B delegates to A.

**Prevention**: When saving delegate entries, validate no circular references exist. Walk the delegate graph and reject cycles. This is checked in `AgentConfigService` on create/update.

### Deleted Agent Config

If an `agentConfig` is deleted, `sessions.agentConfigId` and `agents.agentConfigId` become NULL (SET NULL FK). Existing sessions continue to work — they just lose their config reference and fall back to the "all tools available" behavior.

### Default Config Uniqueness

Only one config per user can be `isDefault = true`. When setting a new default, unset the previous one in a transaction.

### Sub-Agent Fails

If a sub-agent hits an error during execution:
1. Set `agent.status` = "failed", `agent.error` = error message
2. Return error message as the tool result to the parent
3. Parent agent decides how to handle (retry, report to user, try different approach)

### maxTurns Reached

If a sub-agent hits `maxTurns`:
1. Set `agent.status` = "completed"
2. Set `agent.result` = last assistant message + "[max turns reached]"
3. Return to parent — parent can call `continue_agent` if needed

### No Agent Config Selected

If a session is created without an `agentConfigId` and the user has no default config, the session works exactly as it does today — all tools available, system prompt and model from user defaults. Full backward compatibility.

## 16. Implementation Progress & Notes

### Completed: Phases 1-3 (2026-02-13)

**Phase 1 — Data Model + CRUD API**: Done.
- `agentConfigs` + `agentConfigTools` tables in `schema.ts`, with `agentConfigId` FK on `sessions` and `agents`
- Types in `backend/src/types/index.ts`: `AgentConfig`, `AgentConfigWithTools`, `AgentConfigCreate`, `AgentConfigUpdate`
- `AgentConfigRepository` + `AgentConfigService` at `backend/src/lib/services/agent-config/`
- API routes at `backend/src/app/api/agent-configs/` (GET/POST collection, GET/PUT/DELETE by id)
- Circular delegation detection via BFS graph walk in service layer

**Phase 2 — Tool Filtering**: Done.
- `ToolFilter` type in `backend/src/lib/tools/types.ts`
- `ToolRegistry.toAiSdkTools()` and `getAllTools()` accept optional `ToolFilter`
- `McpToolProvider.getTools()` filters by `allowedServerIds`
- `BuiltinToolProvider.getTools()` filters by `allowedModuleIds`
- `ChatService.prepareChat()` loads agent config → builds filter → passes to registry

**Phase 3 — Session Creation Integration**: Done.
- `SessionRepository.create()` stores `agentConfigId` on session + root agent
- `SessionService.create()` validates config exists, falls back to user's default config, uses config name as agent name
- `POST /api/sessions` accepts `agentConfigId`
- System prompt resolution: agent → config override → config systemPromptId → user default
- Model resolution: explicit → agent → config defaultModelId → (throws)

### Completed: Phase 4 — Multi-Agent Delegation (2026-02-13)

**New types:**
- `DelegateToolSource` interface added to `backend/src/lib/tools/types.ts` with `configId` and `configName` fields
- Added to `ToolSource` union: `McpToolSource | BuiltinToolSource | DelegateToolSource`

**Tool key generation:**
- `ToolRegistry.getToolKey()` handles `"delegate"` case → `delegate__${configId}__${name}`

**Agent Execution Service** (`backend/src/lib/services/agent/agent-execution.service.ts`):
- `executeSubAgent(parentAgentId, sessionId, userId, agentConfigId, task, sourceCallId)` → creates child agent, runs non-streaming `generateText` loop, persists all items, returns final result string
- `continueSubAgent(childAgentId, parentAgentId, userId, message)` → validates parentage, appends user message, reruns execution loop
- Uses `agentConfig.maxTurns` (loaded from DB) to cap loop iterations; appends "[max turns reached]" when hit
- Error handling: catches errors → sets agent `status="failed"`, `error=message`, returns error string to parent
- Singleton pattern via `getAgentExecutionService()`

**Delegate tool generator** (`backend/src/lib/tools/delegate/index.ts`):
- `generateDelegateTools(agentConfig, sessionId, userId, parentAgentId)` → returns `ToolDefinition[]`
- For each `toolType="delegate"` entry: creates tool with `z.object({ task: z.string() })` input schema
- Also generates `continue_agent` tool with `z.object({ agentId: z.string(), message: z.string() })` when any delegates exist
- Tool execution delegates to `AgentExecutionService`

**ChatService integration** (`backend/src/lib/services/chat/chat.service.ts`):
- After `registry.toAiSdkTools()`, checks agentConfig for delegate entries
- Calls `generateDelegateTools()` and merges resulting tools into the tools map using AI SDK `tool()` wrapper
- Each delegate tool gets a unique key: `delegate__${configId}__${toolName}`

**Key design decisions:**
- Delegate tools are NOT builtin modules — they're dynamically generated per-agent based on config
- Sub-agents reuse `ChatService.prepareChat()` for their own tool/prompt/model resolution
- Sub-agents run with `generateText()` (non-streaming), not `streamText()`
- `maxTurns` only applies to sub-agent execution loops, NOT to the root agent's interactive chat (root agent has no turn limit)
- The `agents` table's existing columns (`parentId`, `sourceCallId`, `result`, `error`, `status`, `turnCount`) were sufficient — no schema changes needed

### Completed: Phase 5 — Frontend Settings (2026-02-13)

**Types** (`desktop/renderer/src/types/index.ts`):
- Added `AgentConfig`, `AgentConfigWithTools`, `AgentConfigTool`, `AgentConfigCreate`, `AgentConfigUpdate`
- Added `agentConfigId?: string | null` to `Session` type

**API Client** (`desktop/renderer/src/lib/api/client.ts`):
- Added `listAgentConfigs()`, `getAgentConfig(id)`, `createAgentConfig(input)`, `updateAgentConfig(id, input)`, `deleteAgentConfig(id)`

**Query Keys** (`desktop/renderer/src/lib/query/keys.ts`):
- Added `agentConfigs: { all, detail(id) }`

**Hook** (`desktop/renderer/src/hooks/useAgentConfigs.ts`):
- Full CRUD hook following `useQuickActions` pattern with React Query
- Exports: `configs`, `isLoading`, `error`, `createConfig`, `updateConfig`, `deleteConfig`, `refreshConfigs`

**Settings UI:**
- `desktop/renderer/src/app/(main)/settings/agent-configs/page.tsx` — settings page
- `desktop/renderer/src/components/settings/AgentConfigsSettings.tsx` — split-view container (list + editor)
- `desktop/renderer/src/components/settings/AgentConfigsList.tsx` — left panel list
- `desktop/renderer/src/components/settings/AgentConfigEditor.tsx` — right panel form

**Editor form fields (all using proper UI controls, not raw text inputs):**
- Name (text input)
- Description (textarea)
- System Prompt — `<select>` dropdown populated from user's saved system prompts via `useSystemPrompts()`. "None" option for no prompt.
- Model — `<select>` dropdown populated from user's enabled models (filtered `AVAILABLE_MODELS`)
- Max Turns (number input, default 25)
- Icon (text input for emoji)
- Color (text input for hex)
- Is Default (checkbox)
- **Tools section:**
  - Builtin Modules: checkboxes for memory, notes, plan, continuity
  - MCP Servers: checkboxes listing all user's MCP servers by name (via `useMcpServers()`)
  - Delegate Agents: checkboxes listing other agent configs by name (self excluded to prevent circular refs)

**Sidebar navigation:**
- Added "Agent Configs" entry to `COMMAND_CENTER_NAV` in `Sidebar.tsx`

### Completed: Phase 6 — Frontend New Chat Picker (2026-02-13)

**Agent Config Picker** (`desktop/renderer/src/components/agent-config-picker/AgentConfigPicker.tsx`):
- Modal overlay with grid of agent config cards
- Each card shows: icon (or first letter), name, description, tool count, color badge
- Default config highlighted with border and "default" badge
- Escape key and backdrop click to close

**New chat flow** (updated in `Sidebar.tsx`):
- 0 configs → creates session without config (first-time user / backward compat)
- 1 config → auto-selects it, no picker shown
- 2+ configs → shows picker modal
- No "No Config" option — sessions always use a config when configs exist

**Session creation** (`useSessions.ts`):
- `createSession(title?, agentConfigId?)` passes `agentConfigId` in POST body
- Layout's `handleNewChat(agentConfigId?)` chains through to `createSession`

**Session items** (`SessionItem.tsx`):
- Shows agent config indicator on sessions that have a config

### README Documentation (2026-02-13)

Created per the Lego Rule:
- `backend/src/lib/tools/delegate/README.md` — delegate tool generation, execution flow
- `backend/src/lib/services/agent-config/README.md` — service contract, CRUD, validation
- Updated `backend/src/lib/services/agent/README.md` — documented `AgentExecutionService`

## 17. Out of Scope for V1

These are explicitly NOT included in this PRD but are noted for future consideration:

- **Dynamic agent configs** (runtime context-dependent config changes, e.g., different behavior per user tier)
- **Agent config sharing/marketplace** (sharing configs between users)
- **Guardrails/middleware per agent** (input/output sanitization rules per config)
- **Workflows as tools** (graph-based workflows exposed as callable tools)
- **A2A protocol support** (cross-system agent discovery and communication)
- **Per-agent memory configuration** (memory is a builtin tool module; enabling/disabling it per config is sufficient for v1)
- **Agent-to-agent direct messaging** (sub-agents can only return results, not initiate communication)
- **Sub-agent streaming to UI** (sub-agents run to completion; UI shows the parent's tool call as loading; UX improvements deferred)
- **Nested delegation limits** (agent A delegates to B which delegates to C; v1 allows this with maxTurns as the safety valve; explicit depth limits can be added later)
