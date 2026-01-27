# Tool Architecture

This document describes the unified tool system that allows agents to use both MCP (Model Context Protocol) servers and programmatic tools defined in code.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tool Registry                             │
│                     (Global Singleton)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   MCP Provider   │  │ Builtin Provider │  │ Agent Provider│  │
│  │                  │  │                  │  │   (future)    │  │
│  │  • Dynamic       │  │  • Static tools  │  │               │  │
│  │  • External      │  │  • Code-defined  │  │  • Per-agent  │  │
│  │  • Multi-server  │  │  • Type-safe     │  │  • Dynamic    │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
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
                    │    Wrapper      │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   streamText()  │
                    │   Chat API      │
                    └─────────────────┘
```

## Directory Structure

```
renderer/src/lib/tools/
├── types.ts              # Core interfaces and types
├── registry.ts           # ToolRegistry class (singleton)
├── index.ts              # Main exports + initialization
├── providers/
│   ├── index.ts          # Provider exports
│   ├── mcp.ts            # Wraps MCP servers as a provider
│   └── builtin.ts        # Manages code-defined tools
├── builtin/
│   ├── index.ts          # Aggregates all builtin tools
│   └── [category].ts     # Tools organized by category
└── utils/
    ├── index.ts          # Utility exports
    └── persistence.ts    # Database operations for tool calls
```

## Core Concepts

### 1. Tool Definition

Every tool (MCP or programmatic) is represented by a `ToolDefinition`:

```typescript
interface ToolDefinition<TInput, TOutput> {
  // Identity
  name: string;                    // Tool name (e.g., "web_search")
  description: string;             // Human-readable description for AI

  // Input validation
  inputSchema: z.ZodType<TInput>;  // Zod schema for input validation

  // Source tracking
  source: ToolSource;              // Where this tool comes from

  // Execution
  execute: (args: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  // Optional features
  requiresApproval?: boolean | ((args: TInput) => boolean);
  validate?: (args: TInput, context: ToolExecutionContext) => Promise<ValidationResult>;
  formatOutput?: (output: TOutput) => unknown;
}
```

### 2. Tool Sources

Tools are namespaced by their source to prevent collisions:

```typescript
type ToolSource =
  | { type: "mcp"; serverId: string; serverName: string }  // MCP server tools
  | { type: "builtin"; category: string }                   // Code-defined tools
  | { type: "agent"; agentId: string };                     // Agent-specific tools

// Resulting tool keys:
// MCP:     "mcp__server-id__tool_name"
// Builtin: "builtin__category__tool_name"
// Agent:   "agent__agent-id__tool_name"
```

### 3. Tool Providers

Providers are responsible for supplying tools to the registry:

```typescript
interface ToolProvider {
  readonly name: string;

  getTools(): Promise<ToolDefinition[]>;

