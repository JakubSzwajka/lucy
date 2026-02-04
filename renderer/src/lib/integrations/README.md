# Integrations Layer

External service connectors that provide client instances for tool modules and AI features.

## Purpose

The integrations layer is an abstraction over external services and internal capabilities. Each integration:

- Has a unique ID, name, and description
- Checks whether it is configured (via environment variables or always-available status)
- Creates a typed client instance when configured

Tool modules and other components reference integrations by ID to obtain client instances, enabling loose coupling between business logic and external service details.

## Integration Interface

All integrations implement the `SimpleIntegration<TClient>` interface:

```typescript
interface SimpleIntegration<TClient = unknown> {
  id: string;                      // Unique identifier (e.g., "todoist", "obsidian")
  name: string;                    // Human-readable name
  description: string;             // Brief description of the integration
  isConfigured: () => boolean;     // Returns true if the integration can be used
  createClient: () => TClient | null; // Factory method for client instances
}
```

Example integration definition:

```typescript
export const todoistIntegration = {
  id: "todoist",
  name: "Todoist",
  description: "Task management via Todoist",

  isConfigured: () => !!process.env.TODOIST_API_KEY,

  createClient: (): TodoistClient | null => {
    const apiKey = process.env.TODOIST_API_KEY;
    if (!apiKey) return null;
    return new TodoistClient(apiKey);
  },
};
```

## Available Integrations

### Todoist

**ID:** `todoist`
**Status:** Requires `TODOIST_API_KEY` environment variable

Connects to Todoist for task management. Provides:
- Task listing and retrieval (with filters)
- Project listing and retrieval
- User information

Files:
- `todoist/index.ts` - Integration definition
- `todoist/client.ts` - REST API client
- `todoist/types.ts` - TypeScript types for API responses

### Obsidian

**ID:** `obsidian`
**Status:** Requires `OBSIDIAN_API_KEY` environment variable

Connects to an Obsidian vault via the Local REST API plugin. Provides:
- Note listing, reading, writing, and deletion
- Full-text search across notes
- Connection health checks

Environment variables:
- `OBSIDIAN_API_KEY` (required) - API key from the Local REST API plugin
- `OBSIDIAN_BASE_URL` (optional) - Defaults to `https://127.0.0.1:27124`

Files:
- `obsidian/index.ts` - Integration definition
- `obsidian/client.ts` - Local REST API client with CRUD operations

### Filesystem

**ID:** `filesystem`
**Status:** Always configured (no credentials required)

Sandboxed file operations within a designated local directory. Provides:
- File reading, writing, and listing
- Directory operations within the sandbox

Environment variables:
- `FILESYSTEM_BASE_PATH` (optional) - Defaults to `lucy-data`

Files:
- `filesystem/index.ts` - Integration definition (wraps FilesystemService from `@/lib/services`)

### Conversations

**ID:** `conversations`
**Status:** Always configured (uses internal database)

Search capability over past Lucy conversations. Provides:
- Full-text search with context
- Access to historical conversation data

Files:
- `conversations/index.ts` - Integration definition
- `conversations/client.ts` - Thin wrapper over ConversationSearchRepository
- `conversations/types.ts` - Re-exports types from service layer

### Plan

**ID:** `plan`
**Status:** Always configured (uses internal database)

Planning capabilities for complex multi-step tasks. Provides:
- Plan creation and management
- Step tracking and status updates

Files:
- `plan/index.ts` - Integration definition (wraps PlanService from `@/lib/services`)

## MCP Integration (Model Context Protocol)

The MCP integration is a special subsystem for connecting to MCP-compliant tool servers. Unlike other integrations, MCP dynamically discovers tools from external servers at runtime.

### Architecture

```
mcp/
  client.ts     - Low-level MCP client wrapper and tool execution
  pool.ts       - Connection pool and lifecycle management
  repository.ts - Database persistence for server configurations
  service.ts    - Business logic and validation
  index.ts      - Public exports
```

### Components

#### Client (`client.ts`)

Creates and manages individual MCP client connections:

