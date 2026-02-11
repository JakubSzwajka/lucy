# API Routes

> **Note:** These local API routes are **legacy**. The frontend now communicates with the cloud backend (`backend/`) via the API client at `renderer/src/lib/api/client.ts`. These routes remain in place for the embedded Electron server but are not used when the backend is running. All new development should target the backend API routes at `backend/src/app/api/`.

This directory contains all Next.js API routes for the Lucy desktop application. These routes serve as the HTTP interface between the React frontend and the backend services.

## Purpose

The API layer provides:

- **RESTful endpoints** for CRUD operations on sessions and configuration
- **Streaming endpoints** for real-time AI chat responses
- **Service delegation** - routes are thin controllers that delegate business logic to services
- **Consistent error handling** with proper HTTP status codes

## Architecture

```
Frontend (React)
      |
      v
  API Client (@/lib/api/client)    <-- Authenticated requests
      |
      v
  Cloud Backend (backend/)
      |
      v
  Backend API Routes (/api/*)
      |
      v
  Services (backend/src/lib/services)
      |
      v
  Database (SQLite/PostgreSQL)

  ─── LEGACY PATH (kept for Electron standalone) ───

Frontend (React)
      |
      v
  Local API Routes (/api/*)       <-- This directory
      |
      v
  Services (@/lib/services)
      |
      v
  Database (SQLite)
```

Routes follow a consistent pattern:
1. Parse and validate request parameters
2. Get the appropriate service singleton
3. Call service methods
4. Return JSON responses with appropriate status codes

---

## Routes Reference

### Sessions

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create a new session with root agent |
| `GET` | `/api/sessions/[id]` | Get session with its agents and items |
| `PATCH` | `/api/sessions/[id]` | Update session (title, status) |
| `DELETE` | `/api/sessions/[id]` | Delete session (cascades to agents and items) |
| `POST` | `/api/sessions/[id]/chat` | Stream AI chat response for a session |
| `GET` | `/api/sessions/[id]/plans` | Get plan for a session with progress |

**Create Session Request:**
```json
{
  "title": "Optional title",
  "agentName": "Optional agent name",
  "systemPrompt": "Optional system prompt",
  "model": "Optional model ID"
}
```

### Chat (Streaming)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/sessions/[id]/chat` | Stream AI chat response for a session |

**Session Chat Request:**
```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "optional model ID override",
  "thinkingEnabled": true
}
```

The session chat route delegates to `ChatService.executeTurn()` which:
1. Resolves the session's root agent
2. Saves the latest user message server-side
3. Auto-generates session title from first message
4. Prepares AI context (model, tools, system prompt)
5. Streams AI response via SSE
6. Persists each streaming step and finalizes agent status

### Settings

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/settings` | Get current application settings |
| `PATCH` | `/api/settings` | Update settings |

**Update Settings Request:**
```json
{
  "defaultModelId": "model-id",
  "defaultSystemPromptId": "prompt-id",
  "enabledModels": ["model-1", "model-2"]
}
```

### System Prompts

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/system-prompts` | List all system prompts |
| `POST` | `/api/system-prompts` | Create a new system prompt |
| `GET` | `/api/system-prompts/[id]` | Get a single system prompt |
| `PATCH` | `/api/system-prompts/[id]` | Update a system prompt |
| `DELETE` | `/api/system-prompts/[id]` | Delete a system prompt |

**Create/Update Request:**
```json
{
  "name": "Prompt name",
  "content": "System prompt content"
}
```

### MCP Servers

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/mcp-servers` | List all MCP servers |
| `POST` | `/api/mcp-servers` | Create a new MCP server |
| `GET` | `/api/mcp-servers/[id]` | Get a single MCP server |
| `PATCH` | `/api/mcp-servers/[id]` | Update an MCP server |
| `DELETE` | `/api/mcp-servers/[id]` | Delete an MCP server |
| `GET` | `/api/mcp-servers/status` | Get connection status of all enabled MCP servers |
| `POST` | `/api/mcp-servers/[id]/test` | Test connection to an MCP server |

### Tools

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/tools` | List all registered tools from all providers |

**Response:**
```json
{
  "tools": [
    {
      "key": "tool-unique-key",
      "name": "Tool Name",
      "description": "What the tool does",
      "source": "built-in | mcp"
    }
  ]
}
```

### Providers

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/providers` | Get available AI providers and their models |

### Plans

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/sessions/[id]/plans` | Get plan for a session with progress |

**Response:**
```json
{
  "plan": {
    "id": "plan-id",
    "sessionId": "session-id",
    "steps": [...],
    "progress": {
      "total": 5,
      "completed": 2,
      "percentage": 40
    }
  }
}
```

