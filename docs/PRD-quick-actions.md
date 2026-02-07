# PRD: Quick Actions

## Overview

Quick Actions are predefined, reusable prompts that appear as clickable buttons on the empty chat screen. When clicked, they send a pre-written message to the agent as if the user typed it. Think "Morning Brief", "Check Tasks", "Summarize Last Session" — one-click shortcuts that trigger the agent to use its existing tools and gather context.

This is NOT a system-level prefetch or AI warm-up mechanism. It's user-driven: the user decides when to trigger a quick action by clicking a button. The agent then uses its normal tools (MCP servers, builtins) to fulfill the request.

## User Experience

1. User opens a new conversation (or an existing empty one)
2. The empty state shows the Lucy logo + welcome message + a row of quick action chips
3. User clicks "Morning Brief"
4. The prompt text (e.g., "Give me a morning brief: check my pending tasks, summarize my last 3 conversations, and note any upcoming deadlines") is sent as a regular user message
5. The agent processes it like any other message, using its tools
6. Conversation continues normally

Quick actions are managed in Settings, similar to how System Prompts are managed today.

## Data Model

### New table: `quick_actions`

```sql
CREATE TABLE quick_actions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,          -- Display label on the chip (e.g., "Morning Brief")
  content       TEXT NOT NULL,          -- The actual prompt text sent as user message
  icon          TEXT,                   -- Optional emoji or icon identifier
  sort_order    INTEGER NOT NULL DEFAULT 0,  -- Display order (lower = first)
  enabled       INTEGER NOT NULL DEFAULT 1,  -- 1 = shown in UI, 0 = hidden
  created_at    INTEGER NOT NULL,       -- Timestamp
  updated_at    INTEGER NOT NULL        -- Timestamp
);
```

**Why a separate table (not extending `system_prompts`):**
- System prompts and quick actions serve fundamentally different purposes: system prompts are invisible instructions to the AI, quick actions are visible user-facing message shortcuts
- Quick actions need fields that don't apply to system prompts (`icon`, `sort_order`, `enabled`)
- Keeps existing system prompt functionality untouched — zero migration risk
- Can evolve independently (e.g., adding categories, keybindings, conditional visibility later)

## Architecture

### Files to Create

```
renderer/src/lib/db/schema.ts                          -- Add quick_actions table definition
renderer/src/types/index.ts                             -- Add QuickAction types
renderer/src/lib/services/config/quick-action.service.ts -- QuickActionService (CRUD)
renderer/src/app/api/quick-actions/route.ts             -- GET (list), POST (create)
renderer/src/app/api/quick-actions/[id]/route.ts        -- GET, PATCH, DELETE
renderer/src/hooks/useQuickActions.ts                   -- Frontend data hook
renderer/src/components/settings/QuickActionsSettings.tsx -- Settings page component
renderer/src/components/settings/QuickActionsList.tsx   -- List panel (left side)
renderer/src/components/settings/QuickActionEditor.tsx  -- Editor panel (right side)
renderer/src/app/(main)/settings/quick-actions/page.tsx -- Settings page route
renderer/src/components/chat/QuickActions.tsx            -- Chat empty state chips
```

### Files to Modify

```
renderer/src/lib/db/schema.ts           -- Add table + types
renderer/src/types/index.ts             -- Add interfaces
renderer/src/lib/services/config/index.ts -- Export new service
renderer/src/lib/services/index.ts       -- Export new service
renderer/src/components/settings/index.ts -- Export new components
renderer/src/components/sidebar/Sidebar.tsx -- Add nav item for Quick Actions settings
renderer/src/components/chat/MessageList.tsx -- Add QuickActions to empty state
renderer/src/components/chat/ChatContainer.tsx -- Pass sendMessage to MessageList
```

## Implementation Plan

### Step 1: Schema

**File: `renderer/src/lib/db/schema.ts`**

Add after the `systemPrompts` table definition:

```typescript
// ============================================================================
// QUICK ACTIONS - Predefined user prompts shown on empty chat
// ============================================================================

export const quickActions = sqliteTable("quick_actions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type QuickActionRecord = typeof quickActions.$inferSelect;
export type NewQuickAction = typeof quickActions.$inferInsert;
```

Then run `npm run db:push` to apply the migration.

### Step 2: Types

**File: `renderer/src/types/index.ts`**

Add after the `SystemPromptUpdate` interface:

```typescript
// ============================================================================
// QUICK ACTIONS
// ============================================================================

export interface QuickAction {
  id: string;
  name: string;
  content: string;
  icon: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickActionCreate {
  name: string;
  content: string;
  icon?: string;
  sortOrder?: number;
}

export interface QuickActionUpdate {
  name?: string;
  content?: string;
  icon?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}
```

