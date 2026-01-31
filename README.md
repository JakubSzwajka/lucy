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
├── main/                    # Electron main process
├── renderer/                # Next.js app (App Router)
│   └── src/
│       ├── app/             # Pages and API routes
│       ├── components/      # React components
│       ├── hooks/           # Custom hooks
│       ├── lib/
│       │   ├── db/          # Database (SQLite + Drizzle)
│       │   ├── ai/          # AI provider integrations
│       │   └── tools/       # Tool system
│       └── types/           # TypeScript types
├── scripts/                 # Build scripts
└── docs/                    # Documentation
```

## Documentation

| Module | Description |
|--------|-------------|
| [Database](docs/database.md) | SQLite schema, multi-agent hierarchy, polymorphic items |
| [Tools](docs/tools.md) | Tool registry, providers, execution pipeline |
| [Knowledge](renderer/src/lib/tools/integrations/knowledge/README.md) | File-based knowledge graph with entities and relations |

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
