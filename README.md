# Lucy

A desktop AI assistant built with Electron + Next.js (Nextron). Runs locally with SQLite and connects to AI providers (Anthropic, Google, OpenAI).

## Quick Start

```bash
npm install
npm run db:push          # Initialize database
npm rebuild better-sqlite3  # Rebuild native module
npm run dev              # Start development
```

## Architecture

Lucy is a 3-layer desktop app: an Electron shell, a Next.js renderer (pages + API routes), and a core library (AI, database, tools, services).

```
Electron (main/)
  └── Next.js App (renderer/src/app/)
        ├── Pages ─── use hooks ─── compose components
        └── API Routes ─── call services ─── use AI + tools ─── persist to DB
```

### System Call Map

How API routes, services, and external systems connect:

```mermaid
flowchart LR
    subgraph Routes["API Routes"]
        ChatRoute["/sessions/[id]/chat"]
        SessionRoutes["/sessions\n/sessions/[id]/plans"]
        SettingsRoute["/settings"]
        PromptsRoute["/system-prompts"]
        McpRoute["/mcp-servers"]
        ToolsRoute["/tools"]
    end

    subgraph Services["Service Layer"]
        ChatSvc[ChatService\nTurn orchestrator]
        SessionSvc[SessionService]
        AgentSvc[AgentService]
        ItemSvc[ItemService]
        PlanSvc[PlanService]
        SettingsSvc[SettingsService]
        PromptSvc[SystemPromptService]
        StepPersist[StepPersistence]
    end

    subgraph AI["AI Layer"]
        StreamText[streamText\nVercel AI SDK]
        ToolReg[ToolRegistry]
    end

    subgraph External["External"]
        Providers[Anthropic\nOpenAI\nGoogle]
        MCP[MCP Servers]
        Obsidian[Obsidian]
        Todoist[Todoist]
    end

    DB[(SQLite)]

    ChatRoute --> ChatSvc
    SessionRoutes --> SessionSvc & PlanSvc
    SettingsRoute --> SettingsSvc
    PromptsRoute --> PromptSvc
    McpRoute --> DB
    ToolsRoute --> ToolReg

    ChatSvc --> SessionSvc & AgentSvc & ItemSvc & StepPersist
    ChatSvc --> StreamText & ToolReg
    SessionSvc --> AgentSvc
    StepPersist --> ItemSvc
    PromptSvc --> SettingsSvc

    StreamText --> Providers
    ToolReg --> MCP & Obsidian & Todoist

    SessionSvc & AgentSvc & ItemSvc & PlanSvc & SettingsSvc --> DB
```

### Agent Tool Map

What an agent can reach through tool calls during a conversation:

```mermaid
flowchart LR
    Agent((Agent))

    subgraph Builtin["Built-in Tools"]
        Memory["memory\nsave / find / update"]
        Plan["create_plan\nupdate_plan\nget_plan"]
        Tasks["tasks_list\ntasks_get_projects"]
        Notes["notes_list / read\nnotes_write / delete"]
    end

    subgraph Dynamic["MCP Tools"]
        McpTools["Any tool from\nenabled MCP servers"]
    end

    subgraph Systems["External Systems"]
        Obsidian[(Obsidian Vault)]
        ConvSearch[(Past Conversations)]
        TodoistAPI[Todoist API]
        McpServers[MCP Servers]
        PlanDB[(Plans in SQLite)]
    end

    Agent --> Memory & Plan & Tasks & Notes & McpTools

    Memory -->|entity/fact store| Obsidian
    Memory -->|parallel search| ConvSearch
    Notes --> Obsidian
    Tasks --> TodoistAPI
    Plan --> PlanDB
    McpTools --> McpServers
```

## Module Map

| Module | Path | Description |
|--------|------|-------------|
| [Electron Main](main/README.md) | `main/` | Main process, IPC, window management, preload bridge |
| [App Layer](renderer/src/app/README.md) | `renderer/src/app/` | Next.js pages and API routes |
| [Components](renderer/src/components/README.md) | `renderer/src/components/` | React UI components (chat, sidebar, settings) |
| [Hooks](renderer/src/hooks/README.md) | `renderer/src/hooks/` | React hooks for state, streaming, and async data |
| [Library](renderer/src/lib/README.md) | `renderer/src/lib/` | Core library: AI, database, services, tools, integrations |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode |
| `npm run build` | Build production app (DMG/installer) |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Drizzle Studio |

## Key Concepts

### Multi-Agent System
Sessions contain a hierarchy of agents. Each agent has its own conversation thread (items) and can spawn child agents via tool calls.

### Polymorphic Items
Conversation entries are stored in a single `items` table with a `type` discriminator:
- `message` - User/assistant/system messages
- `tool_call` - Tool invocations with args
- `tool_result` - Tool outputs linked via `callId`
- `reasoning` - Model reasoning traces

### Tool Sources
Tools come from multiple sources, unified through the registry:
- `mcp` - Model Context Protocol servers
- `builtin` - Built-in tools (memory, plans, tasks, notes)
- `integration` - Third-party integrations (Todoist, Obsidian)
- `agent` - Sub-agents as tools

## Development

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

## License

MIT
