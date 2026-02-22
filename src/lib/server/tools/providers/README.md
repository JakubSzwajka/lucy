# Tool Providers

Providers supply tool definitions into the registry.

## Providers

- `BuiltinToolProvider` - loads tool modules via integrations/internal modules
- `McpToolProvider` - exposes tools from connected MCP servers

## Use It Like This

Register providers into `ToolRegistry`, initialize, then read tools through registry APIs.

## Responsibility Boundary

Provider layer discovers and materializes tools.
It does not own per-tool business logic.
