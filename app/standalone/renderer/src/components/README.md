# Components

This directory contains all React UI components for the Lucy desktop application. Components are organized by feature domain rather than by technical type, making it easy to locate and maintain related functionality.

## Purpose

The components layer is responsible for:

- Rendering the user interface
- Handling user interactions
- Composing smaller pieces into larger features
- Connecting to hooks and utilities for state and logic

All components follow a consistent pattern: they receive data via props and emit events through callbacks. Business logic lives in hooks (`/hooks`) or utilities (`/lib`), keeping components focused on presentation.

## Organization

```
components/
├── auth-guard.tsx   # Authentication route guard
├── providers.tsx    # Root-level context providers (AuthProvider)
├── ai-elements/     # AI-specific UI primitives (messages, tools, reasoning)
├── chat/            # Chat feature components
├── plan/            # Plan display components
├── settings/        # Settings page components
├── sidebar/         # Navigation sidebar
└── ui/              # Generic UI primitives (shadcn/ui)
```

## Root Components

| Component | Description |
|-----------|-------------|
| `AuthGuard` | Wraps protected routes. Checks auth state via `useAuth()`, redirects to `/login` if not authenticated. Shows loading state during token verification. |
| `Providers` | Client-side wrapper component in root layout. Provides `AuthProvider` context to the entire component tree. |

## Key Directories

### `ai-elements/`

Specialized components for displaying AI-related content. These are the building blocks for rendering conversations with AI models.

**Message Components:**
- `Message`, `MessageContent`, `MessageResponse` - Message display and markdown rendering
- `MessageBranch`, `MessageBranchSelector` - Message branching/versioning UI
- `MessageActions`, `MessageToolbar` - Action buttons for messages

**Tool Components:**
- `Tool`, `ToolHeader`, `ToolContent` - Collapsible tool call display
- `ToolInput`, `ToolOutput` - Tool parameters and results

**Reasoning Components:**
- `Reasoning`, `ReasoningTrigger`, `ReasoningContent` - Expandable thinking/reasoning blocks
- Auto-closes after streaming completes

**Other:**
- `CodeBlock` - Syntax-highlighted code with Shiki
- `Conversation`, `ConversationContent` - Scrollable conversation container
- `PromptInput` - Multi-part input component with tools footer
- `ModelSelector` - AI model selection dropdown
- `Shimmer` - Loading animation for streaming content

### `chat/`

The main chat interface composed from ai-elements and UI primitives.

| Component | Description |
|-----------|-------------|
| `ChatContainer` | Orchestrates the full chat view: header, messages, plan, and input |
| `MessageList` | Renders the conversation with proper message types (user, assistant, tools) |
| `ChatInput` | Input area with model selector, thinking toggle, MCP servers, and tools popover |

### `plan/`

Components for displaying execution plans that the AI creates.

| Component | Description |
|-----------|-------------|
| `PlanPanel` | Collapsible panel showing plan title, status, progress bar, and steps |

Plans appear above the chat input when active, showing the AI's structured approach to completing tasks.

### `settings/`

All settings-related components for the `/settings` page.

| Component | Description |
|-----------|-------------|
| `GeneralSettings` | Default model and system prompt selection |
| `ModelsSettings` | Enable/disable available AI models |
| `SystemPromptsSettings` | System prompt management |
| `PromptsList` | List of saved prompts with actions |
| `PromptEditor` | Create/edit system prompts |
| `McpServersSettings` | MCP server configuration |
| `McpServerForm` | Add/edit MCP server details |
| `TagCategoryEditor` | Tag category management |

### `sidebar/`

Navigation sidebar shown on all pages.

| Component | Description |
|-----------|-------------|
| `Sidebar` | Main sidebar with logo, new chat button, sessions list, settings link |
| `SessionItem` | Individual session entry with title, preview, and delete action |

The sidebar supports collapsed and expanded states with smooth transitions.

### `ui/`

Generic UI primitives from [shadcn/ui](https://ui.shadcn.com/). These are unstyled, accessible components built on Radix UI.

**Form Controls:**
- `Button`, `Input`, `Textarea`, `Select`, `Switch`

**Layout:**
- `Card`, `Separator`, `ScrollArea`, `Tabs`

**Overlays:**
- `Dialog`, `Popover`, `DropdownMenu`, `HoverCard`, `Tooltip`

**Feedback:**
- `Alert`, `Badge`, `Progress`

**Other:**
- `Accordion`, `Collapsible`, `Avatar`, `Carousel`, `Command`

These primitives are styled with Tailwind CSS and can be customized via the `cn()` utility.

## Component Patterns

### Client vs Server Components

Most components in this directory are **client components** (marked with `"use client"`). This is because they:

- Handle user interactions (clicks, form inputs)
- Use React hooks (useState, useEffect)
- Access browser APIs

Server components are used at the page level (`/app`) for initial data fetching.

### Composition Pattern

Components follow a compound component pattern for flexibility:

```tsx
// Instead of a monolithic component with many props:
<Message from="assistant">
  <MessageContent>
    <Reasoning isStreaming={true}>
      <ReasoningTrigger />
      <ReasoningContent>{thinking}</ReasoningContent>
    </Reasoning>
    <MessageResponse>{content}</MessageResponse>
  </MessageContent>
</Message>
```

This allows mixing and matching pieces without prop drilling.

### Context for State Sharing

Related components share state via React Context:

```tsx
// Reasoning components share streaming/open state
<Reasoning isStreaming={true}>
  <ReasoningTrigger />      {/* Accesses context for duration display */}
  <ReasoningContent>...</ReasoningContent>
</Reasoning>
```

### Props Interface Convention

Each component exports its props type for external use:

```tsx
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  // ...
);
```

### Barrel Exports

Each directory has an `index.ts` that re-exports public components:

```tsx
// ai-elements/index.ts
export { Message, MessageContent, MessageResponse } from "./message";
export type { MessageProps, MessageContentProps } from "./message";
```

Import from the directory, not individual files:

```tsx
// Good
import { Message, Tool, Reasoning } from "@/components/ai-elements";

// Avoid
import { Message } from "@/components/ai-elements/message";
```

## UI Primitives (shadcn/ui)

The `ui/` directory contains primitives from shadcn/ui. These are:

- **Copied, not imported** - Source code lives in the project, not node_modules
- **Customizable** - Modify directly to fit project needs
- **Accessible** - Built on Radix UI with proper ARIA attributes
- **Unstyled by default** - Styled with Tailwind CSS classes

To add a new primitive:

```bash
npx shadcn@latest add [component-name]
```

See [shadcn/ui docs](https://ui.shadcn.com/docs/components) for available components.

## Adding Components

### New Feature Component

1. Create a directory under `components/` if the feature warrants it, or add to an existing feature directory
2. Create the component file with `"use client"` directive if needed
3. Export from an `index.ts` barrel file
4. Import using the `@/components/` alias

### New AI Element

1. Add to `components/ai-elements/`
2. Follow the compound component pattern
3. Export component and types from `index.ts`
4. Consider whether it needs streaming state handling

### New UI Primitive

1. Use `npx shadcn@latest add [name]` to scaffold in `components/ui/`
2. Customize styling as needed
3. The component is automatically available via `@/components/ui/[name]`

## Styling

Components use Tailwind CSS with:

- **`cn()` utility** - Merges class names with proper precedence
- **CSS variables** - Colors defined in `globals.css` (e.g., `bg-background`, `text-foreground`)
- **Dark mode** - Automatic via `dark:` variant and system preference

Example:

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "flex items-center gap-2",
  isActive && "bg-primary text-primary-foreground",
  className
)} />
```
