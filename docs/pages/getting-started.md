---
title: Getting Started
section: General
order: 1
---

# Getting Started

Lucy is an AI agent infrastructure project with a modular architecture split into **runtime** (agent execution) and **gateway** (HTTP + integrations).

## Quick Start

```bash
npm install
npm run dev
```

This starts the gateway with hot reload. The chat UI is available at `/chat`.

## Project Structure

```
src/
├── runtime/
│   ├── core/           # Agent execution loop
│   └── extensions/
│       └── memory/     # Memory observer
└── gateway/
    ├── core/           # Hono REST API
    └── extensions/
        ├── webui/      # Chat UI (Vite + React)
        ├── landing-page/ # This site (Astro)
        ├── whatsapp/   # WhatsApp integration
        └── telegram/   # Telegram bot
```

## Configuration

All configuration lives in `lucy.config.json` at the project root. See the [configuration docs](/docs/configuration/) for details.