  // Optional lifecycle methods
  isAvailable?(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

**Built-in Providers:**

| Provider | Description |
|----------|-------------|
| `McpToolProvider` | Wraps MCP servers, auto-discovers tools |
| `BuiltinToolProvider` | Manages programmatically defined tools |

### 4. Execution Context

Tools receive context about the current execution:

```typescript
interface ToolExecutionContext {
  agentId: string;      // Current agent ID
  sessionId: string;    // Current session ID
  callId: string;       // Unique ID for this tool call

  // State management (session-scoped)
  getState: <T>(key: string) => T | undefined;
  setState: <T>(key: string, value: T) => void;

  // Agent spawning (when implemented)
  createChildAgent?: (config: ChildAgentConfig) => Promise<string>;
}
```

## Data Flow

### Tool Registration

```
App Startup
    │
    ▼
initializeToolRegistry()
    │
    ├─► Create McpToolProvider
    │       └─► Connects to enabled MCP servers
    │       └─► Discovers tools via MCP protocol
    │
    └─► Create BuiltinToolProvider
            └─► Loads tools from builtin/index.ts
```

### Tool Execution

```
AI requests tool call
    │
    ▼
ToolRegistry.toAiSdkTools()
    │
    ├─► Gathers tools from all providers
    ├─► Wraps each in AI SDK tool() format
    └─► Returns unified tool set

    │
    ▼
AI SDK calls tool.execute(args)
    │
    ▼
ToolRegistry.executeWithPersistence()
    │
    ├─► Generate unique callId
    ├─► Save tool_call item to DB (status: running)
    ├─► Check approval requirement
    ├─► Run custom validation (if defined)
    ├─► Execute tool.execute(args, context)
    ├─► Format output (if formatOutput defined)
    ├─► Save tool_result item to DB
    ├─► Update tool_call status (completed/failed)
    └─► Return result to AI
```

## Creating Tools

### Using `defineTool` Helper

```typescript
import { z } from "zod";
import { defineTool } from "@/lib/tools";

export const myTool = defineTool({
  name: "my_tool",
  description: "Does something useful for the AI",

  inputSchema: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(10).describe("Max results"),
  }),

  source: { type: "builtin", category: "search" },

  execute: async ({ query, limit }, context) => {
    // Access context if needed
    console.log(`Agent ${context.agentId} called my_tool`);

    // Your implementation
    const results = await performSearch(query, limit);

    return { results, count: results.length };
  },
});
```

### Tool Features

#### Conditional Approval

```typescript
defineTool({
  // ... other fields

  // Static: always require approval
  requiresApproval: true,

  // OR Dynamic: based on args
  requiresApproval: (args) => args.action === "delete",
});
```

#### Custom Validation

```typescript
defineTool({
  // ... other fields

  validate: async (args, context) => {
    if (args.count > 100) {
      return { valid: false, error: "Count cannot exceed 100" };
    }
    // Can also check context (e.g., permissions)
    return { valid: true };
  },
});
```

#### Output Formatting

```typescript
defineTool({
  // ... other fields

  execute: async (args) => {
    return {
      data: complexObject,
      metadata: { timestamp: new Date() },
    };
  },

  // Transform before sending to AI
  formatOutput: (output) => ({
    data: output.data,
    timestamp: output.metadata.timestamp.toISOString(),
  }),
});
```

#### Stateful Tools

```typescript
defineTool({
  name: "counter",
  // ... other fields

  execute: async ({ action }, context) => {
    // State persists within the session
    let count = context.getState<number>("count") ?? 0;

    if (action === "increment") count++;
    if (action === "decrement") count--;
    if (action === "reset") count = 0;

    context.setState("count", count);
    return { count };
  },
});
```

## Database Schema

Tool executions are persisted in the `items` table:

```typescript
// Tool call record
{
  type: "tool_call",
  callId: "uuid",           // Links call to result
  toolName: "my_tool",
  toolArgs: { query: "..." },
  toolStatus: "running" | "completed" | "failed" | "pending_approval",
}

// Tool result record
{
  type: "tool_result",
  callId: "uuid",           // Same as tool_call
  toolOutput: "{ ... }",    // JSON stringified result
  toolError: "...",         // Error message if failed
}
```

## Adding a New Tool Category

1. **Create the tool file:**
   ```
   renderer/src/lib/tools/builtin/mycategory.ts
   ```

2. **Define your tools:**
   ```typescript
   import { z } from "zod";
   import { defineTool } from "../types";

   export const tool1 = defineTool({ /* ... */ });
   export const tool2 = defineTool({ /* ... */ });

   export const myCategoryTools = [tool1, tool2];
   ```

3. **Register in builtin/index.ts:**
   ```typescript
   import { myCategoryTools } from "./mycategory";

   export const builtinTools: ToolDefinition[] = [
     ...myCategoryTools,
   ];

   export const BUILTIN_CATEGORIES = {
     // ... existing
     MY_CATEGORY: "mycategory",
   } as const;
   ```

4. **Done!** Tools are automatically available to agents.

## Adding a New Provider

1. **Implement the ToolProvider interface:**
   ```typescript
   // providers/myprovider.ts
   export class MyToolProvider implements ToolProvider {
     readonly name = "myprovider";

     async getTools(): Promise<ToolDefinition[]> {
       // Fetch/generate tools
     }
   }
   ```

2. **Register in initialization:**
   ```typescript
   // index.ts
   export async function initializeToolRegistry(): Promise<void> {
     const registry = getToolRegistry();

     // ... existing providers
     registry.registerProvider(new MyToolProvider());

     await registry.initialize();
   }
   ```

## Best Practices

### Tool Naming
- Use `snake_case` for tool names
- Be descriptive: `search_web`, `create_file`, `send_email`
- Avoid generic names: prefer `get_user_by_id` over `get`

### Descriptions
- Write for the AI: explain what the tool does and when to use it
- Include constraints: "Returns up to 10 results"
- Mention side effects: "Creates a new file on disk"

### Input Schemas
- Use `.describe()` on every field
- Provide sensible defaults with `.default()`
- Use enums for constrained values: `z.enum(["asc", "desc"])`

### Error Handling
- Throw errors for unrecoverable failures (will be caught and persisted)
- Return error objects for recoverable issues: `{ error: "Not found" }`
- Be specific in error messages

### Performance
- Tools can be async - use `await` for I/O operations
- Consider adding timeouts for external calls
- Cache expensive computations in context state

## Future Enhancements

- [ ] **Approval Flow**: UI for approving tools marked with `requiresApproval`
- [ ] **Agent Tools**: Tools that spawn child agents
- [ ] **Tool Metrics**: Track execution time, success rate
- [ ] **Tool Permissions**: Per-agent tool access control
- [ ] **Tool Streaming**: Support for streaming tool results
