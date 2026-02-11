# App Layer

Next.js App Router — pages and API routes for the Lucy desktop app.

## Structure

```
app/
├── (main)/                    # Main route group (auth-guarded, shared layout with sidebar)
│   ├── page.tsx               # Chat view (default route)
│   ├── dashboard/page.tsx     # Dashboard view
│   └── settings/              # Settings pages
│       ├── ...
├── login/page.tsx             # Login page (public)
├── register/page.tsx          # Register page (public)
├── api/                       # Legacy local API endpoints (see note)
│   └── README.md
└── layout.tsx                 # Root layout (wraps with AuthProvider)
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Chat | Main chat interface — sends messages via `useSessionChat` hook |
| `/dashboard` | Dashboard | Overview / landing page |
| `/settings` | Settings | Redirects to general settings |
| `/settings/general` | General | Default model, system prompt selection |
| `/settings/models` | Models | Enable/disable available AI models |
| `/settings/mcp` | MCP Servers | Configure Model Context Protocol servers |
| `/settings/prompts` | Prompts | Create and manage system prompts |
| `/login` | Login | Email/password login form, redirects to `/` on success |
| `/register` | Register | Account creation form, redirects to `/` on success |

## Authentication

The app uses JWT authentication via the cloud backend. The root layout wraps all pages with `AuthProvider` (via `Providers` component). The `(main)` route group is wrapped with `AuthGuard`, which redirects unauthenticated users to `/login`.

- **Public routes**: `/login`, `/register`
- **Protected routes**: Everything under `(main)/`

## Interactions

- **Hooks** call the cloud backend via authenticated API client (`@/lib/api/client`)
- **Pages** use [hooks](../hooks/README.md) for data fetching and state management
- **Pages** compose [components](../components/README.md) for UI rendering
- **API routes** (legacy) call [services](../lib/services/README.md) for business logic
- **API routes** (legacy) stream AI responses via the [AI layer](../lib/ai/README.md)

See [api/README.md](api/README.md) for API endpoint documentation.
