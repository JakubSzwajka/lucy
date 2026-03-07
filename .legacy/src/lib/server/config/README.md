# Config

Agent configurations, system prompts, and app settings.

## Public API

- `AgentConfigService`, `getAgentConfigService()` — agent config CRUD with circular delegation checks
- `SystemPromptService`, `getSystemPromptService()` — system prompt CRUD
- `SettingsService`, `getSettingsService()` — per-user settings (enabled models, context window)

## Responsibility Boundary

Owns how agents are configured (model, tools, prompts, settings). Does not execute agents or manage sessions.

## Read Next

- [Chat](../chat/README.md)
- [Sessions](../sessions/README.md)
