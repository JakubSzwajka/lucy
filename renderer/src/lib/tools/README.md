# Tool Architecture

This module provides a unified tool system for AI agents, combining MCP (Model Context Protocol) servers and programmatic integrations.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Directory Structure](#directory-structure)
3. [Architecture Overview](#architecture-overview)
4. [Key Concepts](#key-concepts)
5. [Available Integrations & Tools](#available-integrations--tools)
6. [Adding a New Integration](#adding-a-new-integration)
7. [Best Practices](#best-practices)

---

## Quick Start

```typescript
import {
  initializeToolRegistry,
  getToolRegistry,
} from "@/lib/tools";

// Initialize once at app startup
await initializeToolRegistry();

// Get tools for AI SDK
const registry = getToolRegistry();
const tools = await registry.toAiSdkTools({ agentId, sessionId });
```

---

## Directory Structure

```
renderer/src/lib/
├── integrations/                    # Service connections (clients + credentials)
│   ├── types.ts                     # Integration interface
│   ├── index.ts                     # Export all integrations + lookup
│   ├── todoist/                     # Todoist integration
│   │   ├── client.ts                # TodoistClient class
│   │   ├── types.ts                 # API types
│   │   └── index.ts                 # Integration definition
│   ├── obsidian/                    # Obsidian integration
│   │   ├── client.ts                # ObsidianClient class
│   │   └── index.ts                 # Integration definition
│   ├── filesystem/                  # Filesystem integration
│   │   └── index.ts                 # Integration definition (uses FilesystemService)
│   └── mcp/                         # MCP protocol support
│       ├── client.ts
│       ├── pool.ts
│       └── ...
│
├── tools/                           # Tool definitions & registry
│   ├── types.ts                     # ToolDefinition, ToolModule, ToolProvider
│   ├── registry.ts                  # ToolRegistry singleton
│   ├── index.ts                     # Main exports + initialization
│   ├── modules/                     # Abstract tool modules
│   │   ├── index.ts                 # Export all modules
│   │   ├── tasks/                   # Tasks tools → uses todoist integration
│   │   │   └── index.ts
│   │   ├── notes/                   # Notes tools → uses obsidian integration
│   │   │   └── index.ts
│   │   ├── memory/                  # Memory tools → uses obsidian integration
│   │   │   └── index.ts
│   │   └── plan/                    # Plan tools → uses plan service
│   │       └── index.ts
│   ├── providers/                   # Tool providers
│   │   ├── builtin.ts               # BuiltinToolProvider (loads from DB)
│   │   └── mcp.ts                   # McpToolProvider
│   └── utils/
│       └── persistence.ts           # DB operations for tool calls/results
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tool Registry                             │
│                     (Global Singleton)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐          ┌─────────────────────────────┐  │
│  │   MCP Provider   │          │   Builtin Provider          │  │
│  │                  │          │                             │  │
│  │  • External      │          │  • Integration-driven       │  │
│  │  • Dynamic       │          │  • Credentials from DB      │  │
│  │  • Multi-server  │          │  • Enable/disable via UI    │  │
│  └──────────────────┘          └─────────────────────────────┘  │
│                                           │                      │
├───────────────────────────────────────────┼─────────────────────┤
│                                           ▼                      │
│           ┌─────────────────────────────────────────┐           │
│           │          Integration Layer              │           │
│           │                                         │           │
│           │  ┌─────────┐ ┌─────────┐ ┌──────────┐  │           │
│           │  │ todoist │ │obsidian │ │   plan   │  │           │
│           │  │         │ │         │ │          │  │           │
│           │  │ client  │ │ client  │ │ service  │  │           │
│           │  └────┬────┘ └────┬────┘ └────┬─────┘  │           │
│           │       │           │           │         │           │
│           └───────┼───────────┼───────────┼─────────┘           │
│                   ▼           ▼           ▼                      │
│           ┌──────────────────────────────────────────┐          │
│           │          Tool Module Layer               │          │
│           │                                          │          │
│           │ ┌───────┐ ┌───────┐ ┌────────┐ ┌──────┐ │          │
│           │ │ tasks │ │ notes │ │ memory │ │ plan │ │          │
│           │ │       │ │       │ │        │ │      │ │          │
│           │ │ tools │ │ tools │ │ tools  │ │tools │ │          │
│           │ └───────┘ └───────┘ └────────┘ └──────┘ │          │
│           └──────────────────────────────────────────┘          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Unified Tool Interface                        │
│         ToolDefinition { name, description, inputSchema,         │
│                    source, execute, ... }                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   AI SDK tool() │
                    └─────────────────┘
```

### Data Flow

1. **Startup**: `initializeToolRegistry()` registers providers
2. **Builtin Provider** reads enabled integrations from DB
3. For each enabled integration:
   - Look up the Integration definition (credentials/config schemas, client factory)
   - Look up the Tool Module that uses this integration
   - Create client using `integration.createClient(credentials, config)`
   - Create tools using `module.createTools(client)`
4. Tools are available to AI via `registry.toAiSdkTools()`

---

## Key Concepts

### Integration

An Integration is a connection to an external service. It defines:
- **Credentials schema** - what API keys/tokens are needed
- **Config schema** - optional configuration
- **Client factory** - how to create a client from credentials
- **Test connection** - optional validation

```typescript
interface Integration<TClient, TCredentials, TConfig> {
  id: string;                    // e.g., "todoist"
  name: string;                  // e.g., "Todoist"
  description: string;
  iconUrl?: string;

  credentialsSchema: TCredentials;
  configSchema?: TConfig;

  createClient: (credentials, config) => TClient;
  testConnection?: (client) => Promise<TestResult>;
}
```

### Tool Module

A Tool Module defines abstract tools that use a client from an integration:

```typescript
interface ToolModule<TClient> {
  id: string;            // e.g., "tasks" (abstract name)
  name: string;          // e.g., "Tasks"
  description: string;
  integrationId: string; // e.g., "todoist" (which integration)

  createTools: (client: TClient) => ToolDefinition[];
}
```

### Tool Definition

The actual tool that the AI can call:

```typescript
interface ToolDefinition<TInput, TOutput> {
  name: string;              // e.g., "tasks_list"
  description: string;
  inputSchema: z.ZodType;
  source: ToolSource;

  execute: (args, context) => Promise<TOutput>;
  requiresApproval?: boolean | ((args) => boolean);
}
```

### Tool Source & Keys

Tools are namespaced by source:

```typescript
// Tool keys:
// MCP:     "mcp__server-id__tool_name"
// Builtin: "builtin__tasks__tasks_list"

type ToolSource =
  | { type: "mcp"; serverId: string; serverName: string }
  | { type: "builtin"; moduleId: string }  // e.g., "tasks", "notes", "memory", "plan"
```

---

## Available Integrations & Tools

| Integration | Module | Description |
|-------------|--------|-------------|
| `todoist` | `tasks` | Task management via Todoist |
| `obsidian` | `notes` | Notes via Obsidian Local REST API |
| `obsidian` | `memory` | Entity/fact knowledge store via Obsidian |
| `plan` | `plan` | Execution plan management |

### Tools

**Tasks** (`builtin__tasks__*`) — powered by Todoist
| Tool | Description | Approval |
|------|-------------|----------|
| `tasks_list` | List tasks with optional filters | No |
| `tasks_get_projects` | List all projects | No |

**Notes** (`builtin__notes__*`) — powered by Obsidian
| Tool | Description | Approval |
|------|-------------|----------|
| `notes_list` | List notes in vault/folder | No |
| `notes_read` | Read note contents | No |
| `notes_write` | Create/update notes | No |
| `notes_delete` | Delete notes | **Yes** |

**Memory** (`builtin__memory__*`) — powered by Obsidian
| Tool | Description | Approval |
|------|-------------|----------|
| `memory` | Store, find, and update knowledge (entity/fact hybrid model) | No |

**Plan** (`builtin__plan__*`) — powered by PlanService
| Tool | Description | Approval |
|------|-------------|----------|
| `create_plan` | Create an execution plan with ordered steps | No |
| `update_plan` | Update plan metadata, add/remove/update steps | No |
| `get_plan` | Get the current plan for the session | No |

---

## Adding a New Integration

### Step 1: Create the Integration

```
integrations/
└── my-service/
    ├── client.ts   # MyServiceClient class
    ├── types.ts    # API types (optional)
    └── index.ts    # Integration definition
```

```typescript
// integrations/my-service/index.ts
import { z } from "zod";
import { defineIntegration } from "../types";
import { MyServiceClient } from "./client";

export const myServiceIntegration = defineIntegration({
  id: "my-service",
  name: "My Service",
  description: "Connect to My Service",

  credentialsSchema: z.object({
    apiKey: z.string().min(1).describe("API key from dashboard"),
  }),

  configSchema: z.object({
    workspace: z.string().optional().describe("Workspace ID"),
  }),

  createClient: (credentials, config) => {
    return new MyServiceClient(credentials.apiKey, config.workspace);
  },

  testConnection: async (client) => {
    try {
      const user = await client.getUser();
      return { success: true, info: `Connected as ${user.email}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
});
```

### Step 2: Create the Tool Module

```
tools/modules/
└── my-tools/
    └── index.ts
```

```typescript
// tools/modules/my-tools/index.ts
import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { MyServiceClient } from "@/lib/integrations/my-service";

export const myToolsModule = defineToolModule<MyServiceClient>({
  id: "my-tools",
  name: "My Tools",
  description: "Tools for My Service",
  integrationId: "my-service",

  createTools: (client) => [
    defineTool({
      name: "my_tool_action",
      description: "Does something useful",
      inputSchema: z.object({
        query: z.string().describe("What to do"),
      }),
      source: { type: "builtin", moduleId: "my-tools" },
      execute: async (args) => {
        return await client.doAction(args.query);
      },
    }),
  ],
});
```

### Step 3: Register

```typescript
// integrations/index.ts
export const allIntegrations: AnyIntegration[] = [
  // ... existing
  myServiceIntegration,
];

// tools/modules/index.ts
export const allToolModules: AnyToolModule[] = [
  // ... existing
  myToolsModule,
];
```

### Step 4: Done!

The integration will:
- Appear in Settings → Integrations
- Show credential/config fields
- Have "Test Connection" button
- Mount tools when enabled

---

## Best Practices

### Naming
- **Integration IDs**: lowercase, dash-separated: `my-service`
- **Module IDs**: lowercase, abstract: `tasks`, `notes`, `memory`, `plan`
- **Tool names**: snake_case, prefixed: `tasks_list`, `notes_read`

### Descriptions
- Write for the AI - explain **when** to use the tool
- Include constraints: "Returns up to 10 results"
- Mention side effects: "Creates a new task in the inbox"

### Input Schemas
- Use `.describe()` on every field
- Provide sensible defaults with `.default()`
- Use enums for constrained values

### Error Handling
- **Throw** for unrecoverable failures (network, auth)
- **Return** `{ error: "message" }` for recoverable issues (not found)

### Approval
- Set `requiresApproval: true` for destructive operations
- Use a function for conditional: `(args) => args.permanent === true`
