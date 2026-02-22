# Domain

Entity CRUD services and repositories for core data models.

## Public API

- `SessionService`, `getSessionService()` — session lifecycle
- `AgentService`, `getAgentService()` — agent CRUD and hierarchy
- `ItemService`, `getItemService()` — polymorphic items (message, tool_call, tool_result, reasoning)
- `PlanService`, `getPlanService()` — multi-step plan tracking
- `AgentConfigService`, `getAgentConfigService()` — agent configuration management
- `SettingsService`, `getSettingsService()` — per-user settings
- `SystemPromptService`, `getSystemPromptService()` — reusable system prompts
- `Repository` type — shared generic CRUD interface

## Responsibility Boundary

Owns all database reads/writes for sessions, agents, items, plans, agent configs, settings, and system prompts. Does not contain business orchestration — that belongs in `chat/` or `tools/`.

## Read Next

- [Session](./session/README.md)
- [Agent](./agent/README.md)
- [Item](./item/README.md)
- [Plan](./plan/README.md)
- [Agent Config](./agent-config/README.md)
- [Config](./config/README.md)
