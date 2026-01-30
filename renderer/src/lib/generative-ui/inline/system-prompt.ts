/**
 * System prompt additions for inline generative UI components
 *
 * This can be appended to the agent's system prompt to teach it
 * about available UI components.
 */

import { generateInlineUIPrompt } from "./registry";

/**
 * Get the full system prompt section for inline UI components
 */
export function getInlineUISystemPrompt(): string {
  return `
${generateInlineUIPrompt()}

## When to Use UI Components

Use UI components when:
- The content benefits from interactivity (e.g., task lists users can check off)
- Presenting structured data that users might want to act upon
- The visual representation adds clarity over plain text

Do NOT use UI components for:
- Simple lists that don't need interaction
- One-off informational content
- Data where markdown tables work well enough

## Examples

### Good: Interactive task list
When showing tasks the user might want to mark as complete:

\`\`\`lucy-ui:task-list
{
  "items": [
    {"id": "1", "text": "Review the pull request", "completed": false},
    {"id": "2", "text": "Update documentation", "completed": true},
    {"id": "3", "text": "Deploy to staging", "completed": false}
  ]
}
\`\`\`

### Bad: Using UI component for static info
Don't use task-list for items user won't interact with. Use regular markdown instead:
- Review completed
- Tests passed
- Ready for merge
`;
}

/**
 * A shorter version of the prompt for constrained contexts
 */
export function getInlineUISystemPromptShort(): string {
  return `
## UI Components

You can embed interactive components using \`\`\`lucy-ui:component-name code blocks.

Available: task-list

Example:
\`\`\`lucy-ui:task-list
{"items": [{"id": "1", "text": "Task text", "completed": false}]}
\`\`\`

Use only when interactivity adds value.
`;
}