### Step 3: Service

**File: `renderer/src/lib/services/config/quick-action.service.ts`**

Follow the exact same pattern as `system-prompt.service.ts`. Key differences:

- No seed data (start empty — user creates their own)
- Support `enabled` filter
- Support `sortOrder` for ordering
- No "set as default" concept

```typescript
import { db, quickActions, QuickActionRecord } from "@/lib/db";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

function parseRecord(record: QuickActionRecord): QuickAction {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    icon: record.icon,
    sortOrder: record.sortOrder,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class QuickActionService {
  /** Get all quick actions, ordered by sortOrder */
  getAll(): QuickAction[] {
    const records = db
      .select()
      .from(quickActions)
      .orderBy(asc(quickActions.sortOrder), asc(quickActions.name))
      .all();
    return records.map(parseRecord);
  }

  /** Get only enabled quick actions (for the chat UI) */
  getEnabled(): QuickAction[] {
    const records = db
      .select()
      .from(quickActions)
      .where(eq(quickActions.enabled, true))
      .orderBy(asc(quickActions.sortOrder), asc(quickActions.name))
      .all();
    return records.map(parseRecord);
  }

  /** Get by ID */
  getById(id: string): QuickAction | null {
    const [record] = db
      .select()
      .from(quickActions)
      .where(eq(quickActions.id, id))
      .all();
    return record ? parseRecord(record) : null;
  }

  /** Create a new quick action */
  create(data: QuickActionCreate): { action?: QuickAction; error?: string } {
    if (!data.name || !data.content) {
      return { error: "Name and content are required" };
    }

    const id = uuidv4();

    db.insert(quickActions)
      .values({
        id,
        name: data.name,
        content: data.content,
        icon: data.icon || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .run();

    return { action: this.getById(id)! };
  }

  /** Update a quick action */
  update(id: string, data: QuickActionUpdate): { action?: QuickAction; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { notFound: true };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    db.update(quickActions)
      .set(updateData)
      .where(eq(quickActions.id, id))
      .run();

    return { action: this.getById(id)! };
  }

  /** Delete a quick action */
  delete(id: string): { success: boolean; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, notFound: true };
    }

    db.delete(quickActions).where(eq(quickActions.id, id)).run();
    return { success: true };
  }
}

// Singleton
let instance: QuickActionService | null = null;

export function getQuickActionService(): QuickActionService {
  if (!instance) {
    instance = new QuickActionService();
  }
  return instance;
}
```

**File: `renderer/src/lib/services/config/index.ts`** — Add export:
```typescript
export { QuickActionService, getQuickActionService } from "./quick-action.service";
```

**File: `renderer/src/lib/services/index.ts`** — Add export:
```typescript
export { QuickActionService, getQuickActionService } from "./config";
```

### Step 4: API Routes

**File: `renderer/src/app/api/quick-actions/route.ts`**

Follow the exact pattern of `/api/system-prompts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getQuickActionService } from "@/lib/services";

// GET /api/quick-actions - List all quick actions
export async function GET() {
  const service = getQuickActionService();
  const actions = service.getAll();
  return NextResponse.json(actions);
}

// POST /api/quick-actions - Create a new quick action
export async function POST(req: Request) {
  const { name, content, icon, sortOrder } = await req.json();
  const service = getQuickActionService();

  const result = service.create({ name, content, icon, sortOrder });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.action, { status: 201 });
}
```

**File: `renderer/src/app/api/quick-actions/[id]/route.ts`**

Follow the exact pattern of `/api/system-prompts/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getQuickActionService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/quick-actions/[id]
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const service = getQuickActionService();
  const action = service.getById(id);

  if (!action) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  return NextResponse.json(action);
}

// PATCH /api/quick-actions/[id]
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();
  const service = getQuickActionService();

  const result = service.update(id, {
    name: body.name,
    content: body.content,
    icon: body.icon,
    sortOrder: body.sortOrder,
    enabled: body.enabled,
  });

  if (result.notFound) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  return NextResponse.json(result.action);
}

// DELETE /api/quick-actions/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const service = getQuickActionService();
  const result = service.delete(id);

  if (result.notFound) {
    return NextResponse.json({ error: "Quick action not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
```

### Step 5: Frontend Hook

**File: `renderer/src/hooks/useQuickActions.ts`**

