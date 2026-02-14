# Config Services Module

User-scoped configuration services.

## Public API

- `getSettingsService()`
- `getSystemPromptService()`
- `getQuickActionService()`

## Use It Like This

Use these services in routes that manage user preferences/prompt assets/quick actions.

## Responsibility Boundary

Owns CRUD and validation for config entities.
No chat orchestration here.
