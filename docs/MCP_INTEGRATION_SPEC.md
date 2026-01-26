# MCP Integration Specification

## Executive Summary

This document specifies the integration of Model Context Protocol (MCP) into Lucy, enabling AI agents to use external tools from providers like Todoist, Notion, GitHub, and custom services.

**Core Requirements:**
- Users can configure multiple MCP servers in Settings
- Each MCP server has an approval setting: "always ask" or "auto-execute"
- Per-session tool selection: users choose which MCPs are active for each conversation
- Tool execution details displayed in UI (similar to reasoning blocks)

---

## 1. Background & Context

### What is MCP?

Model Context Protocol is a standard for connecting AI models to external tools and data sources. An MCP server exposes a set of tools (functions) that an AI can invoke during a conversation.

**Transport Types:**
- **Stdio**: Local process communication. The MCP server runs as a CLI tool (e.g., `npx @anthropic/mcp-todoist`). Best for local tools, filesystem access, or tools requiring local credentials.
- **HTTP/SSE**: Remote server communication. The MCP server is hosted somewhere and accessed via HTTP. Best for cloud services with their own hosting.

### How AI SDK Handles MCP

The Vercel AI SDK provides `createMCPClient()` which:
1. Connects to an MCP server via configured transport
2. Discovers available tools (name, description, input schema)
3. Returns tool definitions compatible with `streamText()`

When the AI decides to use a tool:
1. AI SDK parses the tool call from the model response
2. Executes the tool via the MCP client
3. Returns the result to the model for continued reasoning
4. This loop continues until the model produces a final response (controlled by `maxSteps`)

### Current Lucy Architecture

Lucy already has:
- Multi-agent sessions with parent-child hierarchy
- Polymorphic `items` table storing messages, tool_calls, tool_results, reasoning
- Streaming chat API using AI SDK's `streamText()`
- Settings system with single-row configuration

What's missing:
- MCP server configuration storage
- MCP client connection management
- Tool discovery and execution
- UI for server management and tool selection

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                              SETTINGS                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ MCP Server Registry                                            │ │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │ │
│  │ │ Todoist      │ │ Filesystem   │ │ Custom API   │            │ │
│  │ │ stdio        │ │ stdio        │ │ http         │            │ │
│  │ │ ☑ Auto-exec  │ │ ☐ Ask first  │ │ ☑ Auto-exec  │            │ │
│  │ └──────────────┘ └──────────────┘ └──────────────┘            │ │
│  └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                              SESSION                                 │
│  Enabled MCPs: [Todoist ✓] [Filesystem ✓] [Custom API ✗]           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                         CHAT API                               │ │
│  │  1. Receive message                                            │ │
│  │  2. Load enabled MCPs for session                              │ │
│  │  3. Connect to MCP servers (if not already connected)          │ │
│  │  4. Discover tools from each server                            │ │
│  │  5. Pass tools to streamText()                                 │ │
│  │  6. On tool call:                                              │ │
│  │     - Check approval setting                                   │ │
│  │     - If "ask first": pause, request user approval via UI      │ │
│  │     - Execute tool via MCP client                              │ │
│  │     - Persist tool_call and tool_result items                  │ │
│  │  7. Loop until model produces final response                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### New Table: `mcp_servers`

Stores the registry of configured MCP servers.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | Display name (e.g., "Todoist", "My Filesystem") |
| description | TEXT | Optional user notes |
| transport_type | ENUM | "stdio" \| "sse" \| "http" |
| command | TEXT | For stdio: the executable (e.g., "npx", "/usr/local/bin/mcp-server") |
| args | JSON | For stdio: array of arguments (e.g., ["@anthropic/mcp-todoist"]) |
| env | JSON | For stdio: environment variables (e.g., {"TODOIST_API_KEY": "..."}) |
| url | TEXT | For http/sse: server URL |
| headers | JSON | For http/sse: auth headers (e.g., {"Authorization": "Bearer ..."}) |
| require_approval | BOOLEAN | If true, user must approve each tool execution |
| enabled | BOOLEAN | If false, server is disabled globally |
| icon_url | TEXT | Optional icon for UI |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Design Decisions:**
- Store transport config as separate fields (not polymorphic JSON) for easier querying and validation
- `require_approval` is per-server, not per-tool. Simpler UX, tools from same server typically have similar trust levels
- `enabled` allows temporarily disabling a server without deleting it

### New Table: `session_mcp_servers`

Junction table linking sessions to their active MCP servers.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PK | UUID |
| session_id | TEXT FK | References sessions.id, CASCADE delete |
| mcp_server_id | TEXT FK | References mcp_servers.id, CASCADE delete |
| created_at | TIMESTAMP | |

