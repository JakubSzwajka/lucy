# Tools System

Provider-based tool registry that unifies tools from multiple sources. Located in `renderer/src/lib/tools/`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ToolRegistry                           │
│                        (singleton)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ MCP Provider │  │   Builtin    │  │   Integration    │  │
│  │              │  │   Provider   │  │    Provider      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Unified Tool Collection                 │   │
│  │                                                      │   │
│  │   mcp__server__tool    builtin__cat__tool           │   │
│  │   integration__knowledge__save_fact                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              toAiSdkTools()                          │   │
│  │        Converts to Vercel AI SDK format              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Tool Key Format

Tools are identified by a composite key: `{sourceType}__{sourceId}__{toolName}`

| Source Type | Example Key |
|-------------|-------------|
| `mcp` | `mcp__filesystem__read_file` |
| `builtin` | `builtin__core__get_time` |
| `integration` | `integration__knowledge__save_fact` |
| `agent` | `agent__researcher__search` |

## Core Types

### ToolDefinition

```typescript
interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;  // Zod schema for validation
  source: ToolSource;

  // Execution handler
  execute: (args: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  // Optional: require user approval
  requiresApproval?: boolean | ((args: TInput) => boolean);

  // Optional: custom validation beyond schema
  validate?: (args: TInput, context: ToolExecutionContext) => Promise<{
    valid: boolean;
    error?: string;
  }>;

  // Optional: transform output before returning to AI
  formatOutput?: (output: TOutput) => unknown;
}
```

### ToolSource

```typescript
type ToolSource =
  | { type: "mcp"; serverId: string; serverName: string }
  | { type: "builtin"; category: string }
  | { type: "integration"; integrationId: string }
  | { type: "agent"; agentId: string };
```

### ToolExecutionContext

Passed to every tool execution:

```typescript
interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  callId: string;  // UUID linking call → result

  // For tools that spawn sub-agents
  createChildAgent?: (config: ChildAgentConfig) => Promise<string>;

  // Session-scoped state storage
  getState: <T>(key: string) => T | undefined;
  setState: <T>(key: string, value: T) => void;
}
```

### ToolProvider

Abstraction for tool sources:

```typescript
interface ToolProvider {
  readonly name: string;

  getTools(): Promise<ToolDefinition[]>;
  isAvailable?(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

## Execution Pipeline

When a tool is called, the registry:

1. **Preprocess args** - Parse JSON strings that should be arrays/objects
2. **Validate with schema** - Run Zod validation
3. **Check approval** - Determine if user approval needed
4. **Save tool_call** - Persist to database items table
5. **Run custom validation** - If `validate()` provided
6. **Execute handler** - Call `execute()` with validated args
7. **Save tool_result** - Persist output or error
8. **Update status** - Mark as completed/failed

```typescript
// Simplified execution flow
async executeWithPersistence(key, definition, args, context) {
  const callId = uuidv4();

  // Preprocess and validate
  const preprocessed = this.preprocessArgs(args);
  const parsed = definition.inputSchema.parse(preprocessed);

  // Persist call
  await saveToolCall(agentId, callId, definition.name, parsed, status);

  try {
    // Execute
    const result = await definition.execute(parsed, context);

    // Persist result
    await saveToolResult(agentId, callId, result);
    await updateToolCallStatus(callId, "completed");

    return result;
  } catch (error) {
    await saveToolResult(agentId, callId, undefined, error.message);
    await updateToolCallStatus(callId, "failed");
    return { error: error.message };
  }
}
```

## Creating Tools

### Using defineTool helper

```typescript
import { defineTool } from "@/lib/tools/types";
import { z } from "zod";

export const myTool = defineTool({
  name: "my_tool",
  description: "Does something useful",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(10),
  }),
  source: { type: "builtin", category: "search" },

  async execute(args, context) {
    // Use context.sessionId, context.agentId, etc.
    return { results: [] };
  },
});
```

### Creating a Provider

```typescript
import { ToolProvider, ToolDefinition } from "@/lib/tools/types";

class MyProvider implements ToolProvider {
  readonly name = "my-provider";

  async getTools(): Promise<ToolDefinition[]> {
    return [myTool, anotherTool];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async initialize(): Promise<void> {
    // Setup connections, load config, etc.
  }

  async dispose(): Promise<void> {
    // Cleanup
  }
}
```

### Registering with Registry

```typescript
import { getToolRegistry } from "@/lib/tools/registry";

const registry = getToolRegistry();
registry.registerProvider(new MyProvider());

// Or register individual tools
registry.registerTool(myTool);
```

## Session State

Tools can store state scoped to the current session:

```typescript
async execute(args, context) {
  // Get state
  const counter = context.getState<number>("counter") ?? 0;

  // Set state
  context.setState("counter", counter + 1);

  return { count: counter + 1 };
}
```

State is cleared when `registry.clearSessionState(sessionId)` is called.

## Integration with AI SDK

The registry converts tools to Vercel AI SDK format:

```typescript
import { getToolRegistry } from "@/lib/tools/registry";

const registry = getToolRegistry();
const tools = await registry.toAiSdkTools({
  agentId: "agent-123",
  sessionId: "session-456",
});

// Use with AI SDK
const response = await generateText({
  model: openai("gpt-4"),
  tools,
  messages,
});
```

## File Structure

```
renderer/src/lib/tools/
├── index.ts              # Exports
├── types.ts              # Core type definitions
├── registry.ts           # ToolRegistry class
├── providers/
│   ├── index.ts
│   ├── mcp.ts            # MCP server provider
│   └── builtin.ts        # Built-in tools provider
├── builtin/
│   ├── index.ts
│   └── example.ts        # Example tools
├── integrations/
│   ├── index.ts
│   ├── types.ts          # Integration definition types
│   ├── provider.ts       # Integration provider
│   ├── todoist/          # Todoist integration
│   └── knowledge/        # Knowledge graph (see dedicated README)
└── utils/
    ├── index.ts
    └── persistence.ts    # Database persistence helpers
```

## See Also

- [Knowledge Integration](../renderer/src/lib/tools/integrations/knowledge/README.md) - File-based knowledge graph
- [Database Schema](database.md) - Items table for tool call persistence
