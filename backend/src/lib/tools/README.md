# Tools Module

Tool runtime for agent-executed capabilities.

## Public API

- registry: `ToolRegistry`, `getToolRegistry()`, `initializeToolRegistry()`
- providers: `McpToolProvider`, `BuiltinToolProvider`
- modules: `allToolModules`, module exports
- persistence helpers: `saveToolCall`, `saveToolResult`, `updateToolCallStatus`

## Use It Like This

Chat orchestration initializes registry once, then requests AI-SDK tool map via `toAiSdkTools(context)`.

## Non-blocking MCP Loading

MCP tool loading is **non-blocking** — the registry initializes eagerly at module import time (`eagerInitializeToolRegistry()`), and `McpToolProvider.initialize()` fires server connections in the background without awaiting them. This means:

- Builtin tools are always available instantly.
- MCP tools appear as servers finish connecting (typically 1-3s after startup).
- The first chat message is never blocked waiting for MCP servers.
- `getTools()` returns whatever MCP tools are connected at call time.
- `refreshServersInBackground()` can be called to trigger a non-blocking refresh.

## Responsibility Boundary

This layer maps tool definitions to executable runtime.
Business logic for each tool belongs to module implementations.

## Read Next

- `modules/README.md`
- `providers/README.md`
- `delegate/README.md`