Follow the exact pattern of `useSystemPrompts.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

export function useQuickActions() {
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/quick-actions");
      if (response.ok) {
        const data = await response.json();
        setActions(
          data.map((a: QuickAction) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          }))
        );
      } else {
        throw new Error("Failed to fetch quick actions");
      }
    } catch (err) {
      console.error("[QuickActions] Failed to fetch:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const createAction = useCallback(
    async (data: QuickActionCreate): Promise<QuickAction> => {
      const response = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create quick action");

      const created = await response.json();
      const action: QuickAction = {
        ...created,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
      };

      setActions((prev) => [...prev, action].sort((a, b) => a.sortOrder - b.sortOrder));
      return action;
    },
    []
  );

  const updateAction = useCallback(
    async (id: string, data: QuickActionUpdate): Promise<QuickAction> => {
      const response = await fetch(`/api/quick-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update quick action");

      const updated = await response.json();
      const action: QuickAction = {
        ...updated,
        createdAt: new Date(updated.createdAt),
        updatedAt: new Date(updated.updatedAt),
      };

      setActions((prev) =>
        prev
          .map((a) => (a.id === id ? action : a))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      );
      return action;
    },
    []
  );

  const deleteAction = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/quick-actions/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete quick action");

    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    actions,
    isLoading,
    error,
    createAction,
    updateAction,
    deleteAction,
    refreshActions: fetchActions,
  };
}
```

### Step 6: Settings UI

The settings UI for Quick Actions should mirror the System Prompts settings. It's a split-panel layout: list on the left, editor on the right.

**File: `renderer/src/app/(main)/settings/quick-actions/page.tsx`**

Follow the exact pattern of `settings/prompts/page.tsx`:

```typescript
"use client";

import { QuickActionsSettings } from "@/components/settings/QuickActionsSettings";
import { useQuickActions } from "@/hooks/useQuickActions";

export default function QuickActionsSettingsPage() {
  const {
    actions,
    isLoading,
    createAction,
    updateAction,
    deleteAction,
  } = useQuickActions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <QuickActionsSettings
      actions={actions}
      onCreateAction={createAction}
      onUpdateAction={updateAction}
      onDeleteAction={deleteAction}
    />
  );
}
```

**File: `renderer/src/components/settings/QuickActionsSettings.tsx`**

Mirror `SystemPromptsSettings.tsx` structure. Split panel: left = list, right = editor.
The editor should have:
- Name input (the chip label, e.g., "Morning Brief")
- Icon input (optional emoji, e.g., "☀️")
- Content textarea (the actual prompt text)
- Enabled toggle
- Sort order input (number)
- Save / Delete buttons

**File: `renderer/src/components/settings/QuickActionsList.tsx`**

Mirror `PromptsList.tsx`. Show each quick action with:
- Name
- Icon (if set)
- First 60 chars of content as preview
- Enabled/disabled indicator (dimmed if disabled)

**File: `renderer/src/components/settings/QuickActionEditor.tsx`**

Mirror `PromptEditor.tsx` with additional fields:
- Name input
- Icon input (small text input for emoji)
- Content textarea (with helpful placeholder like "e.g., Give me a morning brief: check my pending tasks and summarize my recent conversations")
- Enabled toggle (checkbox or switch)
- Sort order (number input)
- Save / Delete / Cancel buttons

### Step 7: Sidebar Navigation

**File: `renderer/src/components/sidebar/Sidebar.tsx`**

Add a new entry to `COMMAND_CENTER_NAV` array, after the "System Prompts" entry (after line 51):

```typescript
{
  href: "/settings/quick-actions",
  label: "Quick Actions",
  matchPrefix: "/settings/quick-actions",
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
},
```

The lightning bolt icon fits "Quick Actions" conceptually.

### Step 8: Chat Empty State Integration

This is the user-facing part. Quick action chips appear in the empty chat state.

**File: `renderer/src/components/chat/QuickActions.tsx`** (new component)

```typescript
"use client";

import { useState, useEffect } from "react";
import type { QuickAction } from "@/types";

interface QuickActionsProps {
  onSelect: (content: string) => void;
}

