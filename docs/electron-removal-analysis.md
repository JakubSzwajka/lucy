# Electron Removal & Single-App Merge

> **Goal:** Drop Electron entirely. Merge the desktop renderer into the backend to produce one Next.js app — pages + API routes on one server, one deploy, no CORS.

## Why This Is Easy

The renderer (`desktop/renderer/src/`) is already a pure Next.js web app. Only **3 files** touch Electron at all, and all three already gracefully degrade when Electron is absent.

## What Gets Deleted

```
desktop/                         # Entire directory goes away
├── main/                        # Electron main process, preload, TTS
├── scripts/                     # Electron dev/build orchestrators
├── electron-builder.yml         # DMG/installer config
├── resources/                   # App icons for electron-builder
├── package.json                 # Replaced by backend's package.json
├── renderer/next.config.js      # Merged into backend's next.config.js
└── renderer/tsconfig.json       # Already matches backend's tsconfig
```

## Migration Steps

### 1. Move renderer source into backend

```
desktop/renderer/src/app/(main)/    →  backend/src/app/(main)/
desktop/renderer/src/app/login/     →  backend/src/app/login/
desktop/renderer/src/app/register/  →  backend/src/app/register/
desktop/renderer/src/app/layout.tsx →  backend/src/app/layout.tsx  (replaces existing)
desktop/renderer/src/app/globals.css → backend/src/app/globals.css (replaces existing)
desktop/renderer/src/components/    →  backend/src/components/
desktop/renderer/src/hooks/         →  backend/src/hooks/
desktop/renderer/src/lib/client/api/       →  backend/src/lib/client/api/        (client.ts etc.)
desktop/renderer/src/lib/client/utils.ts   →  backend/src/lib/client/utils.ts
desktop/renderer/src/types/         →  backend/src/types/
desktop/renderer/public/            →  backend/public/
```

No import path changes needed — both use `@/* → ./src/*`.

### 2. Fix the API client

`desktop/renderer/src/lib/client/api/client.ts` currently does:
```ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
```

Change to same-origin relative calls:
```ts
const BASE_URL = "";
```

All `fetch("/api/sessions/...")` calls now hit the same server. No CORS, no separate port. Auth (JWT Bearer tokens) still works identically.

### 3. Edit 3 Electron-coupled files

| File | Change |
|------|--------|
| `app/layout.tsx` | Remove the drag-region div (`<div className="drag-region ..."/>`) |
| `app/globals.css` | Remove `.drag-region` / `-webkit-app-region: drag` CSS (~6 lines) |
| `components/chat/ChatContainer.tsx` | Replace `electron.invoke("show-notification")` with Web Notifications API (`new Notification(title, { body })`) |

### 4. Handle TTS

`hooks/useTts.ts` is fully Electron-dependent (IPC to main process `say` command + ElevenLabs). Options:
- **Drop it** for now (simplest — remove the hook and its call sites)
- **Web Speech API** — rewrite to use `window.speechSynthesis` (~30 lines)
- **Backend endpoint** — add a `/api/tts` route that calls ElevenLabs, stream audio back

### 5. Add frontend deps to backend's package.json

~30 packages need to be added (all are standard web deps):

**UI primitives** (Radix): `@radix-ui/react-accordion`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, + others

**Core frontend**: `@ai-sdk/react`, `@tanstack/react-query`, `lucide-react`, `cmdk`, `motion`, `clsx`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css`

**Rendering**: `@streamdown/*`, `shiki`, `react-markdown`, `remark-gfm`, `ansi-to-react`

**Misc**: `@xyflow/react`, `@rive-app/react-webgl2`, `embla-carousel-react`, `media-chrome`, `tokenlens`, `use-stick-to-bottom`, `cron-parser`, `cronstrue`, `openapi-types`

### 6. Reconcile Tailwind config

- **Delete** `backend/tailwind.config.ts` (legacy config file)
- The desktop's `globals.css` already uses Tailwind v4 CSS-first config (`@theme inline`) with all custom tokens, shadcn variables, fonts, and utility classes
- Both already share the same PostCSS config (`@tailwindcss/postcss`)

### 7. Clean up backend's next.config.js

The renderer had `better-sqlite3` in webpack externals (leftover, unused). The backend config is already clean. No changes needed to `backend/next.config.js`.

### 8. Replace backend landing page

The current `backend/src/app/page.tsx` is a simple "Lucy API" page with health/OpenAPI links. It gets replaced by the desktop's `(main)/page.tsx` (chat UI). If you want to keep the API info page, move it to `/api-info` or similar.

### 9. Delete the desktop directory

Once everything is moved and verified, `rm -rf desktop/`. Update root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "cd backend && npm run dev",
    "build": "cd backend && npm run build",
    "lint": "cd backend && npm run lint"
  }
}
```

Or flatten further: move `backend/` contents to root.

## Resulting Structure

```
lucy-nextjs/
├── backend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/              # All API routes (unchanged)
│   │   │   ├── (main)/           # Chat UI, dashboard, settings (from renderer)
│   │   │   ├── login/            # Login page (from renderer)
│   │   │   ├── register/         # Register page (from renderer)
│   │   │   ├── layout.tsx        # Root layout (from renderer, minus Electron)
│   │   │   └── globals.css       # Full theme (from renderer)
│   │   ├── components/           # All React components (from renderer)
│   │   ├── hooks/                # All hooks (from renderer)
│   │   ├── lib/
│   │   │   ├── api/client.ts     # API client (BASE_URL = "")
│   │   │   ├── services/         # Backend services (unchanged)
│   │   │   ├── db/               # Database (unchanged)
│   │   │   └── auth/             # Auth middleware (unchanged)
│   │   └── types/                # Merged types
│   ├── public/                   # Static assets (from renderer)
│   ├── package.json              # Merged deps (no Electron)
│   ├── next.config.js
│   └── drizzle.config.ts
├── docs/
├── package.json                  # Root convenience scripts
└── CLAUDE.md
```

## What Needs Zero Changes

- All backend API routes, services, repositories, database, auth middleware
- All React components (except ChatContainer notification — 5 lines)
- All hooks (except useTts — remove or rewrite)
- All pages (except layout.tsx — remove drag div)
- Auth flow (JWT + localStorage works the same in browser)
- The `@/*` import alias (identical in both tsconfigs)

## Risks & Gotchas

| Risk | Mitigation |
|------|------------|
| **Dep version conflicts** | Both already share `next`, `react`, `ai`, `tailwindcss` etc. — verify versions match before merging package.json |
| **File path collisions** | Backend has no `components/`, `hooks/`, or `types/` dirs — clean merge |
| **`globals.css` theme vars** | Desktop's globals.css defines all CSS variables the components need. Replacing backend's minimal file is safe. |
| **SSR vs CSR** | Most renderer components are `'use client'`. They'll work the same in the merged app. Server Components that call backend services directly become possible as a future optimization. |
| **Auth cookie vs Bearer** | Current auth uses Bearer token in `Authorization` header via the API client. This continues to work for same-origin requests. Could migrate to httpOnly cookies later for better security. |

## Future Optimization (Not Required for Migration)

Once merged, Server Components can call services directly instead of going through HTTP:

```tsx
// Before: client component fetches via HTTP
const { data } = useQuery({ queryFn: () => apiClient.getSessions() });

// After (optional): server component calls service directly
const sessions = await SessionService.getInstance().list(userId);
```

This eliminates the HTTP round-trip for server-rendered pages. Not required for the migration — the API client approach works fine and can be migrated incrementally.