**Why per-session, not per-agent?**
- Simpler mental model: "this conversation has these tools available"
- Agents within a session collaborate; inconsistent tool access would be confusing
- Per-agent would require complex UI for each agent in the hierarchy

### Existing Table: `items`

Already supports tool_call and tool_result types. No schema changes needed, but ensure these fields are properly populated:

- `tool_call`: callId, toolName, toolArgs (JSON), toolStatus (pending/running/completed/failed)
- `tool_result`: callId (matches tool_call), toolOutput (JSON string), toolError (string)

**Enhancement:** Consider adding `mcp_server_id` to tool_call items for debugging/display purposes. This lets the UI show which server provided each tool.

---

## 4. MCP Client Management

### Connection Pool Pattern

MCP connections should be managed per-session to:
- Avoid reconnecting on every message
- Properly clean up when sessions end
- Isolate failures between sessions

**Implementation Approach:**

Create a `McpClientPool` class that:
1. Takes a list of server configs
2. Establishes connections lazily (on first use) or eagerly (on session MCP change)
3. Caches discovered tools per server
4. Provides a unified tool map for the chat API
5. Handles disconnection and cleanup

**Key Considerations:**

- **Connection Lifecycle**: For stdio transports, the child process stays alive for the session duration. For HTTP, connections are stateless but the client instance caches tool schemas.

- **Error Handling**: If a server fails to connect, log the error but don't block the session. The tools from that server simply won't be available. Show status in UI.

- **Tool Namespacing**: Multiple servers might have tools with the same name. Namespace tools as `{serverId}:{toolName}` internally, but display just the tool name in UI with a server badge.

- **Session Cleanup**: When a session is deleted, ensure all MCP connections are closed. Register cleanup handlers.

### Registry Pattern

Use a module-level registry (Map) to track pools by session ID:

```
sessionId -> McpClientPool instance
```

This allows the chat API to get the pool for the current session without passing it through the request chain.

**Important:** This registry lives in the Next.js server process. In development with hot reload, be aware that the registry may reset. In production with standalone mode, it persists for the server lifetime.

---

## 5. API Design

### MCP Server CRUD: `/api/mcp-servers`

Standard REST endpoints for managing the server registry.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/mcp-servers | List all configured servers |
| POST | /api/mcp-servers | Add a new server |
| GET | /api/mcp-servers/[id] | Get server details |
| PATCH | /api/mcp-servers/[id] | Update server config |
| DELETE | /api/mcp-servers/[id] | Remove server |
| POST | /api/mcp-servers/[id]/test | Test connection, return discovered tools |

