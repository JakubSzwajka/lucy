# Generative UI Implementation Plan

## Goal
Render rich, interactive React components for specific MCP tool results (starting with Todoist) inline within chat messages, avoiding data duplication.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ MessageBubble                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Activities (collapsed)                                   │   │
│  │  > Reasoning...                                          │   │
│  │  > Tool: todoist__get_tasks ✓                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Here's what's on your plate today:                            │
│  (AI commentary - no data listing)                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✨ GENERATIVE UI COMPONENT                               │   │
│  │ ┌───────────────────────────────────────────────────┐   │   │
│  │ │ ☐ Wystaw fakturę dla SOFOMO       Jan 27  Due today│   │   │
│  │ │ ☐ Zapłać podatki za działkę       Dec 20  ⚠ Overdue│   │   │
│  │ │ ☐ Kup Domi kurtkę                 Oct 22  ⚠ Overdue│   │   │
│  │ └───────────────────────────────────────────────────┘   │   │
│  │ [Complete] [Reschedule] [View in Todoist]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  3 of these are overdue - want me to help prioritize?          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation

### 1.1 Create Generative UI Registry
**File:** `renderer/src/lib/generative-ui/registry.ts`

```typescript
import type { ComponentType } from "react";
import type { ToolCallActivity } from "@/types";

export interface GenerativeUIComponentProps<T = unknown> {
  data: T;
  activity: ToolCallActivity;
  onAction?: (action: string, payload: unknown) => void;
}

export interface GenerativeUIConfig {
  component: ComponentType<GenerativeUIComponentProps>;
  parseResult: (result: string) => unknown;
  // Tool patterns this component handles
  toolPatterns: string[];
}

// Registry maps tool names to their generative UI config
export const generativeUIRegistry: Record<string, GenerativeUIConfig> = {};

export function registerGenerativeUI(config: GenerativeUIConfig) {
  for (const pattern of config.toolPatterns) {
    generativeUIRegistry[pattern] = config;
  }
}

export function getGenerativeUI(toolName: string): GenerativeUIConfig | null {
  // Direct match
  if (generativeUIRegistry[toolName]) {
    return generativeUIRegistry[toolName];
  }
  // Pattern match (e.g., "todoist__*")
  for (const [pattern, config] of Object.entries(generativeUIRegistry)) {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      if (regex.test(toolName)) {
        return config;
      }
    }
  }
  return null;
}
```

### 1.2 Create Types for Todoist
**File:** `renderer/src/lib/generative-ui/todoist/types.ts`

```typescript
export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4; // 4 = urgent, 1 = normal
  due?: {
    date: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  labels: string[];
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  is_completed: boolean;
  url: string;
}

export interface TodoistTaskListData {
  tasks: TodoistTask[];
  filter?: string;
  total?: number;
}
```

---

## Phase 2: Todoist Component

### 2.1 Create TodoistTaskList Component
**File:** `renderer/src/components/generative-ui/todoist/TodoistTaskList.tsx`

Features:
- [ ] Task list with checkboxes
- [ ] Priority indicators (P1-P4 with colors)
- [ ] Due date badges (today, overdue, upcoming)
- [ ] Emoji support (from task content)
- [ ] Expandable task details (description)
- [ ] Action buttons:
  - Complete task
  - Reschedule (opens date picker)
  - Open in Todoist (external link)
- [ ] Loading states for actions
- [ ] Error handling for failed actions

### 2.2 Component Styling
- Match existing app theme (dark mode, border colors)
- Use existing utility classes from the app
- Subtle animations for state changes

---

## Phase 3: Integration into MessageBubble

### 3.1 Modify ToolCallActivity Type
**File:** `renderer/src/types/index.ts`

Add field to track if generative UI should be used:
```typescript
export interface ToolCallActivity extends AgentActivityBase {
  // ... existing fields
  hasGenerativeUI?: boolean;
}
```

### 3.2 Create GenerativeUIRenderer Component
**File:** `renderer/src/components/generative-ui/GenerativeUIRenderer.tsx`

```typescript
interface Props {
  activities: ToolCallActivity[];
  onAction?: (toolName: string, action: string, payload: unknown) => void;
}

export function GenerativeUIRenderer({ activities, onAction }: Props) {
  // Filter activities that have generative UI components
  // Render each component with parsed data
}
```

### 3.3 Modify MessageBubble
**File:** `renderer/src/components/chat/MessageBubble.tsx`