export function QuickActions({ onSelect }: QuickActionsProps) {
  const [actions, setActions] = useState<QuickAction[]>([]);

  useEffect(() => {
    fetch("/api/quick-actions")
      .then((res) => res.json())
      .then((data: QuickAction[]) => {
        // Only show enabled actions, sorted by sortOrder
        const enabled = data
          .filter((a) => a.enabled)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setActions(enabled);
      })
      .catch((err) => console.error("[QuickActions] Failed to fetch:", err));
  }, []);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 justify-center">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelect(action.content)}
          className="px-3 py-1.5 text-xs border border-border rounded-full
                     hover:bg-background-secondary transition-colors
                     text-muted-foreground hover:text-foreground"
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.name}
        </button>
      ))}
    </div>
  );
}
```

**File: `renderer/src/components/chat/MessageList.tsx`** — Modify empty state

The `MessageList` component currently renders a static empty state (lines 182-200). It needs to:
1. Accept an `onQuickAction` callback prop
2. Render `<QuickActions>` inside the empty state

Change the component interface:

```typescript
interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onQuickAction?: (content: string) => void;  // NEW
}
```

Update the empty state block (lines 182-200):

```typescript
if (messages.length === 0) {
  return (
    <ConversationEmptyState>
      <Image
        src="/logo.png"
        alt="Lucy"
        width={80}
        height={80}
        className="mb-4"
      />
      <span className="label block mb-2">// INIT.SEQUENCE</span>
      <h2 className="text-xl font-medium mb-2 tracking-tight text-foreground">
        Welcome to Lucy
      </h2>
      <p className="text-sm text-muted-foreground">
        Start a conversation by typing a message below.
      </p>
      {onQuickAction && <QuickActions onSelect={onQuickAction} />}
    </ConversationEmptyState>
  );
}
```

**File: `renderer/src/components/chat/ChatContainer.tsx`** — Wire it up

Pass `handleSendMessage` to `MessageList` as `onQuickAction`:

```typescript
{/* Messages */}
<MessageList
  messages={messages}
  isLoading={isLoading}
  onQuickAction={handleSendMessage}  // NEW
/>
```

That's it. When a quick action chip is clicked, it calls `handleSendMessage(content)` which goes through the same path as typing a message and pressing send.

## Export Updates

**File: `renderer/src/components/settings/index.ts`** — Add:
```typescript
export { QuickActionsSettings } from "./QuickActionsSettings";
```

**File: `renderer/src/lib/db/index.ts`** — Make sure `quickActions` is exported from the db barrel file alongside other tables.

## Testing Checklist

After implementation, verify:

- [ ] `npm run db:push` succeeds (schema applied)
- [ ] Settings > Quick Actions page loads with empty state
- [ ] Can create a quick action with name + content
- [ ] Can edit an existing quick action
- [ ] Can delete a quick action
- [ ] Can toggle enabled/disabled
- [ ] Disabled actions don't appear in chat empty state
- [ ] Enabled actions appear as chips in the chat empty state
- [ ] Clicking a chip sends the content as a user message
- [ ] The agent responds normally (uses tools, etc.)
- [ ] After first message, chips disappear (normal message flow takes over)
- [ ] Sort order is respected in the chip display

## Seed Data (Optional)

If you want to ship with example quick actions for a better first-run experience, add seed data in the service (like `SystemPromptService.ensureSeedPrompts()`):

```typescript
const SEED_ACTIONS = [
  {
    name: "Morning Brief",
    icon: "☀️",
    content: "Give me a morning brief. Check my pending tasks, summarize what we discussed in recent conversations, and highlight anything that needs my attention today.",
    sortOrder: 0,
  },
  {
    name: "Review Tasks",
    icon: "📋",
    content: "Show me my current tasks and their status. What's overdue? What's coming up next?",
    sortOrder: 1,
  },
  {
    name: "Continue Last Topic",
    icon: "↩️",
    content: "What were we working on in our last conversation? Give me a quick summary and let's pick up where we left off.",
    sortOrder: 2,
  },
];
```

Whether to seed or not is a product decision — can be added later. For V1, starting empty is fine.

## Summary

| Layer | What | Pattern to Follow |
|-------|------|-------------------|
| Schema | `quick_actions` table | Same style as `systemPrompts` in `schema.ts` |
| Types | `QuickAction`, `QuickActionCreate`, `QuickActionUpdate` | Same style as `SystemPrompt*` in `types/index.ts` |
| Service | `QuickActionService` + `getQuickActionService()` | Copy `system-prompt.service.ts` pattern |
| API | `/api/quick-actions` + `/api/quick-actions/[id]` | Copy `/api/system-prompts` pattern |
| Hook | `useQuickActions()` | Copy `useSystemPrompts.ts` pattern |
| Settings UI | `QuickActionsSettings` + list + editor | Copy `SystemPromptsSettings` + `PromptsList` + `PromptEditor` pattern |
| Settings page | `settings/quick-actions/page.tsx` | Copy `settings/prompts/page.tsx` pattern |
| Sidebar | Add nav entry | Add to `COMMAND_CENTER_NAV` in `Sidebar.tsx` |
| Chat UI | `QuickActions` component in empty state | New component, wired via `onQuickAction` prop |

The entire feature follows existing patterns. Every new file has a direct counterpart in the codebase to reference. No new architectural concepts, no new dependencies.
