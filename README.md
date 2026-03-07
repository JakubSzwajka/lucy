# Lucy

Multi-package workspace for agent infrastructure.

## Packages

| Package | Description |
|---------|-------------|
| [agents-runtime](./agents-runtime/) | Standalone agent execution engine (AI SDK, pluggable storage, plugins) |
| [agents-gateway-http](./agents-gateway-http/) | REST gateway for the runtime (Hono) |
| [agents-webui](./agents-webui/) | Chat UI for the gateway (React + Vite) |
| [agents-memory](./agents-memory/) | Proof runtime plugin for memory context |
| [agents-landing-page](./agents-landing-page/) | Static landing page (Astro, GitHub Pages) |
| [.legacy](./.legacy/) | Archived Next.js reference app |

## Quick Start

```bash
npm install                                     # install all workspace deps
npm run dev --workspace=agents-gateway-http     # start API on :3080
npm run dev --workspace=agents-webui            # start UI on :5173
```

## Configuration

Lucy uses an optional `lucy.config.json` file for declarative configuration. Each workspace package reads its own top-level key.

```bash
cp lucy.config.example.json lucy.config.json    # start from the example
```

| Key | Package | Description |
|-----|---------|-------------|
| `agents-runtime` | agents-runtime | Plugin enablement and per-plugin settings |
| `agents-memory` | agents-memory | Reserved for future memory settings |
| `agents-gateway-http` | agents-gateway-http | Reserved for future gateway settings |

Override the config path with `LUCY_CONFIG_PATH` env var. Missing file = zero-config defaults.

For Docker deployments, mount a custom config:
```bash
make docker-run LUCY_CONFIG=./my-config.json
```

See [`lucy.config.example.json`](./lucy.config.example.json) for all available options.

## Workspace Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run typecheck --workspace=agents-runtime` | Typecheck runtime |
| `npm run typecheck --workspace=agents-gateway-http` | Typecheck gateway |
| `npm run smoke:configured-runtime` | Run runtime smoke test |
