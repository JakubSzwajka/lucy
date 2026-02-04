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

```
lucy-nextjs/
├── main/                    # Electron main process (IPC, window mgmt)
├── renderer/                # Next.js app (App Router)
│   └── src/
│       ├── app/             # Pages and API routes
│       │   └── api/         # REST API endpoints
│       ├── components/      # React UI components
│       ├── hooks/           # Custom React hooks
│       ├── lib/
│       │   ├── ai/          # AI provider abstraction
│       │   ├── db/          # Database (SQLite + Drizzle)
│       │   ├── integrations/# External service connectors
│       │   ├── services/    # Business logic layer
│       │   └── tools/       # Tool system
│       └── types/           # TypeScript types
├── scripts/                 # Build scripts
└── docs/                    # Documentation
```

## Documentation

### Architecture Docs

| Module | Description |
|--------|-------------|
| [Database](docs/database.md) | SQLite schema, multi-agent hierarchy, polymorphic items |
| [Tools](docs/tools.md) | Tool registry, providers, execution pipeline |
| [Library Architecture](renderer/src/lib/README.md) | Module dependency graph, service layer patterns |
| [Tool Architecture](renderer/src/lib/tools/ARCHITECTURE.md) | Detailed tool system design |

### Layer Documentation

| Layer | Description |
|-------|-------------|
| [main/](main/README.md) | Electron main process, IPC, preload bridge |
| [API Routes](renderer/src/app/api/README.md) | REST endpoints, streaming, request patterns |
| [Services](renderer/src/lib/services/README.md) | Business logic, repository pattern |
| [Integrations](renderer/src/lib/integrations/README.md) | External services, MCP protocol |
| [AI Providers](renderer/src/lib/ai/README.md) | Model registry, provider factories |
| [Hooks](renderer/src/hooks/README.md) | React hooks for state and async |
| [Components](renderer/src/components/README.md) | UI component organization |

### Specifications

| Spec | Description |
|------|-------------|
| [Settings](docs/SETTINGS_SPEC.md) | Settings system design |
| [MCP Integration](docs/MCP_INTEGRATION_SPEC.md) | Model Context Protocol integration |
| [Memory System](docs/memory-redesign-plan.md) | Entity/fact memory model |

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
- `builtin` - Built-in tools
- `integration` - Third-party integrations (Todoist, Knowledge)
- `agent` - Sub-agents as tools

## Development

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

## License

MIT
