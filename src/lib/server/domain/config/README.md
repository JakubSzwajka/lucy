# Config

Per-user application settings and reusable system prompts.

## Public API

- `SettingsService`, `getSettingsService()` — user settings CRUD
- `SystemPromptService`, `getSystemPromptService()` — system prompt management

## Responsibility Boundary

Owns settings and system prompt persistence. Does not interpret settings — consumers read and act on values themselves.
