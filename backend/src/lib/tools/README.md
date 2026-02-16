# Tools Module

Tool runtime for agent-executed capabilities.

## Public API

- registry: `ToolRegistry`, `getToolRegistry()`, `initializeToolRegistry()`
- providers: `McpToolProvider`, `BuiltinToolProvider`
- modules: `allToolModules`, module exports
- persistence helpers: `saveToolCall`, `saveToolResult`, `updateToolCallStatus`

## Use It Like This

Chat orchestration initializes registry once, then requests AI-SDK tool map via `toAiSdkTools(context)`.

## Responsibility Boundary

This layer maps tool definitions to executable runtime.
Business logic for each tool belongs to module implementations.

## Read Next

- `modules/README.md`
- `providers/README.md`
- `delegate/README.md`