```diff
+ import { GenerativeUIRenderer } from "@/components/generative-ui/GenerativeUIRenderer";

  // Inside the message bubble, after markdown content:
  {hasContent && (
    <div className="markdown-content break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )}

+ {/* Generative UI Components */}
+ {!isUser && hasActivities && (
+   <GenerativeUIRenderer
+     activities={activities?.filter(a => a.type === "tool_call") ?? []}
+     onAction={handleGenerativeAction}
+   />
+ )}
```

### 3.4 Modify InlineActivityList
**File:** `renderer/src/components/chat/AgentActivity.tsx`

When a tool call has generative UI:
- Keep it in the activity list but mark as "rendered below"
- Or collapse by default with note "See interactive view below"

---

## Phase 4: Prompt Engineering

### 4.1 System Prompt Enhancement
Add to default system prompt (or as a dynamic addition when Todoist MCP is enabled):

```markdown
## Interactive Components

When you call certain tools, the results are displayed as interactive UI components to the user. For these tools, DO NOT list or repeat the data in your response - the user will see it in the component.

Tools with interactive UI:
- `todoist__get_tasks` / `todoist__find_tasks_by_date` → Task list component
- `todoist__get_projects` → Project list component

For these tools:
✅ DO: Provide commentary, analysis, suggestions, or ask follow-up questions
❌ DON'T: List the tasks/items in a table or bullet points

Example good response after calling todoist__get_tasks:
"You have 4 tasks due today, 3 of which are overdue. The tax payment has been sitting there for over a month - should I help you reschedule it?"

Example bad response (duplicates data):
"Here are your tasks:
| Task | Due | Status |
| Task 1 | Jan 27 | Due |
..."
```

### 4.2 Dynamic Prompt Injection
**File:** `renderer/src/app/api/chat/route.ts`

When building the system prompt, check which MCP servers are enabled and inject relevant generative UI instructions.

---

## Phase 5: Tool Actions (Interactive)

### 5.1 Create Action Handler API
**File:** `renderer/src/app/api/tools/execute/route.ts`

New endpoint to execute tool actions from generative UI:
```typescript
POST /api/tools/execute
{
  "serverId": "todoist-mcp",
  "toolName": "complete_task",
  "args": { "task_id": "123" }
}
```

### 5.2 Wire Up Actions in Component
When user clicks "Complete" on a task:
1. Call the action API
2. Show loading state on that task
3. Update local state on success
4. Show error toast on failure

---

## Phase 6: Future Extensions

### 6.1 Additional Todoist Components
- `TodoistProjectList` - for `get_projects` tool
- `TodoistTaskDetail` - expanded single task view
- `TodoistQuickAdd` - inline task creation form

### 6.2 Other MCP Server Components
- Calendar events component
- Email preview component
- File browser component
- etc.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `renderer/src/lib/generative-ui/registry.ts` | Create | Component registry |
| `renderer/src/lib/generative-ui/todoist/types.ts` | Create | Todoist types |
| `renderer/src/components/generative-ui/todoist/TodoistTaskList.tsx` | Create | Main task list component |
| `renderer/src/components/generative-ui/GenerativeUIRenderer.tsx` | Create | Renderer coordinator |
| `renderer/src/components/generative-ui/index.ts` | Create | Barrel export |
| `renderer/src/components/chat/MessageBubble.tsx` | Modify | Add generative UI rendering |
| `renderer/src/components/chat/AgentActivity.tsx` | Modify | Handle generative UI tools differently |
| `renderer/src/types/index.ts` | Modify | Add `hasGenerativeUI` field |
| `renderer/src/app/api/chat/route.ts` | Modify | Inject prompt instructions |
| `renderer/src/app/api/tools/execute/route.ts` | Create | Action execution endpoint |

---

## Implementation Order

1. **Phase 1** - Foundation (registry, types)
2. **Phase 2** - TodoistTaskList component (static, no actions)
3. **Phase 3** - Integration into MessageBubble
4. **Phase 4** - Prompt engineering (avoid duplication)
5. **Phase 5** - Interactive actions (complete, reschedule)
6. **Phase 6** - Polish and additional components

---

## Questions to Resolve

1. **Action confirmation**: Should task completion require confirmation or be instant?
2. **Optimistic updates**: Update UI immediately or wait for server response?
3. **Error recovery**: How to handle failed actions? (Toast? Inline error?)
4. **Refresh data**: After an action, should we re-fetch the task list or update locally?
5. **Component persistence**: If user scrolls up to old message, should actions still work?
