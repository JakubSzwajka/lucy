# Nextron Migration Specification

## Status: COMPLETED

Migration completed on 2026-01-26.

## Overview

Migrate the Lucy Next.js web application to a desktop application using Nextron (Electron + Next.js).

## Implementation Notes

### Architecture Decision: Custom Build Script

Standard Nextron requires `output: "export"` (static export) which doesn't support API routes. Since Lucy uses API routes for:
- Chat streaming (`/api/chat`)
- Conversation CRUD (`/api/conversations/*`)
- Provider listing (`/api/providers`)

We implemented a **custom build script** (`scripts/build.js`) that:
1. Builds Next.js in `standalone` mode (preserving API routes)
2. Compiles the Electron main process
3. Copies native modules and dependencies
4. Packages with electron-builder

### Native Module Handling

`better-sqlite3` is a native Node.js module requiring special handling:
- **Development**: Rebuilt for system Node.js (`npm rebuild better-sqlite3`)
- **Production**: Rebuilt for Electron by electron-builder

### Database Path Strategy

The database location is determined by environment variable:
- **Development**: `process.cwd()/lucy.db` (project directory)
- **Production**: `LUCY_USER_DATA_PATH/lucy.db` (set by main process to `app.getPath('userData')`)

---

## Migration Backlog (All Completed)

### Phase 1: Project Structure Setup ✅

- [x] **1.1** Install Nextron and Electron dependencies
- [x] **1.2** Create `main/` directory for Electron main process
- [x] **1.3** Restructure renderer (Next.js) code
- [x] **1.4** Create root configuration files

### Phase 2: Electron Main Process ✅

- [x] **2.1** Implement `main/background.ts`
- [x] **2.2** Implement `main/preload.ts`
- [x] **2.3** Implement `main/helpers/create-window.ts`

### Phase 3: Database Layer Adaptation ✅

- [x] **3.1** Database architecture: Keep in renderer with webpack externals + env var for path
- [x] **3.2** Update database path handling via `LUCY_USER_DATA_PATH` env var

### Phase 4: Next.js Configuration ✅

- [x] **4.1** Update `next.config.js` for Electron (webpack externals for native modules)
- [x] **4.2** Configure standalone output mode

### Phase 5: Build & Packaging ✅

- [x] **5.1** Configure `electron-builder.yml`
- [x] **5.2** Create custom build script for standalone mode
- [x] **5.3** Test development mode - PASSED
- [x] **5.4** Test production build - PASSED (DMGs created)

---

## Final Project Structure

```
lucy-nextjs/
├── main/                           # Electron main process
│   ├── background.ts               # App entry, lifecycle, IPC
│   ├── preload.ts                  # Context bridge for renderer
│   └── helpers/
│       ├── create-window.ts        # Window creation helper
│       └── index.ts
├── renderer/                       # Next.js app
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── public/
│   ├── next.config.js
│   ├── postcss.config.mjs
│   └── tsconfig.json
├── scripts/
│   └── build.js                    # Custom production build script
├── resources/                      # App icons (TODO: add actual icons)
├── electron-builder.yml
├── drizzle.config.ts
├── package.json
└── tsconfig.json                   # Main process tsconfig
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (Nextron: Next.js + Electron) |
| `npm run build` | Build production app (custom script → DMG/installer) |
| `npm run postinstall` | Rebuild native modules for Electron |
| `npm rebuild better-sqlite3` | Rebuild native module for system Node.js (before dev) |

---

## Build Outputs

Production build creates in `dist/`:
- `Lucy-0.1.0-arm64.dmg` - macOS Apple Silicon
- `Lucy-0.1.0.dmg` - macOS Intel
- `mac-arm64/Lucy.app` - Unpacked app (ARM64)
- `mac/Lucy.app` - Unpacked app (x64)

---

## Known Issues & Future Improvements

1. **Window state persistence** - Removed due to electron-store API changes. Can be re-added.
2. **App icons** - Using default Electron icon. Add custom icons in `resources/`.
3. **Code signing** - Not configured. Required for distribution.
4. **Auto-updates** - Not implemented. Consider electron-updater.

---

## Success Criteria ✅

- [x] `npm run dev` launches Electron app with hot reload
- [x] `npm run build` produces working platform installer (DMG)
- [x] API routes work (chat, conversations, providers)
- [x] SQLite database connects correctly
- [x] App can be distributed (unsigned for now)