### OpenAPI

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/openapi` | Get OpenAPI specification for the API |

---

## Request/Response Patterns

### Success Responses

- **200 OK** - Successful GET, PATCH requests
- **201 Created** - Successful POST requests that create resources
- **204 No Content** - Successful DELETE requests

### Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Description of what went wrong"
}
```

Common status codes:
- **400 Bad Request** - Missing required fields or validation errors
- **404 Not Found** - Resource does not exist
- **500 Internal Server Error** - Unexpected server errors

### Route Parameter Pattern

Dynamic route segments use Next.js 15's async params pattern:

```typescript
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  // ...
}
```

---

## Streaming

The `/api/sessions/[id]/chat` endpoint uses the Vercel AI SDK's streaming capabilities to provide real-time AI responses.

### How It Works

The route is a thin HTTP adapter that calls `ChatService.executeTurn()`. Internally, the turn:

1. **Session resolved** - `SessionService.getById()` resolves the root agent
2. **User message saved** - `ItemService.createMessage()` persists the latest user message
3. **Context preparation** - `ChatService.prepareChat()` resolves:
   - Agent and its configuration
   - Model and language model instance
   - System prompt (agent-specific or default)
   - Available tools from the tool registry
   - Provider-specific options (e.g., thinking/reasoning settings)
4. **Streaming initiated** - `streamText()` from the AI SDK handles:
   - Sending messages to the AI provider
   - Multi-step tool use (up to 10 steps with tools, 1 without)
   - Streaming response chunks back to the client
5. **Step persistence** - `onStepFinish` callback persists each step's content:
   - Reasoning blocks (if model supports it)
   - Text messages
   - Tool calls and results
   - Items are saved in their natural interleaved order
6. **Finalization** - `onFinish` callback updates agent status

### Response Format

The response uses `toUIMessageStreamResponse()` which sends:
- Text content as it streams
- Reasoning blocks (when `sendReasoning: true`)
- Tool calls and results
- Step completion events

### Step Persistence

The `persistStepContent` function in `step-persistence.service.ts` handles saving streaming content:

```
For each step:
1. Save reasoning blocks first (if any)
2. Process content parts in order:
   - Text parts: accumulate until interrupted
   - Tool calls: flush text, save tool call
   - Tool results: save result and update status
3. Flush any remaining text
```

This ensures the conversation history accurately reflects the AI's thought process.

---

## Service Layer

Routes delegate all business logic to services in `@/lib/services`. Each service follows the singleton pattern.

### Available Services

| Service | Getter | Description |
|---------|--------|-------------|
| `SessionService` | `getSessionService()` | Session CRUD, session-agent relationships |
| `AgentService` | `getAgentService()` | Agent CRUD, parent-child hierarchy |
| `ItemService` | `getItemService()` | Polymorphic item management |
| `ChatService` | `getChatService()` | Turn orchestrator (resolve session, stream AI, persist) |
| `SettingsService` | `getSettingsService()` | Application settings |
| `SystemPromptService` | `getSystemPromptService()` | System prompt management |
| `McpService` | `getMcpService()` | MCP server management and connections |
| `PlanService` | `getPlanService()` | Planning and step tracking |

### Service Result Pattern

Services return result objects that routes can easily convert to HTTP responses:

```typescript
// Service returns:
{ session: Session }           // Success
{ error: "message" }           // Validation error
{ notFound: true }             // Resource not found

// Route converts to:
NextResponse.json(result.session)                    // 200
NextResponse.json({ error }, { status: 400 })        // 400
NextResponse.json({ error }, { status: 404 })        // 404
```

### Example Route Pattern

```typescript
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const service = getSessionService();

  const session = service.getWithAgents(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
```

---

## File Structure

```
api/
├── README.md
├── sessions/
│   ├── route.ts                   # GET, POST - Session list/create
│   └── [id]/
│       ├── route.ts               # GET, PATCH, DELETE - Single session
│       ├── chat/
│       │   └── route.ts           # POST - Session chat streaming
│       └── plans/
│           └── route.ts           # GET - Get session plan
├── settings/
│   └── route.ts                   # GET, PATCH - App settings
├── system-prompts/
│   ├── route.ts                   # GET, POST - Prompt list/create
│   └── [id]/
│       └── route.ts               # GET, PATCH, DELETE - Single prompt
├── mcp-servers/
│   ├── route.ts                   # GET, POST - Server list/create
│   ├── status/
│   │   └── route.ts               # GET - All servers status
│   └── [id]/
│       ├── route.ts               # GET, PATCH, DELETE - Single server
│       └── test/
│           └── route.ts           # POST - Test server connection
├── tools/
│   └── route.ts                   # GET - List all tools
├── providers/
│   └── route.ts                   # GET - List AI providers
└── openapi/
    └── route.ts                   # GET - OpenAPI specification
```
