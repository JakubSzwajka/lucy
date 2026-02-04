# Hooks

React custom hooks for state management and async data fetching in the Lucy desktop app.

## Purpose

This layer provides reusable hooks that encapsulate:

- **API communication** with Next.js API routes
- **State management** for CRUD operations
- **Optimistic updates** for responsive UI
- **Error handling** and loading states
- **Real-time streaming** for AI chat interactions

All hooks are client-side only (`"use client"`) and follow consistent patterns for data fetching, mutation, and state synchronization.

---

## Hooks Reference

### useAgentChat

**File:** `useAgentChat.ts`

Manages AI chat interactions with streaming support. Wraps the `@ai-sdk/react` useChat hook and integrates with the agent/items persistence layer.

**Parameters:**
```typescript
interface UseAgentChatOptions {
  sessionId: string | null;
  agentId: string | null;
  model: string;
}
```

**Returns:**
```typescript
interface UseAgentChatReturn {
  messages: ChatMessage[];        // Merged loaded + streaming messages
  items: Item[];                  // All persisted items for the agent
  agent: Agent | null;            // Current agent data
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  isLoading: boolean;             // True during streaming or submission
  isInitialized: boolean;         // True once agent data is loaded
}
```

**Key Features:**
- Loads agent and items from `/api/agents/:id` on agentId change
- Uses `DefaultChatTransport` to stream via `/api/chat`
- Persists user messages to `/api/agents/:id/items` before sending
- Merges persisted items with streaming messages for unified display
- Supports thinking/reasoning toggle per message

---

### useSessions

**File:** `useSessions.ts`

Manages conversation sessions (CRUD operations).

**Returns:**
```typescript
{
  sessions: Session[];
  isLoading: boolean;
  createSession: (title?: string) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  refreshSessions: () => void;
}
```

**API Endpoints:**
- `GET /api/sessions` - Fetch all sessions
- `POST /api/sessions` - Create session
- `DELETE /api/sessions/:id` - Delete session

---

### useSystemPrompts

**File:** `useSystemPrompts.ts`

Manages reusable system prompts for AI agents.

**Returns:**
```typescript
{
  prompts: SystemPrompt[];
  isLoading: boolean;
  error: Error | null;
  createPrompt: (data: SystemPromptCreate) => Promise<SystemPrompt>;
  updatePrompt: (id: string, data: SystemPromptUpdate) => Promise<SystemPrompt>;
  deletePrompt: (id: string) => Promise<void>;
  refreshPrompts: () => void;
}
```

**API Endpoints:**
- `GET /api/system-prompts` - Fetch all prompts
- `POST /api/system-prompts` - Create prompt
- `PATCH /api/system-prompts/:id` - Update prompt
- `DELETE /api/system-prompts/:id` - Delete prompt

**Note:** Prompts are automatically sorted alphabetically by name.

---

### useMcpServers

**File:** `useMcpServers.ts`

Manages MCP (Model Context Protocol) server configurations.

**Returns:**
```typescript
{
  servers: McpServer[];
  isLoading: boolean;
  error: string | null;
  createServer: (data: McpServerCreate) => Promise<McpServer>;
  updateServer: (id: string, data: McpServerUpdate) => Promise<McpServer>;
  deleteServer: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; tools?: string[]; error?: string }>;
  refreshServers: () => void;
}
```

**API Endpoints:**
- `GET /api/mcp-servers` - Fetch all servers
- `POST /api/mcp-servers` - Create server
- `PATCH /api/mcp-servers/:id` - Update server
- `DELETE /api/mcp-servers/:id` - Delete server
- `POST /api/mcp-servers/:id/test` - Test connection

---

### useMcpStatus

**File:** `useMcpStatus.ts`

Monitors MCP server connection status and available tools. Provides optimistic updates when toggling servers.

**Returns:**
```typescript
interface UseMcpStatusResult {
  allServers: McpServer[];              // All configured servers
  enabledServers: McpServerStatus[];    // Enabled servers with connection status
  totalTools: number;                   // Total tools across connected servers
  isLoading: boolean;
  error: string | null;
  toggleServer: (serverId: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}
```

**API Endpoints:**
- `GET /api/mcp-servers` - Fetch server configurations
- `GET /api/mcp-servers/status` - Fetch connection status
- `PATCH /api/mcp-servers/:id` - Toggle enabled state

**Key Features:**
- Optimistic updates when toggling server enabled state
- Automatic rollback on API failure
- Parallel fetching of servers and status

---

### useSettings

**File:** `useSettings.ts`

Manages application-wide user settings with optimistic updates.

**Returns:**
```typescript
{
  settings: UserSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: SettingsUpdate) => Promise<void>;
  refreshSettings: () => void;
}
```

**API Endpoints:**
- `GET /api/settings` - Fetch settings
- `PATCH /api/settings` - Update settings

**Key Features:**
- Optimistic update with automatic rollback on error
- Preserves previous state for error recovery

---

### usePlan

**File:** `usePlan.ts`

Monitors plan execution progress with adaptive polling.

**Parameters:**
```typescript
interface UsePlanOptions {
  sessionId: string | null;
  activePollingInterval?: number;   // Default: 1500ms
  idlePollingInterval?: number;     // Default: 3000ms
  isAgentResponding?: boolean;      // Triggers refresh on transition to false
}
```

