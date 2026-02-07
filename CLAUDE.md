# Lucy Desktop App - Development Guidelines

## Architecture Overview

This is a **desktop application** built with Electron + Next.js. The app runs locally with a SQLite database and connects to AI providers (Anthropic, Google, OpenAI).

```
lucy-nextjs/
├── main/                    # Electron main process
│   ├── background.ts        # App entry, window management, IPC
│   ├── preload.ts           # Context bridge for renderer
│   └── helpers/             # Electron utilities
├── renderer/                # Next.js app (App Router)
│   ├── src/
│   │   ├── app/             # Pages and API routes
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utilities, database, AI providers
│   │   └── types/           # TypeScript types
│   ├── public/
│   └── next.config.js
├── scripts/
│   └── build.js             # Custom production build script
└── resources/               # App icons
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (Electron + Next.js hot reload) |
| `npm run build` | Build production app (creates DMG/installer) |
| `npm rebuild better-sqlite3` | Rebuild native module for Node.js (run before dev if issues) |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Drizzle Studio for database inspection |

## Development Workflow

### Before First Run
```bash
npm install
npm run db:push          # Initialize database schema
npm rebuild better-sqlite3  # Rebuild native module for system Node
npm run dev
```

### Native Module Note
`better-sqlite3` is a native module that must be compiled for the correct runtime:
- **Development**: Uses system Node.js → run `npm rebuild better-sqlite3`
- **Production build**: Automatically rebuilt for Electron by electron-builder

## Project Structure Conventions

### Main Process (`main/`)
- Handles Electron lifecycle, window management, and system integration
- IPC handlers for communication with renderer
- Keep minimal; most logic should be in renderer

### Renderer (`renderer/src/`)
- Use `@/` path alias for imports (resolves to `renderer/src/`)
- Organize by feature/domain, not by file type
- Keep components close to where they're used

### Components
- Default to Server Components; use `'use client'` only when necessary
- Extract client interactivity into small leaf components
- Co-locate component, styles, and tests in the same directory
- Use named exports for components

### API Routes
API routes run via Next.js standalone server in production:
- `/api/sessions` - Session CRUD (user-facing conversation container)
- `/api/sessions/[id]/chat` - AI chat streaming (session-centric, resolves root agent internally)
- `/api/providers` - Available AI providers
- `/api/settings` - App settings
- `/api/system-prompts` - System prompt management
- `/api/mcp-servers` - MCP server management
- `/api/plans` - Plan management
- `/api/tools` - Tool listing

### Database
- SQLite via `better-sqlite3` + Drizzle ORM
- Schema defined in `renderer/src/lib/db/schema.ts`
- In dev: Database at project root (`lucy.db`)
- In prod: Database in user data directory (via `LUCY_USER_DATA_PATH`)

**Multi-Agent Schema:**
- `sessions` - User-facing conversation container (has rootAgentId)
- `agents` - Runtime instances with parent-child hierarchy (parentId, sourceCallId)
- `items` - Polymorphic entries per agent (message | tool_call | tool_result | reasoning)
- `system_prompts` - Reusable system prompts
- `settings` - App-wide settings

## TypeScript

- Enable strict mode in `tsconfig.json`
- Define explicit types for API responses, props, and state
- Use `satisfies` operator for type-safe object literals
- Prefer interfaces for public APIs, types for unions/intersections
- Never use `any`; use `unknown` and narrow with type guards

Two tsconfig files:
- Root `tsconfig.json` - Main process (CommonJS, targets Electron Node)
- `renderer/tsconfig.json` - Next.js app (ESM, React JSX)

## Error Handling

- Implement `error.tsx` at appropriate route segments
- Use `notFound()` for 404 scenarios
- Log errors with contextual information
- Show user-friendly error messages; never expose stack traces

## Security

- API keys stored in `.env` (never commit to git)
- `contextIsolation: true` in Electron (enforced)
- `nodeIntegration: false` in Electron (enforced)
- Use preload script for any Node.js APIs needed in renderer

## State Management

- Prefer URL state (`useSearchParams`, `usePathname`) for shareable state
- Use React Context sparingly; prefer Server Components data flow
- Keep client state minimal and close to where it's used

## Code Quality

- Run `npm run lint` and fix all warnings before committing
- Keep components under 200 lines; extract logic into hooks or utilities
- Write self-documenting code; add comments only for non-obvious logic

## Build & Distribution

Production build uses custom script (`scripts/build.js`) that:
1. Builds Next.js in standalone mode (preserves API routes)
2. Compiles main process TypeScript
3. Copies native modules
4. Packages with electron-builder

Outputs in `dist/`:
- `Lucy-{version}-arm64.dmg` - macOS Apple Silicon
- `Lucy-{version}.dmg` - macOS Intel
