---
status: draft
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Model Selection & Reasoning Support

## Problem

Users have no way to choose which AI model powers their conversation. The runtime defaults to `anthropic/claude-sonnet-4.6` and there's no UI to change it. Additionally, some models support extended thinking/reasoning, and while the runtime already captures reasoning items, they are silently discarded in the UI (`MessageList` returns `null` for reasoning items). Users can't see *how* the model thinks, and can't pick a reasoning-capable model to begin with.

## Proposed Solution

Add a predefined model registry to the frontend with minimal config per model (`supportsReasoning`, `maxContextTokens`). Expose a model selector in the chat UI — a simple select/dropdown. Pass the selected `modelId` through the gateway to the runtime (plumbing already exists: gateway accepts `modelId`, runtime resolves it). For reasoning, render reasoning items as collapsible blocks above the assistant message in the chat UI. The runtime already persists reasoning — this is primarily a frontend feature with minor gateway/runtime adjustments.

## Key Cases

- User sees the current/default model displayed in the chat UI
- User switches models via a dropdown before sending a message
- Selected model is sent with the chat request and used by the runtime
- If the selected model supports reasoning, reasoning items are captured (already works)
- Reasoning blocks render as collapsible sections above the assistant message
- Reasoning blocks are collapsed by default, expandable on click
- Model selection persists via localStorage across page reloads

## Out of Scope

- Dynamic model list from OpenRouter API (using predefined list for now)
- Per-session or per-agent model persistence on the backend
- Reasoning effort level configuration (hardcoded to "medium" in runtime)
- Streaming reasoning display (live thinking animation)
- Model cost/pricing display
- Model search or filtering UI

## Open Questions

- None at this time.

## References

- Runtime model resolution: `agents-runtime/src/runtime/context.ts`
- Model provider: `agents-runtime/src/adapters/openrouter-model-provider.ts`
- Gateway chat route: `agents-gateway-http/src/routes/chat.ts`
- WebUI chat panel: `agents-webui/src/components/ChatPanel.tsx`
- WebUI message list: `agents-webui/src/components/MessageList.tsx`
- Reasoning item type: `agents-runtime/src/types/domain.ts` (ReasoningItem)
