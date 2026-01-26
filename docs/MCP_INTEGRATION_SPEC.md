# MCP Integration Specification

## Overview

Add Model Context Protocol (MCP) support to Lucy, enabling agents to use external tools from providers like Todoist, Notion, GitHub, filesystem access, and more.

**Key Decisions:**
- Transport: Both stdio (local CLI tools) and HTTP/SSE (remote servers)
- Scope: Per-session MCP selection (all agents in a session share tools)
- UI: Dropdown/chips above message input

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Lucy Desktop App                         │
├─────────────────────────────────────────────────────────────────┤
│  Settings                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ MCP Server Registry                                         ││
│  │ • Todoist (stdio: npx @anthropic/mcp-todoist)              ││
│  │ • Notion (http: https://notion-mcp.example.com)            ││
│  │ • Filesystem (stdio: npx @anthropic/mcp-filesystem)        ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Session                                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Enabled MCPs: [Todoist, Notion]                             ││
│  │                                                              ││
│  │  Agent 1 ──► Chat API ──► MCP Client Pool ──► MCP Servers   ││
│  │      │           │                                          ││
│  │      │           ▼                                          ││
│  │      │      Tool Discovery                                  ││
│  │      │      Tool Execution                                  ││
│  │      │      Result Handling                                 ││
│  │      │           │                                          ││
│  │      ◄───────────┘                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: `mcp_servers`

Stores configured MCP server definitions (the registry of available MCPs).

```typescript
// renderer/src/lib/db/schema.ts

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(), // uuid
  name: text("name").notNull(), // "Todoist", "Notion"
  description: text("description"), // Optional description

  // Transport configuration (discriminated union)
  transportType: text("transport_type", {
    enum: ["stdio", "sse", "http"]
  }).notNull(),

  // For stdio transport
  command: text("command"), // "npx" or "/path/to/binary"
  args: text("args"), // JSON array: ["@anthropic/mcp-todoist"]
  env: text("env"), // JSON object: {"API_KEY": "..."}

  // For HTTP/SSE transport
  url: text("url"), // "https://mcp-server.example.com"
  headers: text("headers"), // JSON object for auth headers

  // Status & metadata
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  iconUrl: text("icon_url"), // Optional icon for UI
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
});
```

### New Table: `session_mcp_servers`

Junction table linking sessions to their enabled MCP servers.

```typescript
export const sessionMcpServers = sqliteTable("session_mcp_servers", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  mcpServerId: text("mcp_server_id")
    .notNull()
    .references(() => mcpServers.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
});
```

### Schema Relations

```typescript
export const mcpServersRelations = relations(mcpServers, ({ many }) => ({
  sessions: many(sessionMcpServers),
}));

export const sessionMcpServersRelations = relations(sessionMcpServers, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionMcpServers.sessionId],
    references: [sessions.id],
  }),
  mcpServer: one(mcpServers, {
    fields: [sessionMcpServers.mcpServerId],
    references: [mcpServers.id],
  }),
}));

// Update sessions relations
export const sessionsRelations = relations(sessions, ({ many, one }) => ({
  agents: many(agents),
  mcpServers: many(sessionMcpServers), // Add this
}));
```

---

## Type Definitions

```typescript
// renderer/src/types/mcp.ts

export type McpTransportType = "stdio" | "sse" | "http";

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transportType: McpTransportType;
  enabled: boolean;
  iconUrl?: string;

  // Stdio-specific
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // HTTP/SSE-specific
  url?: string;
  headers?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  serverId: string; // Which MCP server provides this tool
}

export interface McpToolCall {
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
}

export interface McpToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface McpClientStatus {
  serverId: string;
  connected: boolean;
  tools: McpTool[];
  error?: string;
}
```

---

## MCP Client Layer

### Directory Structure

```
renderer/src/lib/mcp/
├── index.ts              # Public exports
├── client.ts             # MCP client wrapper
├── pool.ts               # Client pool management
├── transports/
│   ├── stdio.ts          # Stdio transport helpers
│   └── http.ts           # HTTP/SSE transport helpers
└── tools.ts              # Tool discovery & execution
```

### MCP Client Pool

Manages connections to multiple MCP servers for a session.

```typescript
// renderer/src/lib/mcp/pool.ts

import { createMCPClient, MCPClient } from "ai";
import { McpServerConfig, McpClientStatus, McpTool } from "@/types/mcp";

export class McpClientPool {
  private clients: Map<string, MCPClient> = new Map();
  private tools: Map<string, McpTool[]> = new Map();

  async connect(server: McpServerConfig): Promise<McpClientStatus> {
    const transport = this.buildTransport(server);
    const client = await createMCPClient({ transport });

    this.clients.set(server.id, client);

    // Discover tools from this server
    const discoveredTools = await client.tools();
    const toolList = Object.entries(discoveredTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.parameters,
      serverId: server.id,
    }));

    this.tools.set(server.id, toolList);

    return {
      serverId: server.id,
      connected: true,
      tools: toolList,
    };
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
      this.tools.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.disconnect(serverId);
    }
  }

  getAllTools(): Record<string, McpTool> {
    const allTools: Record<string, McpTool> = {};
    for (const [serverId, tools] of this.tools) {
      for (const tool of tools) {
        // Namespace tools by server to avoid collisions
        allTools[`${serverId}:${tool.name}`] = tool;
      }
    }
    return allTools;
  }

  getClient(serverId: string): MCPClient | undefined {
    return this.clients.get(serverId);
  }

  private buildTransport(server: McpServerConfig) {
    switch (server.transportType) {
      case "stdio":
        return {
          type: "stdio" as const,
          command: server.command!,
          args: server.args || [],
          env: server.env,
        };
      case "sse":
        return {
          type: "sse" as const,
          url: server.url!,
          headers: server.headers,
        };
      case "http":
        return {
          type: "http" as const,
          url: server.url!,
          headers: server.headers,
        };
    }
  }
}
```

### Session Pool Registry

Singleton to manage pools per session (important for connection lifecycle).

```typescript
// renderer/src/lib/mcp/registry.ts

const sessionPools = new Map<string, McpClientPool>();

export function getPoolForSession(sessionId: string): McpClientPool {
  if (!sessionPools.has(sessionId)) {
    sessionPools.set(sessionId, new McpClientPool());
  }
  return sessionPools.get(sessionId)!;
}

export async function destroyPoolForSession(sessionId: string): Promise<void> {
  const pool = sessionPools.get(sessionId);
  if (pool) {
    await pool.disconnectAll();
    sessionPools.delete(sessionId);
  }
}
```

---

## API Routes

### New: `/api/mcp-servers` - MCP Server Registry CRUD

```typescript
// renderer/src/app/api/mcp-servers/route.ts

// GET - List all configured MCP servers
// POST - Add a new MCP server

// renderer/src/app/api/mcp-servers/[id]/route.ts
// GET - Get single server
// PATCH - Update server config
// DELETE - Remove server

// renderer/src/app/api/mcp-servers/[id]/test/route.ts
// POST - Test connection to a server (returns available tools)
```

### New: `/api/sessions/[id]/mcp` - Session MCP Management

```typescript
// renderer/src/app/api/sessions/[id]/mcp/route.ts

// GET - List MCP servers enabled for this session (with connection status)
// PUT - Set the list of enabled MCP servers for session
// Response includes discovered tools from connected servers
```

### Modified: `/api/chat` - Tool Execution Loop

The chat route needs significant changes to support tool execution:

```typescript
// renderer/src/app/api/chat/route.ts

import { streamText } from "ai";
import { getPoolForSession } from "@/lib/mcp/registry";

export async function POST(req: Request) {
  const { messages, model, agentId, sessionId, thinkingEnabled } = await req.json();

  // Get MCP pool for this session
  const mcpPool = getPoolForSession(sessionId);
  const mcpTools = mcpPool.getAllTools();

  // Convert MCP tools to AI SDK format
  const tools = Object.fromEntries(
    Object.entries(mcpTools).map(([name, tool]) => [
      name,
      {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (args: unknown) => {
          // Execute tool via MCP client
          const client = mcpPool.getClient(tool.serverId);
          if (!client) throw new Error(`MCP server ${tool.serverId} not connected`);

          // Save tool_call item to DB
          await saveToolCallItem(agentId, name, args, "running");

          try {
            const result = await client.callTool({ name: tool.name, arguments: args });
            await saveToolResultItem(agentId, name, result, null);
            return result;
          } catch (error) {
            await saveToolResultItem(agentId, name, null, error.message);
            throw error;
          }
        },
      },
    ])
  );

  const result = streamText({
    model: getLanguageModel(model),
    messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: 10, // Allow multi-step tool use
    onFinish: async ({ text, reasoning, toolCalls, toolResults }) => {
      // Persist final assistant message
      // ... existing persistence logic
    },
  });

  return result.toDataStreamResponse();
}
```

---

## UI Components

### 1. Settings: MCP Server Management

Location: Settings page, new "MCP Servers" section.

```typescript
// renderer/src/components/settings/McpServerList.tsx

interface Props {
  servers: McpServerConfig[];
  onAdd: () => void;
  onEdit: (server: McpServerConfig) => void;
  onDelete: (serverId: string) => void;
  onTest: (serverId: string) => void;
}

export function McpServerList({ servers, onAdd, onEdit, onDelete, onTest }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">MCP Servers</h3>
        <Button onClick={onAdd}>Add Server</Button>
      </div>

      {servers.map((server) => (
        <McpServerCard
          key={server.id}
          server={server}
          onEdit={() => onEdit(server)}
          onDelete={() => onDelete(server.id)}
          onTest={() => onTest(server.id)}
        />
      ))}
    </div>
  );
}
```

```typescript
// renderer/src/components/settings/McpServerForm.tsx (Add/Edit dialog)

interface Props {
  server?: McpServerConfig; // undefined for new
  onSave: (config: McpServerConfig) => void;
  onCancel: () => void;
}

// Form fields:
// - Name (text)
// - Description (textarea)
// - Transport Type (radio: stdio | sse | http)
// - For stdio: Command, Args (comma-separated), Env vars (key=value pairs)
// - For http/sse: URL, Headers (key=value pairs)
// - Test Connection button
```

### 2. Chat: MCP Selector Dropdown

Location: Above the message input textarea.

```typescript
// renderer/src/components/chat/McpSelector.tsx

interface Props {
  sessionId: string;
  availableServers: McpServerConfig[];
  enabledServerIds: string[];
  onToggle: (serverId: string, enabled: boolean) => void;
}

export function McpSelector({
  sessionId,
  availableServers,
  enabledServerIds,
  onToggle
}: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <span className="text-sm text-muted-foreground">Tools:</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add MCP
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          {availableServers.map((server) => (
            <div key={server.id} className="flex items-center gap-2">
              <Checkbox
                checked={enabledServerIds.includes(server.id)}
                onCheckedChange={(checked) => onToggle(server.id, !!checked)}
              />
              <span>{server.name}</span>
            </div>
          ))}
        </PopoverContent>
      </Popover>

      {/* Active MCPs as chips */}
      {enabledServerIds.map((id) => {
        const server = availableServers.find((s) => s.id === id);
        if (!server) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="cursor-pointer"
            onClick={() => onToggle(id, false)}
          >
            {server.name}
            <X className="h-3 w-3 ml-1" />
          </Badge>
        );
      })}
    </div>
  );
}
```

### 3. Chat: Tool Activity Display

The existing `AgentActivity.tsx` component already handles tool_call and tool_result items. Minor enhancements needed:

```typescript
// Enhance AgentActivity.tsx to show:
// - Tool name with server badge (e.g., "create_task [Todoist]")
// - Tool arguments (collapsible JSON)
// - Execution status (pending → running → completed/failed)
// - Tool result or error message
```

### 4. Updated ChatInput Layout

```typescript
// renderer/src/components/chat/ChatInput.tsx

export function ChatInput({ sessionId, agentId, onSend }: Props) {
  const { servers, enabledIds, toggle } = useMcpServers(sessionId);

  return (
    <div className="border-t">
      {/* MCP Selector - only show if servers are configured */}
      {servers.length > 0 && (
        <McpSelector
          sessionId={sessionId}
          availableServers={servers}
          enabledServerIds={enabledIds}
          onToggle={toggle}
        />
      )}

      {/* Existing options panel (thinking toggle) */}
      <ChatOptionsPanel ... />

      {/* Existing textarea and send button */}
      <div className="flex gap-2 p-4">
        <Textarea ... />
        <Button onClick={handleSend}>Ship</Button>
      </div>
    </div>
  );
}
```

---

## Hooks

### `useMcpServers` - Manage session MCP selection

```typescript
// renderer/src/hooks/useMcpServers.ts

export function useMcpServers(sessionId: string) {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Map<string, McpClientStatus>>(new Map());

  // Fetch all available servers
  useEffect(() => {
    fetch("/api/mcp-servers")
      .then((res) => res.json())
      .then(setServers);
  }, []);

  // Fetch session's enabled servers
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/mcp`)
      .then((res) => res.json())
      .then((data) => {
        setEnabledIds(data.enabledServerIds);
        setStatus(new Map(data.status.map((s) => [s.serverId, s])));
      });
  }, [sessionId]);

  const toggle = useCallback(async (serverId: string, enabled: boolean) => {
    const newIds = enabled
      ? [...enabledIds, serverId]
      : enabledIds.filter((id) => id !== serverId);

    await fetch(`/api/sessions/${sessionId}/mcp`, {
      method: "PUT",
      body: JSON.stringify({ enabledServerIds: newIds }),
    });

    setEnabledIds(newIds);
  }, [sessionId, enabledIds]);

  return { servers, enabledIds, status, toggle };
}
```

---

## Implementation Phases

### Phase 1: Foundation (Database & Types)
1. Add `mcp_servers` and `session_mcp_servers` tables to schema
2. Create type definitions in `types/mcp.ts`
3. Run `npm run db:push` to update database
4. Create API routes for MCP server CRUD (`/api/mcp-servers`)

### Phase 2: MCP Client Layer
1. Create `lib/mcp/` directory structure
2. Implement `McpClientPool` with both transport types
3. Implement session pool registry
4. Add connection testing endpoint

### Phase 3: Settings UI
1. Add MCP Servers section to settings page
2. Implement add/edit/delete server forms
3. Add connection test functionality with tool discovery preview

### Phase 4: Session MCP Management
1. Create session MCP API endpoints
2. Implement `useMcpServers` hook
3. Add `McpSelector` component above chat input
4. Wire up enable/disable functionality

### Phase 5: Tool Execution
1. Modify `/api/chat` to include MCP tools
2. Handle tool execution loop with `maxSteps`
3. Persist tool calls and results to items table
4. Enhance `AgentActivity` component for better tool display

### Phase 6: Polish & Edge Cases
1. Handle MCP server disconnections gracefully
2. Add loading states and error handling
3. Implement reconnection logic
4. Add tool execution timeout handling
5. Clean up pools when sessions are deleted

---

## Security Considerations

1. **API Key Storage**: MCP server credentials (env vars, headers) should be stored securely. Consider encryption at rest for sensitive values.

2. **Stdio Sandboxing**: Stdio-based MCPs run local processes. Document which MCPs are "trusted" and consider limiting which commands can be configured.

3. **Tool Permissions**: Future enhancement - allow users to approve/deny specific tools or tool categories.

4. **Session Isolation**: Each session has its own MCP client pool. Ensure proper cleanup on session deletion.

---

## Testing Checklist

- [ ] Add stdio MCP server (e.g., filesystem access)
- [ ] Add HTTP MCP server (e.g., hosted API)
- [ ] Test connection displays discovered tools
- [ ] Enable MCP for session, verify tools appear in agent
- [ ] Execute tool call, verify result persisted
- [ ] Multi-step tool execution (agent uses result)
- [ ] Disable MCP mid-conversation, verify tools removed
- [ ] Session deletion cleans up MCP connections
- [ ] Error handling: server unavailable, tool execution fails
- [ ] Concurrent sessions with different MCP configurations

---

## Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "ai": "^4.x",  // Already present, may need update for MCP
    "@ai-sdk/mcp-client": "^x.x"  // If separate package
  }
}
```

Note: Check AI SDK documentation for exact package requirements for MCP client functionality.

---

## Open Questions

1. **Tool Approval Flow**: Should users confirm tool execution, or allow auto-execution? Could be a per-server setting.

2. **Tool Result Display**: How verbose should tool results be in the UI? Collapsible by default?

3. **MCP Server Presets**: Should we ship with common MCP server presets (Todoist, Notion, GitHub) that users can one-click install?

4. **Cost Tracking**: Tool calls may increase token usage significantly with multi-step loops. Track and display?
