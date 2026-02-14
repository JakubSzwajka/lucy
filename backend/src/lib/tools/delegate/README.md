# Delegate Tools

Dynamically generated tools that enable multi-agent delegation.

## Purpose

Generates `delegate_to_<name>` tools from `agentConfigTools` entries where `toolType="delegate"`, plus a `continue_agent` tool for follow-up conversations.

## Public API

### `generateDelegateTools(agentConfig, sessionId, userId, parentAgentId): ToolDefinition[]`

Generates delegate tools for an agent based on its config's delegate entries.

## Usage

Called by `ChatService.prepareChat()` after loading registry tools. Delegate tools are merged into the tools map alongside MCP/builtin tools.

## Related

- [Agent Execution Service](../../services/agent/README.md) - Executes sub-agent loops
- [Tool Types](../types.ts) - `DelegateToolSource` type
