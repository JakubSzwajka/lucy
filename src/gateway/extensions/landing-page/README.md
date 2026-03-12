---
title: Landing Page
section: Gateway
subsection: Extensions
order: 11
---

# agents-landing-page

Astro static site mounted by the gateway as the catch-all non-API surface.

## Activation

The gateway mounts this site when `src/gateway/extensions/landing-page/dist/` exists. Build it with `npm run build:landing`.

## Local Build

```bash
npm run build:landing
```

## Responsibility Boundary

Owns static marketing/docs pages and filesystem-based route output. Delegates all API and agent behavior to the gateway core.

## Operational Constraints

- Must be mounted after API routes so it does not shadow them
- Serves built files only; missing `dist/` means the plugin is skipped
- Rewrites directory-style paths to `index.html`

## Read Next

- [agents-gateway-http](../../core/README.md) - server that mounts this catch-all plugin
- [agents-webui](../webui/README.md) - separate interactive UI mounted under `/chat`
