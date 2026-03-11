---
title: Configuration
section: General
order: 2
---

# Configuration

Lucy is configured via `lucy.config.json` at the project root. All keys are optional.

```json
{
  "runtime": {
    "model": "...",
    "compaction": {},
    "session": {},
    "extensions": []
  },
  "gateway": {
    "apiKey": "..."
  },
  "whatsapp": {
    "phoneNumberId": "...",
    "verifyToken": "...",
    "allowedNumbers": []
  },
  "telegram": {
    "allowedChatIds": []
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LUCY_API_KEY` | API key (alternative to config file) |
| `DATABASE_URL` | PostgreSQL connection string |

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start with hot reload |
| `npm run typecheck` | Type-check all modules |
| `npm run build` | Build static assets |
