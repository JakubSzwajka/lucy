# PRD: Third-Party Integrations System

**Status:** Phase 1, 2 & 3 Complete (Ready to Use)
**Created:** 2025-01-27
**Last Updated:** 2025-01-27

## Overview

Add a system for first-party integrations with external services (Todoist, Notion, GitHub, etc.) that provides tools to the AI agent. Unlike MCP servers (external processes), integrations are code-defined within the app with user-configurable credentials.

## Goals

1. Allow users to connect external services via API keys
2. Provide AI-accessible tools for each enabled integration
3. Keep integration definitions in code (developer adds new integrations)
4. Store user credentials and config in database

## Non-Goals

- User-defined integrations (always requires code)
- OAuth flows (v1 uses API keys only)
- Credential encryption at rest (future enhancement)

---

## Architecture

### Directory Structure

```
renderer/src/lib/tools/
├── ...existing...
├── integrations/
│   ├── index.ts                 # Registry of all integrations
│   ├── types.ts                 # IntegrationDefinition interface
│   ├── provider.ts              # IntegrationToolProvider
│   └── todoist/
│       ├── index.ts             # Integration definition
│       ├── tools.ts             # Tool definitions
│       ├── client.ts            # API client
│       └── types.ts             # Todoist types
```

### Database Schema

New `integrations` table:

```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,           -- e.g., "todoist"
  name TEXT NOT NULL,            -- Display name
  enabled INTEGER DEFAULT 0,     -- Boolean
  credentials TEXT,              -- JSON: { "apiKey": "..." }
  config TEXT,                   -- JSON: { "defaultProject": "..." }
  created_at INTEGER,
  updated_at INTEGER
);
```

### API Routes

```
/api/integrations
  GET    - List all available integrations (code + db state merged)

/api/integrations/[id]
  GET    - Get integration details
  PATCH  - Update credentials, config, enabled state
  DELETE - Remove credentials (reset to unconfigured)

/api/integrations/[id]/test
  POST   - Test connection with current credentials
```

### Tool Source Type

Extend `ToolSource` union:

```typescript
type ToolSource =
  | { type: "mcp"; serverId: string; serverName: string }
  | { type: "builtin"; category: string }
  | { type: "integration"; integrationId: string }  // NEW
  | { type: "agent"; agentId: string };
```

---

## Implementation Plan

### Phase 1: Core Infrastructure
- [x] Design architecture
- [x] Add `integrations` table to schema
- [x] Create `IntegrationDefinition` types
- [x] Create `IntegrationToolProvider`
- [x] Register provider in tool registry initialization
- [x] Create API routes for integrations

### Phase 2: Todoist Integration
- [x] Create Todoist client (`client.ts`)
- [x] Create Todoist types (`types.ts`)
- [x] Create integration definition (`index.ts`)
- [x] Implement tools:
  - [x] `todoist_list_tasks` - Retrieve tasks
  - [x] `todoist_list_projects` - Retrieve projects
- [x] Register in integrations index

### Phase 3: Settings UI
- [x] Create `IntegrationsSettings.tsx` component
- [x] Add to settings page (new "Integrations" tab)
- [x] Form for API key entry
- [x] Test connection button
- [x] Enable/disable toggle

### Phase 4: Future Enhancements (Not in v1)
- [ ] Credential encryption at rest
- [ ] OAuth support
- [ ] More Todoist tools (create, complete, update tasks)
- [ ] Additional integrations (Notion, GitHub, Linear, etc.)

---

## Todoist Integration Spec

### Credentials Schema

```typescript
z.object({
  apiKey: z.string().describe("Todoist API token"),
})
```

### Config Schema

```typescript
z.object({
  defaultProject: z.string().optional(),
})
```

### Tools (v1)

| Tool | Description | Input |
|------|-------------|-------|
| `todoist_list_tasks` | Get tasks from Todoist | `{ projectId?: string, filter?: string }` |
| `todoist_list_projects` | Get all projects | `{}` |

### Todoist API Reference

- Base URL: `https://api.todoist.com/rest/v2`
- Auth: `Authorization: Bearer {apiKey}`
- [API Docs](https://developer.todoist.com/rest/v2/)

---

## Data Flow

```
App Startup
    │
    ▼
initializeToolRegistry()
    │
    ├─► McpToolProvider (existing)
    ├─► BuiltinToolProvider (existing)
    └─► IntegrationToolProvider (NEW)
            │
            ├─► Read enabled integrations from DB
            ├─► For each: validate credentials, create tools
            └─► Return tools to registry

User enables integration in Settings
    │
    ▼
PATCH /api/integrations/todoist
    { enabled: true, credentials: { apiKey: "..." } }
    │
    ▼
On next chat request:
    │
    ▼
IntegrationToolProvider.refresh()
    │
    ▼
Todoist tools available to AI
```

---

## Security Considerations

1. **Credentials stored in SQLite** - Not encrypted (same as MCP server env vars)
2. **API keys visible in settings UI** - Use password input type
3. **No server-side validation** - Client trusts API key format
4. **Future:** Consider encrypting credentials column

---

## UI Mockup

```
Settings > Integrations

┌─────────────────────────────────────────────────────────┐
│ Integrations                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔲 Todoist                              [Configure] │ │
│ │    Task management                                  │ │
│ │    Status: Not configured                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔲 Notion                               [Configure] │ │
│ │    Notes and documentation                          │ │
│ │    Status: Not configured                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘

Configure Todoist Dialog:
┌─────────────────────────────────────────────────────────┐
│ Configure Todoist                              [x]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ API Token                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ••••••••••••••••••••                                │ │
│ └─────────────────────────────────────────────────────┘ │
│ Get your token from Todoist Settings > Integrations     │
│                                                         │
│ Default Project (optional)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Select project...                              ▼    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│        [Test Connection]    [Cancel]    [Save]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-27 | Initial PRD created |
| 2025-01-27 | Phase 1 & 2 complete - Backend infrastructure and Todoist integration implemented |
| 2025-01-27 | Phase 3 complete - Settings UI with Integrations tab added |
