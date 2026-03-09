---
prd: model-selection-reasoning
generated: 2026-03-08
last-updated: 2026-03-08
---

# Tasks: Model Selection & Reasoning Support

> Summary: Add a predefined model registry to the webui, expose a model selector dropdown, pass selection through gateway to runtime, and render reasoning items as collapsible blocks above assistant messages.

## Task List

- [x] **1. Add predefined model registry to webui** — define model list with supportsReasoning and maxContextTokens
- [x] **2. Add ModelSelector component** — dropdown in chat UI to pick a model
- [x] **3. Wire model selection through to sendMessage** — pass modelId from selector to API client
- [x] **4. Persist model selection in localStorage** — remember chosen model across reloads
- [x] **5. Render reasoning items in MessageList** — collapsible blocks above assistant messages `[blocked by: 6]`
- [x] **6. Add ReasoningBlock component** — collapsible reasoning display with summary/expand

---

### 1. Add predefined model registry to webui
<!-- status: done -->

Create a `models.ts` file in `agents-webui/src/` that exports a typed array of predefined models. Each entry needs: `id` (OpenRouter format like `anthropic/claude-sonnet-4-5`), `label` (display name), `supportsReasoning`, and `maxContextTokens`. Include latest Anthropic models (Sonnet 4.5, Opus 4) and OpenAI models (GPT-4o, o3-mini). Export a `DEFAULT_MODEL_ID` constant.

**Files:** `agents-webui/src/models.ts` (new)
**Depends on:** —
**Validates:** File exports typed model array and default, imports cleanly in other components.

---

### 2. Add ModelSelector component
<!-- status: done -->

Create a simple select/dropdown component that renders the predefined model list. Show the model label in each option. The component takes `value` (current modelId) and `onChange` callback as props. Place it in the ChatPanel header area or above the ChatInput. Style with existing Tailwind classes to match the UI (border-border, bg-background, font-mono for the model names).

**Files:** `agents-webui/src/components/ModelSelector.tsx` (new), `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 1
**Validates:** Dropdown renders in chat UI, shows all predefined models, fires onChange with modelId.

---

### 3. Wire model selection through to sendMessage
<!-- status: done -->

Add `selectedModelId` state to ChatPanel. Pass it to `sendMessage(message, selectedModelId)` in `handleSend()` (line 42 currently calls `sendMessage(message)` without modelId). The API client already accepts `modelId` as second param and the gateway already forwards it to runtime — no backend changes needed.

**Files:** `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 2
**Validates:** Network request to POST /chat includes `modelId` field. Runtime uses the selected model (visible in runtime logs or response behavior).

---

### 4. Persist model selection in localStorage
<!-- status: done -->

Initialize `selectedModelId` state from `localStorage.getItem("lucy-model-id")` falling back to `DEFAULT_MODEL_ID`. On change, write to localStorage. Simple `useEffect` or inline handler — no need for a custom hook.

**Files:** `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 3
**Validates:** Select a model, reload page, model selection is preserved.

---

### 5. Render reasoning items in MessageList
<!-- status: done -->

Update MessageList to render reasoning items instead of returning `null`. Reasoning items should appear above the next assistant message (they share the same `agentId` and come before the message in sequence order). Render them using the ReasoningBlock component. Group reasoning + assistant message visually — the reasoning block sits directly above with no gap.

**Files:** `agents-webui/src/components/MessageList.tsx`
**Depends on:** 6
**Validates:** When a reasoning-capable model responds, reasoning appears as a collapsible block above the assistant message.

---

### 6. Add ReasoningBlock component
<!-- status: done -->

Create a collapsible component for reasoning display. Use existing Radix `Collapsible` wrapper from `components/ui/collapsible`. Collapsed state shows a subtle trigger like "Reasoning" with a chevron icon (similar to ToolCallBlock pattern at `ToolCallBlock.tsx:27-34`). Expanded state shows `reasoningContent` in a `font-mono text-sm` pre-wrap block. Default to collapsed. Style muted to not dominate the conversation — use `text-muted-foreground` and subtle border.

**Files:** `agents-webui/src/components/ReasoningBlock.tsx` (new)
**Depends on:** —
**Validates:** Component renders with sample reasoning data, collapses/expands on click.
