# Settings Module Specification

## Overview

A user settings module for Lucy Desktop App that allows configuration of default model, system prompts library, and model availability. Settings persist to SQLite database and sync across the application.

---

## 1. Database Schema

### New Table: `settings`

Single-row table for user settings (can evolve to multi-user if needed).

```typescript
// renderer/src/lib/db/schema.ts

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"), // Single row with fixed ID
  defaultModelId: text("default_model_id"),       // e.g., "gpt-4o", "claude-sonnet"
  defaultSystemPromptId: text("default_system_prompt_id"), // References system_prompts.id
  enabledModels: text("enabled_models"),          // JSON array of model IDs
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### New Table: `system_prompts`

Library of reusable system prompts.

```typescript
// renderer/src/lib/db/schema.ts

export const systemPrompts = sqliteTable("system_prompts", {
  id: text("id").primaryKey(),                    // UUID
  name: text("name").notNull(),                   // Display name, e.g., "Code Expert"
  content: text("content").notNull(),             // The actual prompt text
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Default Values

On first app launch (or if settings row doesn't exist):
- `defaultModelId`: `"gpt-4o"` (or first available model)
- `defaultSystemPromptId`: `null` (no default prompt)
- `enabledModels`: All models enabled by default (JSON array of all model IDs)

Seed system prompts (created on first launch):
- "Helpful Assistant" - General-purpose helpful AI
- "Code Expert" - Programming and technical assistance
- "Writing Assistant" - Writing, editing, and content creation

---

## 2. TypeScript Types

```typescript
// renderer/src/types/index.ts (additions)

export interface UserSettings {
  id: string;
  defaultModelId: string | null;
  defaultSystemPromptId: string | null;
  enabledModels: string[]; // Parsed from JSON
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsUpdate {
  defaultModelId?: string;
  defaultSystemPromptId?: string | null;
  enabledModels?: string[];
}

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemPromptCreate {
  name: string;
  content: string;
}

export interface SystemPromptUpdate {
  name?: string;
  content?: string;
}
```

---

## 3. API Routes

### Settings API

#### GET `/api/settings`

Fetch current settings. Creates default settings if none exist.

**Response:**
```json
{
  "id": "default",
  "defaultModelId": "gpt-4o",
  "defaultSystemPromptId": "uuid-123",
  "enabledModels": ["gpt-4o", "gpt-4o-mini", "claude-sonnet", ...],
  "createdAt": "2026-01-26T10:00:00.000Z",
  "updatedAt": "2026-01-26T10:00:00.000Z"
}
```

#### PATCH `/api/settings`

Update settings (partial update supported).

**Request Body:**
```json
{
  "defaultModelId": "claude-sonnet",
  "defaultSystemPromptId": "uuid-456",
  "enabledModels": ["gpt-4o", "claude-sonnet"]
}
```

**Response:** Updated settings object.

---

### System Prompts API

#### GET `/api/system-prompts`

List all system prompts.

**Response:**
```json
[
  {
    "id": "uuid-123",
    "name": "Helpful Assistant",
    "content": "You are a helpful, harmless, and honest AI assistant...",
    "createdAt": "2026-01-26T10:00:00.000Z",
    "updatedAt": "2026-01-26T10:00:00.000Z"
  },
  ...
]
```

#### POST `/api/system-prompts`

Create a new system prompt.

**Request Body:**
```json
{
  "name": "Code Expert",
  "content": "You are an expert programmer..."
}
```

**Response:** Created system prompt object (201).

#### GET `/api/system-prompts/[id]`

Get a single system prompt by ID.

**Response:** System prompt object or 404.

#### PATCH `/api/system-prompts/[id]`

Update a system prompt.

**Request Body:**
```json
{
  "name": "Updated Name",
  "content": "Updated content..."
}
```

**Response:** Updated system prompt object.

#### DELETE `/api/system-prompts/[id]`

Delete a system prompt.

**Behavior:**
- If deleted prompt is the default, set `defaultSystemPromptId` to `null` in settings
- Returns 204 No Content

---

## 4. React Hooks

### `useSettings`

```typescript
// renderer/src/hooks/useSettings.ts

interface UseSettingsReturn {
  settings: UserSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: SettingsUpdate) => Promise<void>;
  refreshSettings: () => Promise<void>;
}
```

**Features:**
- Fetches settings on mount
- Caches in state
- Optimistic updates for better UX
- Error handling with rollback

### `useSystemPrompts`

```typescript
// renderer/src/hooks/useSystemPrompts.ts

interface UseSystemPromptsReturn {
  prompts: SystemPrompt[];
  isLoading: boolean;
  error: Error | null;
  createPrompt: (data: SystemPromptCreate) => Promise<SystemPrompt>;
  updatePrompt: (id: string, data: SystemPromptUpdate) => Promise<SystemPrompt>;
  deletePrompt: (id: string) => Promise<void>;
  refreshPrompts: () => Promise<void>;
}
```

**Features:**
- Fetches all prompts on mount
- CRUD operations with optimistic updates
- Auto-refresh list after mutations
- Error handling

---

## 5. UI Components

### Settings Page Structure

```
/settings (or modal overlay)
├── SettingsHeader
│   └── "Settings" title + close button
├── SettingsTabs
│   ├── Tab: "General"
│   ├── Tab: "Models"
│   └── Tab: "System Prompts"
└── SettingsContent
    ├── GeneralSettings (when "General" tab active)
    ├── ModelsSettings (when "Models" tab active)
    └── SystemPromptsSettings (when "System Prompts" tab active)
        ├── PromptsList (left panel)
        │   ├── List of saved prompts
        │   ├── "New Prompt" button
        │   └── Default indicator (star icon)
        └── PromptEditor (right panel)
            ├── Name input
            ├── Content textarea
            ├── "Set as Default" button
            ├── "Save" button
            └── "Delete" button
```

### Component Files

```
renderer/src/components/settings/
├── SettingsModal.tsx           # Modal wrapper with tabs
├── SettingsTabs.tsx            # Tab navigation
├── GeneralSettings.tsx         # Default model + default prompt selector
├── ModelsSettings.tsx          # Enable/disable models
├── SystemPromptsSettings.tsx   # System prompts manager (list + editor)
├── PromptsList.tsx             # List of prompts with selection
├── PromptEditor.tsx            # Edit/create prompt form
└── index.ts                    # Barrel export
```

---

## 6. Tab Specifications

### Tab 1: General Settings

**Purpose:** Configure defaults for new conversations.

**UI Elements:**

#### Default Model
- Label: "Default Model"
- Dropdown selector with all available models
- Shows provider icon/name next to each model
- Disabled models (no API key) shown but not selectable
- Help text: "This model will be selected by default for new conversations"

#### Default System Prompt
- Label: "Default System Prompt"
- Dropdown selector with all saved prompts + "None" option
- Shows prompt name and truncated preview
- Link to "Manage prompts →" (navigates to System Prompts tab)
- Help text: "This prompt will be included at the start of every new conversation"

**Behavior:**
- On change: Update settings via API
- Changes auto-save (no explicit save button needed)
- Show brief success indicator

---

### Tab 2: Models Settings

**Purpose:** Enable/disable specific models from appearing in the model selector.

**UI Elements:**
- Section header: "Available Models"
- List of all models grouped by provider:
  ```
  OpenAI
  ├── [✓] GPT-4o
  ├── [✓] GPT-4o Mini
  ├── [ ] o1
  ├── [ ] o1-mini
  └── [✓] o3-mini

  Anthropic
  ├── [✓] Claude 3.5 Sonnet
  └── [ ] Claude 3.5 Haiku

  Google
  └── [✓] Gemini 2.0 Flash
  ```
- Toggle switch for each model
- Provider status indicator (configured/not configured based on API key)
- "Enable All" / "Disable All" buttons per provider

**Behavior:**
- Disabled providers shown grayed out with "(No API Key)" label
- Cannot enable models for unconfigured providers
- At least one model must remain enabled (validation)
- Changes saved on toggle (auto-save)

---

### Tab 3: System Prompts Manager

**Purpose:** Create, edit, and manage a library of system prompts. Select one as the default for new conversations.

**Layout:** Split view with list on left, editor on right.

#### Left Panel: Prompts List

**UI Elements:**
- Section header: "System Prompts"
- "+ New Prompt" button
- Scrollable list of prompts showing:
  - Prompt name
  - Star icon if set as default
  - Truncated preview of content (first ~50 chars)
- Selected item highlighted
- Empty state: "No prompts yet. Create your first prompt."

**Behavior:**
- Click prompt to select and load in editor
- Default prompt shown with star indicator
- List sorted by name alphabetically

#### Right Panel: Prompt Editor

**UI Elements:**
- Name input field (required)
- Content textarea (min-height: 250px)
- Character count: "X / 10,000"
- Action buttons:
  - "Set as Default" (toggle, shows current state)
  - "Save" (primary button)
  - "Delete" (danger button, with confirmation)
- Help text: "The default prompt will be included at the start of every new conversation"

**Behavior:**
- Creating new: Empty form, "Save" creates new prompt
- Editing existing: Form populated, "Save" updates
- "Set as Default" updates settings.defaultSystemPromptId
- Delete shows confirmation dialog
- Deleting the default prompt clears defaultSystemPromptId
- Unsaved changes warning if navigating away
- Max content length: 10,000 characters

#### Seed Prompts (created on first launch)

| Name | Content Preview |
|------|-----------------|
| Helpful Assistant | "You are a helpful, harmless, and honest AI assistant..." |
| Code Expert | "You are an expert programmer. Help with code, debugging..." |
| Writing Assistant | "You are a skilled writer and editor. Help improve..." |

---

## 7. Integration Points

### Main Page Integration

Update `renderer/src/app/page.tsx`:
- Add settings icon/button in header
- Open settings modal on click
- Pass `defaultModelId` from settings to `ModelSelector`
- Pass `defaultSystemPromptId` to chat context

### Chat API Integration

Update `renderer/src/app/api/chat/route.ts`:
- Fetch settings on each request
- If `defaultSystemPromptId` is set:
  - Fetch the system prompt content from `system_prompts` table
  - Prepend as system message to the messages array
- Only allow models from `enabledModels` list

### Model Selector Integration

Update `renderer/src/components/chat/ModelSelector.tsx`:
- Filter models by `enabledModels` from settings
- Use `defaultModelId` as initial selection for new conversations

### System Prompt Resolution

When starting a chat:
1. Check `settings.defaultSystemPromptId`
2. If set, fetch prompt content from `system_prompts` table
3. Prepend `{ role: "system", content: promptContent }` to messages
4. If prompt was deleted (ID not found), proceed without system prompt

---

## 8. File Changes Summary

### New Files
```
renderer/src/components/settings/SettingsModal.tsx
renderer/src/components/settings/SettingsTabs.tsx
renderer/src/components/settings/GeneralSettings.tsx
renderer/src/components/settings/ModelsSettings.tsx
renderer/src/components/settings/SystemPromptsSettings.tsx
renderer/src/components/settings/PromptsList.tsx
renderer/src/components/settings/PromptEditor.tsx
renderer/src/components/settings/index.ts
renderer/src/hooks/useSettings.ts
renderer/src/hooks/useSystemPrompts.ts
renderer/src/app/api/settings/route.ts
renderer/src/app/api/system-prompts/route.ts
renderer/src/app/api/system-prompts/[id]/route.ts
```

### Modified Files
```
renderer/src/lib/db/schema.ts          # Add settings + system_prompts tables
renderer/src/types/index.ts            # Add settings + system prompt types
renderer/src/app/page.tsx              # Add settings button + modal
renderer/src/app/api/chat/route.ts     # Integrate system prompt lookup
renderer/src/components/chat/ModelSelector.tsx  # Filter by enabled models
renderer/src/lib/ai/models.ts          # Export helper functions
```

---

## 9. UI/UX Design Notes

### Styling (matching existing cyberpunk aesthetic)
- Modal: Dark background (`bg-background`), border (`border-border`)
- Tabs: Monospace font, uppercase, active state with accent color
- Inputs: Dark inputs with border, focus ring
- Toggles: Custom toggle switches matching theme
- Labels: `label` or `label-sm` class, muted text color

### Accessibility
- Keyboard navigation for tabs
- Focus management in modal
- ARIA labels for toggles and inputs
- Escape key closes modal

### Responsive
- Modal: max-width 600px, centered
- Scrollable content area if needed
- Mobile-friendly touch targets

---

## 10. Future Enhancements (Out of Scope)

- API key management in-app (currently env vars only)
- Multiple user profiles
- Import/export settings
- Per-conversation model/prompt overrides
- Custom model additions
- Temperature/max tokens settings

---

## 11. Implementation Order

1. **Phase 1: Database & API - Settings**
   - Add `settings` table to schema
   - Add `system_prompts` table to schema
   - Run `npm run db:push`
   - Create GET/PATCH `/api/settings` routes
   - Create CRUD `/api/system-prompts` routes
   - Add TypeScript types
   - Seed default system prompts on first launch

2. **Phase 2: Hooks & State**
   - Create `useSettings` hook
   - Create `useSystemPrompts` hook
   - Test API integration for both

3. **Phase 3: UI Components**
   - Create settings modal structure
   - Implement tabs navigation
   - Build GeneralSettings tab (default model selector)
   - Build ModelsSettings tab (enable/disable models)
   - Build SystemPromptsSettings tab:
     - PromptsList component
     - PromptEditor component
     - Wire up CRUD operations

4. **Phase 4: Integration**
   - Add settings button to main page header
   - Integrate with ModelSelector (filter + default)
   - Integrate system prompt with chat API
   - Apply enabled models filter globally

5. **Phase 5: Polish**
   - Add loading states and skeletons
   - Add error handling and toasts
   - Unsaved changes warning in editor
   - Delete confirmation dialog
   - Test edge cases (deleted default, empty states)
