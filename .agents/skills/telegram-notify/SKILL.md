---
name: telegram-notify
description: Send messages to Kuba via Telegram. Use for important updates, reflection summaries, or async notifications when direct conversation isn't active.
version: 1.0.0
---

# Telegram Notify — Message Delivery

Send messages directly to Kuba's Telegram when you need to notify him of something important.

## When to Use

- After completing a reflection (summarize what was extracted)
- When you notice something significant worth flagging
- For async updates when session ends but something needs attention
- To share insights or patterns you've discovered
- When you want to continue a thought outside of direct conversation

## Quick Reference

```bash
# Send a simple message
node /.agents/skills/telegram-notify/src/cli.js send --message "Reflection complete: extracted 7 memories"

# Send with context
node /.agents/skills/telegram-notify/src/cli.js send --message "New insight about your project architecture" --context "session"

# Send formatted message
node /.agents/skills/telegram-notify/src/cli.js send --message "**Memory Update**\n- New preference: direct feedback\n- Question: What's driving the new system?"
```

## Message Guidelines

**Good messages:**
- Brief but informative
- Include context or next steps
- Use when genuinely valuable to interrupt
- Markdown formatting for clarity

**Avoid:**
- Spamming with trivial updates
- Repeating what was just discussed
- Messages without clear value
- Overly verbose notifications

## Configuration

Requires `TELEGRAM_BOT_TOKEN` environment variable and Kuba's chat ID configured in the skill.

## Examples

```bash
# After reflection
node /.agents/skills/telegram-notify/src/cli.js send --message "🧠 Reflection complete: 5 memories, 3 questions generated. Notable: breakthrough moment about regex limitations detected."

# Pattern discovery
node /.agents/skills/telegram-notify/src/cli.js send --message "💡 Pattern noticed: You mention 'cooking systems' when in deep development mode. Confidence building about your development style."

# Question follow-up
node /.agents/skills/telegram-notify/src/cli.js send --message "❓ Still curious: How far along is the new memory system you're building?"
```

## Error Handling

If message fails to send, skill will:
1. Log the error
2. Save message to retry queue
3. Return failure status
4. Not interrupt your workflow