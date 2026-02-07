# App Layer

Next.js App Router — pages and API routes for the Lucy desktop app.

## Structure

```
app/
├── (main)/                    # Main route group (shared layout with sidebar)
│   ├── page.tsx               # Chat view (default route)
│   ├── dashboard/page.tsx     # Dashboard view
│   └── settings/              # Settings pages
│       ├── page.tsx           # Settings redirect
│       ├── general/page.tsx   # General settings
│       ├── models/page.tsx    # Model configuration
│       ├── mcp/page.tsx       # MCP server management
│       └── prompts/page.tsx   # System prompt management
├── api/                       # REST API endpoints
│   └── README.md              # API documentation
└── layout.tsx                 # Root layout
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

## Interactions

- **Pages** use [hooks](../hooks/README.md) for data fetching and state management
- **Pages** compose [components](../components/README.md) for UI rendering
- **API routes** call [services](../lib/services/README.md) for business logic
- **API routes** stream AI responses via the [AI layer](../lib/ai/README.md)

See [api/README.md](api/README.md) for API endpoint documentation.
