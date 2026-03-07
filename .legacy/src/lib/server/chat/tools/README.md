# Tools

Tool registry, providers, and builtin tool definitions for the chat engine.

## Public API

- `ToolRegistry`, `getToolRegistry()` — manages tool providers and converts tools to AI SDK format
- `initializeToolRegistry()` — bootstrap registry with MCP and builtin providers
- `getMcpProvider()` — access the MCP provider for server refresh
- `generateDelegateTools()` — create delegation tools from agent config
- Types: `ToolDefinition`, `ToolFilter`, `ToolSource`, `ToolModule`, `ToolProvider`

## Responsibility Boundary

Owns tool discovery, registration, and AI SDK conversion. Builtin tools (continuity, plan, delegate) define their schemas and handlers here. MCP bridge wraps external MCP connections into tool definitions. Does not own the MCP connections themselves (see `mcp/`).

## Read Next

- [Builtin Tools](./builtin/README.md)
- [Chat](../README.md)
- [MCP](../../mcp/README.md)
