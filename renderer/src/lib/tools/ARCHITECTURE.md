# Tool Architecture

This module provides a unified tool system for AI agents, combining MCP (Model Context Protocol) servers and programmatic integrations.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Directory Structure](#directory-structure)
3. [Architecture Overview](#architecture-overview)
4. [Available Integrations](#available-integrations)
5. [Unified Tool Interface](#unified-tool-interface)
6. [Integration Configuration System](#integration-configuration-system)
7. [Settings UI](#settings-ui)
8. [Adding a New Integration](#adding-a-new-integration)
9. [Tool Inspection](#tool-inspection)
10. [Best Practices](#best-practices)

---

## Quick Start

```typescript
import {
  initializeToolRegistry,
  getToolRegistry,
  getIntegrationProvider,
  getToolInventory,
  printToolInventory,
} from "@/lib/tools";

// Initialize once at app startup
await initializeToolRegistry();

// Get tools for AI SDK
const registry = getToolRegistry();
const tools = await registry.toAiSdkTools({ agentId, sessionId });

// See what tools are available
const inventory = await getToolInventory();
console.log(inventory.tools);

// Or print a formatted summary
await printToolInventory();
```

---

## Directory Structure

```
renderer/src/lib/tools/
├── index.ts              # Main exports + initialization + inspection
├── types.ts              # Core interfaces (ToolDefinition, ToolProvider)
├── registry.ts           # ToolRegistry singleton
├── ARCHITECTURE.md       # This file
├── providers/
│   ├── index.ts          # Provider exports
│   └── mcp.ts            # MCP server provider
├── integrations/
│   ├── index.ts          # allIntegrations registry
│   ├── types.ts          # IntegrationDefinition interface
│   ├── provider.ts       # IntegrationToolProvider (loads from DB)
│   ├── filesystem/       # Local file storage
│   ├── obsidian/         # Obsidian vault via REST API
│   └── todoist/          # Todoist task management
└── utils/
    ├── index.ts
    └── persistence.ts    # Tool call/result DB operations
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tool Registry                            │
│                     (Global Singleton)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐          ┌─────────────────────────────┐  │
│  │   MCP Provider   │          │   Integration Provider      │  │
│  │                  │          │                             │  │
│  │  • Dynamic       │          │  • Database-driven          │  │
│  │  • External      │          │  • Credentials validated    │  │
│  │  • Multi-server  │          │  • Enable/disable via UI    │  │
│  └──────────────────┘          └─────────────────────────────┘  │
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

---

## Available Integrations

| Integration | ID | Description | Credentials Required |
|-------------|----|-------------|---------------------|
| Filesystem | `filesystem` | Read/write files in sandboxed directory | None |
| Obsidian | `obsidian` | Notes via Local REST API plugin | API key |
| Todoist | `todoist` | Task management | API token |

### Tools by Integration

**Filesystem** (`integration__filesystem__*`)
| Tool | Description | Approval |
|------|-------------|----------|
| `fs_list_files` | List files with optional regex filter | No |
| `fs_read_file` | Read file contents | No |
| `fs_write_file` | Write/create files | No |
| `fs_delete_file` | Delete files | **Yes** |

**Obsidian** (`integration__obsidian__*`)
| Tool | Description | Approval |
|------|-------------|----------|
| `obsidian_list_notes` | List notes in vault/folder | No |
| `obsidian_read_note` | Read note contents | No |
| `obsidian_write_note` | Create/update notes | No |
| `obsidian_delete_note` | Delete notes | **Yes** |

**Todoist** (`integration__todoist__*`)
| Tool | Description | Approval |
|------|-------------|----------|
| `todoist_list_tasks` | List tasks with filters | No |
| `todoist_list_projects` | List all projects | No |

---

## Unified Tool Interface

All tools (MCP and integrations) conform to the same interface:

### ToolDefinition

```typescript
interface ToolDefinition<TInput, TOutput> {
  // Identity
  name: string;                           // e.g., "fs_read_file"
  description: string;                    // For AI to understand when to use
  source: ToolSource;                     // Where tool comes from

  // Schema
  inputSchema: z.ZodType<TInput>;         // Zod schema for validation

  // Execution
  execute: (args: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  // Optional
  requiresApproval?: boolean | ((args: TInput) => boolean);
  validate?: (args: TInput, context: ToolExecutionContext) => Promise<ValidationResult>;
  formatOutput?: (output: TOutput) => unknown;
}
```

### ToolSource

Tools are namespaced by their source:

```typescript
type ToolSource = McpToolSource | IntegrationToolSource;

interface McpToolSource {
  type: "mcp";
  serverId: string;
  serverName: string;
}

interface IntegrationToolSource {
  type: "integration";
  integrationId: string;  // e.g., "filesystem", "todoist"
}

// Tool keys follow pattern:
// MCP: "mcp__server-id__tool_name"
// Integration: "integration__filesystem__fs_read_file"
```

### ToolExecutionContext

```typescript
interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  callId: string;  // Unique ID for this invocation

  // State management within session
  getState: <T>(key: string) => T | undefined;
  setState: <T>(key: string, value: T) => void;

  // For tools that spawn sub-agents
  createChildAgent?: (config: ChildAgentConfig) => Promise<string>;
}
```

### Creating a Tool

```typescript
import { defineTool } from "@/lib/tools";
import { z } from "zod";

const myTool = defineTool({
  name: "my_tool",
  description: "Does something useful. Call this when user asks to...",

  inputSchema: z.object({
    query: z.string().describe("What to search for"),
    limit: z.number().optional().default(10).describe("Max results"),
  }),

  source: { type: "integration", integrationId: "my-service" },

  execute: async (args, context) => {
    // args is typed as { query: string; limit: number }
    const results = await doSomething(args.query, args.limit);
    return { results, count: results.length };
  },

  // Optional: require approval for destructive actions
  requiresApproval: (args) => args.query.includes("delete"),
});
```

---

## Integration Configuration System

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Lifecycle                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEFINITION (code)           2. STATE (database)              │
│  ┌─────────────────────┐       ┌─────────────────────┐          │
│  │ allIntegrations[]   │       │ integrations table  │          │
│  │                     │       │                     │          │
│  │ • id                │       │ • id (PK)           │          │
│  │ • name              │       │ • enabled           │          │
│  │ • credentialsSchema │  ──►  │ • credentials (JSON)│          │
│  │ • configSchema      │       │ • config (JSON)     │          │
│  │ • createTools()     │       │                     │          │
│  │ • testConnection()  │       │                     │          │
│  └─────────────────────┘       └─────────────────────┘          │
│                                         │                        │
│                                         ▼                        │
│                          3. MOUNTING (runtime)                   │
│                          ┌─────────────────────┐                 │
│                          │ IntegrationProvider │                 │
│                          │                     │                 │
│                          │ • Query enabled     │                 │
│                          │ • Validate creds    │                 │
│                          │ • createTools()     │                 │
│                          │ • Mount to registry │                 │
│                          └─────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- integrations table
CREATE TABLE integrations (
  id          TEXT PRIMARY KEY,   -- "filesystem", "todoist", etc.
  name        TEXT NOT NULL,      -- Display name
  enabled     INTEGER DEFAULT 0,  -- 0 = disabled, 1 = enabled
  credentials TEXT,               -- JSON: {"apiKey": "..."}
  config      TEXT,               -- JSON: {"basePath": "..."}
  created_at  INTEGER,
  updated_at  INTEGER
);
```

### IntegrationDefinition

```typescript
interface IntegrationDefinition {
  // Identity
  id: string;           // Must match DB id
  name: string;         // Display name
  description: string;  // For UI
  iconUrl?: string;     // Optional icon

  // Schemas (Zod)
  credentialsSchema: z.ZodObject;   // Required credentials
  configSchema?: z.ZodObject;       // Optional config

  // Tool factory - called when integration is enabled & validated
  createTools: (credentials, config) => ToolDefinition[];

  // Optional - test credentials before saving
  testConnection?: (credentials) => Promise<{
    success: boolean;
    error?: string;
    info?: string;  // e.g., "Connected as user@example.com"
  }>;
}
```

### Mounting Flow

1. **On app startup**: `initializeToolRegistry()` is called
2. **IntegrationToolProvider.refresh()** runs:
   - Queries `integrations` table for `enabled = true`
   - For each enabled row:
     - Finds matching definition in `allIntegrations`
     - Validates credentials against `credentialsSchema`
     - If valid: calls `createTools()` and mounts them
     - If invalid: logs warning, skips
3. **Tools are now available** to the AI agent

### When Tools Update

Tools refresh when:
- `IntegrationToolProvider.refresh()` is called
- This happens automatically on app startup via `initializeToolRegistry()`

---

## Settings UI

### Components

```
Settings → Integrations
    │
    ├── IntegrationsSettingsPage    (renderer/src/app/(main)/settings/integrations/page.tsx)
    │   └── useIntegrations hook    (renderer/src/hooks/useIntegrations.ts)
    │
    └── IntegrationsSettings        (renderer/src/components/settings/IntegrationsSettings.tsx)
        ├── Integration List        (shows all available integrations)
        │   ├── Name + description
        │   ├── Status: configured/not configured, enabled/disabled
        │   └── Actions: Configure, Disconnect, Enable toggle
        │
        └── IntegrationConfigForm   (configure credentials/config)
            ├── Credential fields   (from credentialsSchema)
            ├── Config fields       (from configSchema)
            ├── Test Connection     (if testConnection defined)
            └── Save & Enable
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List all integrations with state |
| PATCH | `/api/integrations/:id` | Update credentials/config/enabled |
| DELETE | `/api/integrations/:id` | Remove integration (reset) |
| POST | `/api/integrations/:id/test` | Test connection with credentials |

### useIntegrations Hook

```typescript
const {
  integrations,           // All integrations with state
  enabledIntegrations,    // Only enabled & configured
  isLoading,
  error,
  updateIntegration,      // (id, { credentials?, config?, enabled? })
  deleteIntegration,      // (id) - removes credentials
  testConnection,         // (id, credentials) - test before saving
  toggleIntegration,      // (id, enabled) - quick on/off
  refreshIntegrations,    // Refetch from API
} = useIntegrations();
```

### Integration Type (for UI)

```typescript
interface Integration {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;

  // From credentialsSchema/configSchema
  credentialFields: Array<{ name: string; description?: string }>;
  configFields: Array<{ name: string; description?: string }>;

  // State
  enabled: boolean;
  isConfigured: boolean;  // Has credentials saved
  hasTestConnection: boolean;

  config: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
```

---

## Adding a New Integration

### Step 1: Create Integration File

```
integrations/
└── my-service/
    └── index.ts
```

### Step 2: Define the Integration

```typescript
// integrations/my-service/index.ts
import { z } from "zod";
import { defineIntegration } from "../types";
import { defineTool, type ToolDefinition } from "../../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

// ============================================================================
// API Client (optional, for complex integrations)
// ============================================================================

class MyServiceClient {
  constructor(private apiKey: string) {}

  async getData(query: string) {
    const res = await fetch(`https://api.myservice.com/data?q=${query}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return res.json();
  }
}

// ============================================================================
// Tool Factory
// ============================================================================

function createMyServiceTools(client: MyServiceClient): AnyToolDefinition[] {
  return [
    defineTool({
      name: "myservice_search",
      description: "Search for data in MyService. Use when user asks about...",

      inputSchema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().default(10).describe("Max results"),
      }),

      source: { type: "integration", integrationId: "my-service" },

      execute: async (args) => {
        const data = await client.getData(args.query);
        return { results: data.slice(0, args.limit) };
      },
    }),

    defineTool({
      name: "myservice_delete",
      description: "Delete an item from MyService.",

      inputSchema: z.object({
        id: z.string().describe("Item ID to delete"),
      }),

      source: { type: "integration", integrationId: "my-service" },

      requiresApproval: true,  // Destructive action

      execute: async (args) => {
        await client.delete(args.id);
        return { success: true, deleted: args.id };
      },
    }),
  ];
}

// ============================================================================
// Integration Definition
// ============================================================================

export const myServiceIntegration = defineIntegration({
  id: "my-service",
  name: "My Service",
  description: "Connect to My Service for data management",
  iconUrl: "/icons/my-service.svg",  // Optional

  // What credentials are needed
  credentialsSchema: z.object({
    apiKey: z
      .string()
      .min(1, "API key is required")
      .describe("API key from My Service dashboard"),
  }),

  // Optional additional config
  configSchema: z.object({
    workspace: z
      .string()
      .optional()
      .describe("Workspace ID (leave empty for default)"),
  }),

  // Called when integration is enabled with valid credentials
  createTools: (credentials, config) => {
    const client = new MyServiceClient(credentials.apiKey);
    return createMyServiceTools(client);
  },

  // Optional: verify credentials work before saving
  testConnection: async (credentials) => {
    try {
      const client = new MyServiceClient(credentials.apiKey);
      const user = await client.getUser();
      return {
        success: true,
        info: `Connected as ${user.name}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});
```

### Step 3: Register in allIntegrations

```typescript
// integrations/index.ts
import { myServiceIntegration } from "./my-service";

export const allIntegrations: IntegrationDefinition[] = [
  filesystemIntegration,
  obsidianIntegration,
  todoistIntegration,
  myServiceIntegration,  // Add here
];
```

### Step 4: Done!

The integration will now:
- Appear in Settings → Integrations
- Show credential/config fields from your schemas
- Have "Test Connection" button (if testConnection defined)
- Mount tools when enabled and configured

---

## Tool Inspection

### getToolInventory()

```typescript
import { getToolInventory } from "@/lib/tools";

const inventory = await getToolInventory();

// inventory.tools - flat list of all mounted tools
// inventory.bySource - grouped by source (e.g., "integration:filesystem")
// inventory.count - total number

// Each tool:
interface MountedToolInfo {
  key: string;              // "integration__filesystem__fs_read_file"
  name: string;             // "fs_read_file"
  description: string;
  source: {
    type: "mcp" | "integration";
    id: string;             // "filesystem"
    name?: string;          // Server name (MCP only)
  };
  requiresApproval: boolean;
}
```

### printToolInventory()

Logs a formatted table to console:

```
╔════════════════════════════════════════════════════════════╗
║                    TOOL INVENTORY                          ║
╠════════════════════════════════════════════════════════════╣
║  Total tools: 10                                           ║
╠════════════════════════════════════════════════════════════╣
║  INTEGRATION: filesystem                                   ║
║    • fs_list_files                                         ║
║    • fs_read_file                                          ║
║    • fs_write_file                                         ║
║    • fs_delete_file ⚠                                      ║
║                                                            ║
║  INTEGRATION: todoist                                      ║
║    • todoist_list_tasks                                    ║
║    • todoist_list_projects                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## Best Practices

### Tool Naming
- Use `snake_case`: `create_task`, `list_files`
- Prefix with service: `fs_read_file`, `obsidian_list_notes`, `todoist_list_tasks`
- Be descriptive: `get_user_by_id` not `get`

### Descriptions
- Write for the AI - explain **when** to use the tool
- Include constraints: "Returns up to 10 results"
- Mention side effects: "Creates a new task in the inbox"

### Input Schemas
- Use `.describe()` on **every** field
- Provide sensible defaults with `.default()`
- Use enums for constrained values: `z.enum(["asc", "desc"])`

### Error Handling
- **Throw** for unrecoverable failures (network errors, auth failures)
- **Return** `{ error: "message" }` for recoverable issues (not found, validation)
- Be specific: "Task not found: abc123" not "Error"

### Approval
- Set `requiresApproval: true` for **destructive** operations (delete, etc.)
- Use a function for conditional approval: `(args) => args.permanent === true`

### Credentials
- Never log credentials
- Use `.describe()` to help users find their API keys
- Implement `testConnection` to verify before saving