- `createMcpClient(server)` - Establishes connection via stdio or SSE transport
- `closeMcpClient(wrapper)` - Gracefully closes a connection
- `executeToolCall(wrapper, toolName, args)` - Executes a tool on the server
- `convertToAiSdkTools(wrappers)` - Converts MCP tools to AI SDK format

The client supports two transport types:
- **stdio**: Spawns a local process (requires `command` and optional `args`)
- **http/sse**: Connects to a remote server (requires `url`)

#### Pool (`pool.ts`)

Manages a collection of MCP connections:

- `McpClientPool` - Class for managing multiple server connections
- `getGlobalPool()` - Returns the singleton global pool
- `ensureServersConnected(servers)` - Connects to enabled servers, disconnects disabled ones
- `disconnectAll()` - Cleanup all connections

The pool handles:
- Automatic reconnection when server configurations change
- Tool aggregation across all connected servers
- Approval flow callbacks for sensitive tools

#### Repository (`repository.ts`)

Persists MCP server configurations to SQLite:

- `McpRepository` - CRUD operations for server records
- `getMcpRepository()` - Singleton accessor
- Transforms between database records (JSON-serialized fields) and typed objects

#### Service (`service.ts`)

Business logic layer for MCP operations:

- `McpService` - Validation, CRUD, and connection testing
- `getMcpService()` - Singleton accessor

Key operations:
- `create(data)` - Validates and creates a server configuration
- `testConnection(id)` - Tests connectivity and returns discovered tools
- `getStatus()` - Returns connection status of all enabled servers

### Lifecycle

1. **Configuration**: Server configurations are stored in the database via `McpRepository`
2. **Initialization**: On app startup or chat request, `ensureServersConnected()` connects to enabled servers
3. **Tool Discovery**: Each connected server reports its available tools
4. **Execution**: During chat, tools are invoked via `executeToolCall()`
5. **Cleanup**: `disconnectAll()` closes all connections on app shutdown

### Usage Example

```typescript
import { getMcpService, getGlobalPool, ensureServersConnected } from "@/lib/integrations";

// Get all enabled servers and connect
const service = getMcpService();
const enabledServers = service.getAllEnabled();
await ensureServersConnected(enabledServers);

// Get tools for AI SDK
const pool = getGlobalPool();
const tools = pool.getAiSdkTools();

// Use with AI SDK streamText
const result = await streamText({
  model,
  messages,
  tools,
});
```

## Adding New Integrations

To add a new integration:

1. **Create the directory**: `integrations/<name>/`

2. **Implement the client**: Create `client.ts` with the service-specific logic

3. **Define types**: Create `types.ts` if the integration has complex types

4. **Create the integration definition**: Create `index.ts`:

```typescript
import { MyClient } from "./client";

export { MyClient } from "./client";
export type { MyTypes } from "./types";

export const myIntegration = {
  id: "my-integration",
  name: "My Integration",
  description: "Description of what it does",

  isConfigured: () => !!process.env.MY_API_KEY,

  createClient: (): MyClient | null => {
    const apiKey = process.env.MY_API_KEY;
    if (!apiKey) return null;
    return new MyClient(apiKey);
  },
};
```

5. **Register the integration**: Update `integrations/index.ts`:

```typescript
// Add export
export { myIntegration, MyClient } from "./my-integration";
export type { MyTypes } from "./my-integration";

// Add to allIntegrations array
import { myIntegration } from "./my-integration";

export const allIntegrations: AnyIntegration[] = [
  // ... existing integrations
  myIntegration,
];
```

## Dependencies

The integrations layer follows a one-way dependency pattern:

```
integrations/
    |
    v
lib/services/          (for internal services like filesystem, conversation search, plan)
    |
    v
lib/db/                (for database access)
```

Integrations may depend on:
- `@/lib/services` - For internal service implementations
- `@/lib/db` - For database access (MCP repository)
- `@/types` - For shared type definitions

Integrations must NOT depend on:
- `@/components` - UI components
- `@/app` - API routes or pages
- `@/hooks` - React hooks

This ensures integrations remain decoupled from the presentation layer and can be used from both API routes and server components.
