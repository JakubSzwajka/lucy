# MCP Integration

Model Context Protocol connection and execution layer.

## Public API

- client/pool helpers: `createMcpClient`, `getGlobalPool`, `ensureServersConnected`, `executeToolCall`
- persistence/service APIs: `McpRepository`, `McpService`
- status/testing types: `McpTestResult`, `McpStatusResult`, `ValidationResult`

## Use It Like This

- API routes use `McpService` for CRUD/test/status.
- Tool provider (`tools/providers/mcp.ts`) uses pool/client helpers to expose MCP tools to the registry.

## Connection Timeout

`createMcpClient()` wraps both `client.connect()` and `client.listTools()` in a 10-second timeout (`Promise.race`). If a server doesn't respond in time, the connection fails and the pool marks it accordingly.

## Responsibility Boundary

Handles MCP connectivity/execution/persistence, not route orchestration.