**Test Endpoint Behavior:**
1. Create temporary MCP client with server config
2. Attempt connection
3. If successful, discover and return tool list
4. Close connection (don't persist)
5. Return success/failure with tools or error message

### Session MCP Management: `/api/sessions/[id]/mcp`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sessions/[id]/mcp | Get enabled servers + connection status + tools |
| PUT | /api/sessions/[id]/mcp | Set enabled server IDs |

**GET Response Shape:**
```json
{
  "enabledServers": [
    {
      "id": "uuid",
      "name": "Todoist",
      "requireApproval": false,
      "connected": true,
      "tools": [
        { "name": "create_task", "description": "..." },
        { "name": "list_tasks", "description": "..." }
      ]
    }
  ]
}
```

**PUT Request Shape:**
```json
{
  "enabledServerIds": ["uuid1", "uuid2"]
}
```

When enabled servers change:
1. Update junction table
2. Connect to newly enabled servers
3. Disconnect from removed servers
4. Return updated status

### Chat API Modifications: `/api/chat`

The existing chat route needs these changes:

1. **Accept sessionId** in request (currently only has agentId)
2. **Load enabled MCPs** for the session
3. **Get or create pool** for the session
4. **Build tool map** from connected servers
5. **Configure streamText** with tools and `maxSteps` (suggest: 10)
6. **Handle tool execution** with approval flow

**Tool Execution with Approval:**

When `require_approval` is true for a server:
1. Pause the stream when tool call is detected
2. Save tool_call item with status "pending_approval"
3. Return a special event to the client indicating approval needed
4. Client shows approval UI
5. Client sends approval/rejection
6. If approved: execute tool, continue stream
7. If rejected: return rejection to model, let it try something else

**Alternative (Simpler) Approach:**
For v1, implement approval as a blocking confirmation before execution. The stream pauses, client shows dialog, user clicks approve/reject. This avoids complex state management but means the connection stays open during approval.

---

## 6. UI Components

### Settings: MCP Server Management

**Location:** Settings page, new "MCP Servers" section (tab or accordion)

**Components Needed:**

1. **McpServerList**: Shows all configured servers as cards
   - Each card shows: name, transport type, enabled status, approval setting
   - Actions: Edit, Delete, Test Connection
   - Add Server button

2. **McpServerForm**: Modal/dialog for add/edit
   - Name field
   - Description field (optional)
   - Transport type selector (radio buttons)
   - Conditional fields based on transport:
     - Stdio: Command, Args (textarea, one per line), Env vars (key=value per line)
     - HTTP/SSE: URL, Headers (key=value per line)
   - Checkbox: "Require approval before executing tools"
   - Test Connection button (shows discovered tools on success)
   - Save/Cancel buttons

3. **McpServerTestResult**: Shows connection test results
   - Success: green checkmark + list of discovered tools
   - Failure: red X + error message

**UX Considerations:**
- Env vars and headers may contain secrets. Consider masking values after save.
- Show clear feedback during connection test (loading state)
- Validate required fields before allowing test/save

### Chat: MCP Selector

**Location:** Above the message input textarea (as specified)

**Component:** `McpSelector`

**Behavior:**
- Shows only if at least one MCP server is configured
- Displays currently enabled MCPs as removable chips/badges
- "Add" button opens dropdown/popover with available (not yet enabled) servers
- Clicking a chip removes that MCP from the session
- Changes persist immediately (optimistic UI + API call)

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Tools: [+ Add]  [Todoist ×]  [Filesystem ×]                     │
├─────────────────────────────────────────────────────────────────┤
│ [Thinking toggle]                                               │
├─────────────────────────────────────────────────────────────────┤
│ [Message input textarea...]                              [Send] │
└─────────────────────────────────────────────────────────────────┘
```

**States:**
- Loading: Show skeleton while fetching server list
- Empty: Hide entirely if no servers configured (or show subtle "Configure MCP in Settings")
- Error: If a server fails to connect, show warning badge on its chip

### Chat: Tool Activity Display

**Location:** In message thread, similar to reasoning blocks

**Requirement:** Show tool execution details for debugging, collapsible like reasoning.

**Component:** Enhance existing `AgentActivity` or create `ToolActivityBlock`

**Information to Display:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔧 Tool Call: create_task                        [Todoist]      │
│ ▼ Arguments                                                     │
│   {                                                             │
│     "title": "Buy groceries",                                   │
│     "due_date": "2024-01-15"                                    │
│   }                                                             │
│ ▼ Result                                                        │
│   {                                                             │
│     "task_id": "12345",                                         │
│     "created": true                                             │
│   }                                                             │
│ Status: ✓ Completed in 234ms                                    │
└─────────────────────────────────────────────────────────────────┘
```

**States:**
- Pending Approval: Show approval buttons (if require_approval is true)
- Running: Show spinner
- Completed: Show result (collapsible JSON)
- Failed: Show error message with red styling

**Collapsible Behavior:**
- Default: Collapsed (show tool name + status only)
- Click to expand: Show full arguments and result
- Same interaction pattern as reasoning blocks

### Chat: Tool Approval Dialog

**When:** User has `require_approval` enabled for a server and agent wants to use a tool

**Component:** `ToolApprovalDialog` or inline approval in ToolActivityBlock

**Content:**
- Tool name and server name
- What the tool will do (tool description)
- Arguments the agent is passing
- Approve / Reject buttons

**Behavior:**
- Blocks further processing until user responds
- Approve: Execute tool, continue conversation
- Reject: Return rejection to model (it may try different approach)

---

## 7. Implementation Guidance

### State Management

**Server-side State (Next.js API routes):**
- MCP client pool registry (module-level Map)
- Database for persistent config

**Client-side State:**
- Use React hooks with SWR or React Query for server list (cache + revalidation)
- Local state for form inputs
- Optimistic updates for MCP selection changes

### Error Handling Patterns

**Connection Failures:**
- Don't block the session; just mark that server as unavailable
- Show status in UI so user knows
- Allow retry via "reconnect" action

**Tool Execution Failures:**
- Persist the error to tool_result item
- Show error in UI
- Let model see the error (it may try to recover)

**Timeout Handling:**
- Set reasonable timeouts for MCP calls (suggest: 30 seconds)
- On timeout, treat as failure
- Consider per-server timeout config for slow tools

### Security Considerations

**Credential Storage:**
- API keys in env vars and headers are sensitive
- Store in database (acceptable for local desktop app)
- For extra security, consider encrypting at rest (using Electron's safeStorage API)

**Stdio Command Execution:**
- Users can configure arbitrary commands
- This is intentional (power user feature)
- Document clearly that this runs local processes

**Input Validation:**
- Validate server configs before saving
- Sanitize tool arguments before display (prevent XSS if rendering HTML)

### Testing Strategy

**Unit Tests:**
- MCP client pool logic (connect, disconnect, tool discovery)
- Database operations for server CRUD
- Tool namespacing logic

**Integration Tests:**
- Full flow: configure server → enable for session → execute tool
- Approval flow: pause → approve → continue
- Error cases: server unavailable, tool fails

**Manual Testing Checklist:**
- [ ] Add stdio MCP server (e.g., `npx -y @anthropic-ai/claude-code-mcp`)
- [ ] Add HTTP MCP server
- [ ] Test connection shows discovered tools
- [ ] Enable MCP for session
- [ ] Chat triggers tool use
- [ ] Tool call/result appears in UI with full details
- [ ] Approval flow works (when enabled)
- [ ] Disabling MCP removes tools from session
- [ ] Session deletion cleans up connections
- [ ] Server deletion removes from all sessions

---

## 8. Implementation Phases

### Phase 1: Data Layer
- Add database schema (mcp_servers, session_mcp_servers tables)
- Create type definitions
- Implement MCP server CRUD API routes
- No UI yet; test via API directly

### Phase 2: Settings UI
- Build MCP server list component
- Build add/edit form with transport-specific fields
- Implement connection testing with tool discovery display
- Wire up to API routes

### Phase 3: MCP Client Layer
- Implement McpClientPool class
- Implement session pool registry
- Add session MCP API endpoints
- Test connection lifecycle

### Phase 4: Session MCP Selection UI
- Build McpSelector component
- Add to ChatInput layout
- Implement useMcpServers hook
- Test enable/disable flow

### Phase 5: Tool Execution
- Modify chat API to inject MCP tools
- Implement tool execution loop
- Persist tool_call and tool_result items
- Handle multi-step execution (maxSteps)

### Phase 6: Tool Display UI
- Enhance AgentActivity or create ToolActivityBlock
- Show collapsible arguments/results (like reasoning)
- Add status indicators and timing

### Phase 7: Approval Flow
- Implement approval pause/resume in chat API
- Build ToolApprovalDialog component
- Wire up approve/reject actions
- Test full approval flow

### Phase 8: Polish
- Error handling and recovery
- Loading states throughout
- Edge cases (server goes away mid-conversation, etc.)
- Documentation for users

---

## 9. Dependencies

**Installed:**
- `ai` package v6.x (Vercel AI SDK) - provides `tool()`, `streamText()`, `stepCountIs()`
- `@ai-sdk/mcp` - MCP client for HTTP/SSE transports (optional, using @modelcontextprotocol/sdk instead)
- `@modelcontextprotocol/sdk` - Official MCP SDK with stdio + SSE support
- `zod` v4 - Schema validation for tool parameters

**Stdio Transport:**
- Uses `@modelcontextprotocol/sdk/client/stdio.js`
- Spawns child process via `cross-spawn`
- Works in Next.js API routes (server-side only)

**HTTP/SSE Transport:**
- Uses `@modelcontextprotocol/sdk/client/sse.js`
- Standard fetch-based communication

---

## 10. Implementation Status

### Completed (v1)
- MCP server configuration storage and CRUD
- Settings UI for managing MCP servers
- Per-server approval toggle
- MCP client connection pool (stdio + HTTP/SSE)
- Session-level MCP server selection
- MCP selector dropdown in chat input
- Tool execution via AI SDK with multi-step support
- Tool call/result display in activity blocks
- Database schema for tool_call status (including pending_approval)

### Simplified in v1
- **Approval Flow**: Currently logs a warning when approval is required but executes anyway. Full blocking approval flow requires complex streaming state management and is deferred.

### Future Enhancements

1. **Full Approval Flow**: Implement blocking approval with UI dialog before tool execution

2. **Tool Usage Analytics**: Track which tools are used most, success rates, etc.

3. **Tool Shortcuts**: Allow users to trigger specific tools directly (not just via agent)

4. **Per-Tool Approval**: Currently approval is per-server. Could add per-tool granularity later.

5. **MCP Server Health Monitoring**: Background pings to check server availability

6. **Import/Export**: Allow exporting server configs for backup or sharing

---

## Appendix: AI SDK MCP Reference

Key functions from AI SDK for implementer reference:

```typescript
import { createMCPClient } from "ai";

// Create client with stdio transport
const client = await createMCPClient({
  transport: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@some/mcp-server"],
    env: { API_KEY: "..." }
  }
});

// Create client with HTTP transport
const client = await createMCPClient({
  transport: {
    type: "http",
    url: "https://mcp.example.com",
    headers: { Authorization: "Bearer ..." }
  }
});

// Discover tools (returns object compatible with streamText tools param)
const tools = await client.tools();

// Use with streamText
const result = streamText({
  model: yourModel,
  messages: [...],
  tools: tools,
  maxSteps: 10, // Allow multi-turn tool use
  onFinish: async () => {
    await client.close(); // Clean up when done
  }
});

// Close client when done
await client.close();
```

Refer to https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools for latest API details.