**Returns:**
```typescript
interface UsePlanReturn {
  plan: Plan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

**API Endpoints:**
- `GET /api/plans?sessionId=:id` - Fetch plan for session

**Key Features:**
- Adaptive polling intervals based on plan state:
  - 800ms when agent is responding (real-time updates)
  - 1500ms for active plans (default)
  - 3000ms when no plan exists (idle)
  - No polling for completed/failed/cancelled plans
- Immediate refresh when agent finishes responding

---

## Patterns

### Data Fetching Pattern

All hooks follow a consistent fetch-on-mount pattern:

```typescript
const [data, setData] = useState<T[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<Error | null>(null);

const fetchData = useCallback(async () => {
  try {
    setError(null);
    const response = await fetch("/api/resource");
    if (!response.ok) throw new Error("Failed to fetch");
    const result = await response.json();
    setData(result);
  } catch (err) {
    setError(err instanceof Error ? err : new Error("Unknown error"));
  } finally {
    setIsLoading(false);
  }
}, []);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### Optimistic Update Pattern

Used in `useSettings` and `useMcpStatus` for responsive UI:

```typescript
const updateResource = useCallback(async (updates: Updates) => {
  // 1. Save previous state
  const previousState = currentState;

  // 2. Optimistically update UI
  setState({ ...currentState, ...updates });

  try {
    // 3. Make API request
    const response = await fetch("/api/resource", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error("Failed");

    // 4. Update with server response
    const result = await response.json();
    setState(result);
  } catch (err) {
    // 5. Rollback on error
    setState(previousState);
    throw err;
  }
}, [currentState]);
```

### Mutation with Local State Update

Used in `useSessions`, `useSystemPrompts`, `useMcpServers`:

```typescript
const createResource = useCallback(async (data: CreateData) => {
  const response = await fetch("/api/resource", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to create");

  const created = await response.json();
  // Update local state without refetching
  setResources((prev) => [...prev, created]);
  return created;
}, []);
```

### Timestamp Conversion

API responses return ISO strings; hooks convert to Date objects:

```typescript
const data = await response.json();
setItems(
  data.map((item: Record<string, unknown>) => ({
    ...item,
    createdAt: new Date(item.createdAt as string),
    updatedAt: new Date(item.updatedAt as string),
  }))
);
```

---

## Usage Examples

### Chat with Agent

```typescript
function ChatView({ sessionId, agentId }: Props) {
  const { messages, sendMessage, isLoading, isInitialized } = useAgentChat({
    sessionId,
    agentId,
    model: "claude-3-5-sonnet",
  });

  if (!isInitialized) return <Spinner />;

  return (
    <div>
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      <Input
        onSubmit={(text) => sendMessage(text, { thinkingEnabled: true })}
        disabled={isLoading}
      />
    </div>
  );
}
```

### Session Management

```typescript
function SessionList() {
  const { sessions, isLoading, createSession, deleteSession } = useSessions();

  const handleNew = async () => {
    const session = await createSession("New Chat");
    if (session) router.push(`/chat/${session.id}`);
  };

  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>
          {s.title}
          <button onClick={() => deleteSession(s.id)}>Delete</button>
        </li>
      ))}
      <button onClick={handleNew}>New Session</button>
    </ul>
  );
}
```

### Settings with Optimistic Update

```typescript
function SettingsPanel() {
  const { settings, updateSettings, isLoading } = useSettings();

  const handleModelChange = async (modelId: string) => {
    // UI updates immediately, rolls back if API fails
    await updateSettings({ defaultModelId: modelId });
  };

  if (isLoading || !settings) return <Spinner />;

  return (
    <Select value={settings.defaultModelId} onChange={handleModelChange}>
      {/* model options */}
    </Select>
  );
}
```

### Plan Monitoring

```typescript
function PlanView({ sessionId, isAgentResponding }: Props) {
  const { plan, isLoading } = usePlan({
    sessionId,
    isAgentResponding,
    activePollingInterval: 1500,
  });

  if (!plan) return null;

  return (
    <div>
      <h3>{plan.title}</h3>
      <Progress value={plan.progress?.percentage ?? 0} />
      {plan.steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
}
```

---

## Dependencies

| Hook | API Routes | External Libraries |
|------|------------|-------------------|
| `useAgentChat` | `/api/chat`, `/api/agents/:id`, `/api/agents/:id/items` | `@ai-sdk/react`, `ai` |
| `useSessions` | `/api/sessions`, `/api/sessions/:id` | - |
| `useSystemPrompts` | `/api/system-prompts`, `/api/system-prompts/:id` | - |
| `useMcpServers` | `/api/mcp-servers`, `/api/mcp-servers/:id`, `/api/mcp-servers/:id/test` | - |
| `useMcpStatus` | `/api/mcp-servers`, `/api/mcp-servers/status`, `/api/mcp-servers/:id` | - |
| `useSettings` | `/api/settings` | - |
| `usePlan` | `/api/plans` | - |

### Type Dependencies

All hooks import types from `@/types`:
- `Session`, `Agent`, `Item`, `ChatMessage`
- `SystemPrompt`, `SystemPromptCreate`, `SystemPromptUpdate`
- `McpServer`, `McpServerCreate`, `McpServerUpdate`, `McpServerStatus`
- `UserSettings`, `SettingsUpdate`

The `usePlan` hook imports `Plan` from `@/components/plan`.
