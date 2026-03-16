---
name: browse
description: Search the web by query or fetch content from a URL. Use for any web research task — finding pages, reading articles, extracting content from sites. Requires TAVILY_API_KEY env var.
---

# Web (Browse)

Two commands: `search` and `fetch`. Tavily-powered, Playwright as fallback.

## Usage

```bash
# Search — find pages by query
node /root/.agents/skills/browse/src/cli.js search "your query"
node /root/.agents/skills/browse/src/cli.js search "your query" --max 10
node /root/.agents/skills/browse/src/cli.js search "your query" --deep   # more thorough, costs more credits

# Fetch — extract full content from a URL
node /root/.agents/skills/browse/src/cli.js fetch https://example.com
node /root/.agents/skills/browse/src/cli.js fetch https://example.com --playwright  # force headless browser
```

## How it works

- `search`: Tavily search API — returns titles, URLs, snippets, and an AI-generated answer
- `fetch`: Tavily extract API first (fast, clean) → falls back to Playwright headless browser if Tavily fails

## When to use what

- **search**: starting point for any research — no URL needed
- **fetch**: deep-read a specific page (after search gives you the URL)
- **fetch --playwright**: when Tavily extract returns empty (rare, usually JS-heavy auth-walled sites)

## Env

`TAVILY_API_KEY` — must be set. Set by Kuba in env vars.
