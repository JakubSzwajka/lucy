# Task Board Schema

## File location

`.agents/tasks/board.json` in the project root.

## Schema

```json
{
  "version": 1,
  "nextId": 4,
  "tasks": [
    {
      "id": "001",
      "title": "Short imperative description",
      "status": "todo",
      "notes": "Optional context, reasoning, or details",
      "links": ["src/some/file.ts", "docs/some-doc.md"],
      "created": "2026-03-13",
      "updated": "2026-03-13"
    }
  ]
}
```

## Field rules

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Zero-padded 3-digit, auto-incremented from `nextId` |
| `title` | string | yes | Short, imperative. Max ~80 chars |
| `status` | enum | yes | `"todo"`, `"in-progress"`, `"done"` |
| `notes` | string | no | Free-form context. Omit if empty |
| `links` | string[] | no | Relative file paths or URLs. Omit if empty |
| `created` | string | yes | ISO date (YYYY-MM-DD) |
| `updated` | string | yes | ISO date, refreshed on any change |

## Empty board

When creating a new board file:

```json
{
  "version": 1,
  "nextId": 1,
  "tasks": []
}
```

## ID generation

1. Read `nextId` from the board
2. Pad to 3 digits: `String(nextId).padStart(3, '0')`
3. Increment `nextId` by 1
4. Write back
