# Services Module

Primary orchestration layer used by API routes.

## Public API

Import service singletons from `index.ts`:
- `getSessionService`, `getChatService`, `getAgentService`, `getItemService`
- `getPlanService`
- config services: settings/system prompts
- MCP service re-exports

## Use It Like This

```ts
import { getSessionService } from "@/lib/services";

const sessions = await getSessionService().getAll(userId);
```

## Boundary Rule

Service modules orchestrate use-cases and enforce business constraints.
They should call capability modules and repositories, but callers should not need repository details.

## Read Next

- `chat/README.md`
- `session/README.md`
- `plan/README.md`
- `config/README.md`
- `agent-config/README.md`
