# MCP

Model Context Protocol client management — connecting to, pooling, and querying MCP servers.

## Public API

- `McpService`, `getMcpService()` — CRUD + test/status operations for MCP server configs
- `McpRepository`, `getMcpRepository()` — MCP server persistence
- `McpClientPool`, `getGlobalPool()` — connection pool for active MCP servers
- `createMcpClient()`, `closeMcpClient()`, `executeToolCall()` — low-level client operations

## Responsibility Boundary

Owns MCP server connections and tool discovery. Tool registration into the agent runtime is handled by `tools/providers/mcp.ts`.

## Read Next

- [Tools](../tools/README.md)
