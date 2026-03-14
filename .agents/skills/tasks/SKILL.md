---
name: tasks
description: Persistent task board for agent work tracking. JSON-based per-project kanban stored in .agents/tasks/board.json. Use when the user says "create task", "complete task", "update task", "list tasks", "what's pending", "remove task", or when starting a session to check for pending work.
---

# Tasks

Persistent task management for the agent. Tasks survive between sessions — check them on startup, update them as you work.

## Prompt injection

Pending tasks are injected into the system prompt file (`prompt.md` by default, or the file at `PI_BRIDGE_PROMPT`). This keeps the agent aware of outstanding work without polluting messages.

### Managed section

Maintain a fenced section at the **end** of the prompt file:

```
<!-- TASKS:START -->
## Pending Tasks

- [001] Fix memory extraction pipeline (in-progress)
- [002] Add error handling to gateway routes (todo)
<!-- TASKS:END -->
```

Rules:
- Only include tasks with status `todo` or `in-progress` (never `done`)
- Format: `- [ID] Title (status)`
- If notes exist, add them on the next line indented: `  Notes: ...`
- If there are no pending tasks, remove the entire section (including markers)
- Always replace everything between `<!-- TASKS:START -->` and `<!-- TASKS:END -->` — never append
- The markers must be on their own lines

### When to sync

Update the prompt section **after every board mutation** (create, update, complete, remove). Read the prompt file, replace or insert the section, write it back. The runtime auto-reloads on file change.

## Board file

Storage: `.agents/tasks/board.json` in the project root. See [references/schema.md](references/schema.md) for the full schema.

## Operations

### Create a task

1. Read the board file (or create it if missing — see [references/schema.md](references/schema.md) for empty board template)
2. Generate the next ID from `nextId`, increment `nextId`
3. Add the task with status `"todo"`, today's date for `created` and `updated`
4. Write the board file
5. Sync prompt section
6. Confirm with: `Task 004 created: <title>`

Only include `notes` and `links` fields when the user provides them. Do not add empty strings or empty arrays.

### Update a task

Change status, title, notes, or links. Update the `updated` date. Sync prompt section. Confirm with one line.

Valid status transitions: any → any. No enforcement — the agent knows what makes sense.

### Complete a task

Shorthand for setting status to `"done"`. Update the `updated` date. Sync prompt section.

### Remove a task

Delete the task object from the array. Do not reuse IDs. Sync prompt section. Confirm with one line.

### List tasks

Group by status: `in-progress` first, then `todo`, then `done`. Show ID, title, and notes (if any). Skip empty groups.

## Rules

- Always read the file before modifying — never write from memory alone
- Keep the JSON formatted with 2-space indentation
- One task = one discrete unit of work (not epics, not subtasks)
- Titles are short and imperative: "Fix memory extraction", not "The memory extraction needs fixing"
- When completing work that corresponds to a task, move it to done without being asked
