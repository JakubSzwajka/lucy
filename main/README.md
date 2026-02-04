# Main Process (Electron)

This directory contains the Electron main process code. The main process runs in a Node.js environment with full system access, manages the application lifecycle, creates browser windows, and communicates with the renderer process via IPC.

## Purpose

The main process is responsible for:

- **Application lifecycle management** - Handling app startup, shutdown, and macOS-specific behaviors (dock icon, window activation)
- **Window management** - Creating and controlling the main BrowserWindow
- **Production server management** - Spawning and managing the Next.js standalone server in production builds
- **IPC communication** - Providing a secure bridge between the renderer (web) and system APIs
- **Environment configuration** - Setting up paths, ports, and environment variables for dev/prod modes

## Files

### `background.ts`

The main entry point for the Electron application.

**Responsibilities:**
- Initializes the app and determines dev/prod mode
- Starts the Next.js standalone server in production (`startProductionServer`)
- Creates the main window with appropriate configuration (`createMainWindow`)
- Registers IPC handlers for renderer communication
- Manages app lifecycle events (`ready`, `window-all-closed`, `activate`, `before-quit`)
- Sets platform-specific configurations (macOS dock icon, traffic light positioning)

**Key Variables:**
- `isProd` - Boolean flag based on `NODE_ENV`
- `DEV_SERVER_PORT` - Port 8888 (or from CLI args) for development
- `PROD_SERVER_PORT` - Port 3000 for production
- `mainWindow` - Reference to the main BrowserWindow instance
- `serverProcess` - Reference to the spawned Next.js server (production only)

### `preload.ts`

The preload script that runs in a sandboxed context before the renderer loads. It creates a secure bridge between the renderer and main process using Electron's `contextBridge`.

**Responsibilities:**
- Exposes a limited, safe API to the renderer via `window.electron`
- Wraps IPC calls to prevent direct access to `ipcRenderer`

### `helpers/create-window.ts`

A factory function for creating BrowserWindow instances with sensible defaults.

**Responsibilities:**
- Centers windows on the primary display
- Enforces security defaults (`contextIsolation: true`, `nodeIntegration: false`)
- Merges provided options with secure defaults

### `helpers/index.ts`

Barrel export file for the helpers module.

## Key Patterns

### IPC Communication

The main process uses two IPC patterns:

**Invoke/Handle (async, returns a value):**
```typescript
// Main process
ipcMain.handle("get-app-path", () => app.getAppPath());

// Renderer (via preload)
const path = await window.electron.getAppPath();
```

**Send/On (fire-and-forget):**
```typescript
// Main process
ipcMain.on("minimize-window", () => mainWindow?.minimize());

// Renderer (via preload)
window.electron.minimizeWindow();
```

### Production Server Management

In production, the app spawns a Next.js standalone server as a child process:
1. Server is started before the window loads
2. Server runs at `localhost:3000`
3. Server is killed when the app closes
4. Environment variable `LUCY_USER_DATA_PATH` is passed to the server for database location

### Window Configuration

The main window is created with:
- Minimum size: 800x600
- Default size: 1200x800
- macOS: Hidden title bar with inset traffic lights
- Dark background color (`#0a0a0a`)
- Centered on primary display

## Interfaces (Preload API)

The preload script exposes `window.electron` with these methods:

| Method | Type | Description |
|--------|------|-------------|
| `getAppPath()` | `Promise<string>` | Returns the app's installation path |
| `getUserDataPath()` | `Promise<string>` | Returns the user data directory path |
| `minimizeWindow()` | `void` | Minimizes the main window |
| `maximizeWindow()` | `void` | Toggles maximize/unmaximize |
| `closeWindow()` | `void` | Closes the main window |
| `invoke(channel, ...args)` | `Promise<unknown>` | Generic IPC invoke wrapper |
| `on(channel, callback)` | `() => void` | Subscribe to IPC events; returns unsubscribe function |

**TypeScript Declaration** (for renderer usage):
```typescript
interface ElectronAPI {
  getAppPath: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

## Dependencies

This module has **one-way dependencies** - it does not import from the renderer:

| Dependency | Purpose |
|------------|---------|
| `electron` | Core Electron APIs (`app`, `BrowserWindow`, `ipcMain`, `ipcRenderer`, `contextBridge`, `screen`) |
| `path` | Node.js path utilities for cross-platform paths |
| `child_process` | Spawning the Next.js server in production |

## Security

The main process enforces strict security settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| `contextIsolation` | `true` | Isolates preload script context from renderer; prevents renderer from accessing Node.js |
| `nodeIntegration` | `false` | Disables Node.js APIs in renderer; renderer cannot use `require()` or access `process` |
| Preload script | Limited API | Only exposes specific, safe methods via `contextBridge`; no direct `ipcRenderer` access |

These settings are enforced in both `background.ts` and `create-window.ts` (as defaults).

### Security Best Practices Followed

1. **Minimal API surface** - Only essential methods are exposed to renderer
2. **No arbitrary code execution** - Renderer cannot execute arbitrary IPC calls that aren't explicitly handled
3. **Separate user data** - Development uses a separate userData path (`(development)` suffix)
4. **Process isolation** - The Next.js server runs as a separate child process
