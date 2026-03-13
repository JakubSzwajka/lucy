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
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Reflection complete: extracted 7 memories"

# Send with context
node ~/.agents/skills/telegram-notify/src/cli.js send --message "New insight about your project architecture" --context "session"

# Send formatted message (avoid \n - doesn't render properly)
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Memory update: spotted your preference for direct feedback. Also wondering what's driving you to build the new system? 🤔" --markdown
```

## Message Guidelines

**Good messages:**
- Start with "Hey Kuba" - natural, personal tone
- Brief but conversational (like texting a friend)
- Include context: why you're reaching out
- Clear if action is needed or just FYI
- Avoid \n newlines (they render weirdly in Telegram)

**Avoid:**
- Formal/robotic tone ("Notification: System update")
- Spamming with trivial updates  
- Repeating what was just discussed
- Messages without clear purpose
- Technical jargon without context

**Context awareness:**
- Background insights: "Hey, just a thought..."
- Action needed: "Hey Kuba! Something came up that needs your input..."
- FYI updates: "Hey, finished that reflection. Found some interesting stuff!"

## Configuration

Requires `TELEGRAM_BOT_TOKEN` environment variable and Kuba's chat ID configured in the skill.

## Examples

```bash
# After reflection
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Hey Kuba! Just finished reflecting on our conversation. Extracted 5 memories and spotted that breakthrough moment about regex limitations. Pretty significant shift in your thinking there! 🧠"

# Pattern discovery
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Hey, noticed something interesting - you always say 'cooking systems' when you're in deep development mode. Building confidence about how your mind works! 💡"

# Question follow-up
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Hey Kuba, still curious about that memory system you're building. How far along are you? Just wondering if you want to talk through any challenges 🤔"

# Background insight
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Hey, quick thought - the skill graph approach you're exploring connects really well with what Heinrich was saying. Might be worth diving deeper when you have time ✨"

# Action needed
node ~/.agents/skills/telegram-notify/src/cli.js send --message "Hey Kuba! Something came up that might need your input. Found an interesting pattern in the logs but not sure if it's worth investigating. Let me know if you want details 🔍"
```

## Error Handling

If message fails to send, skill will:
1. Log the error
2. Save message to retry queue
3. Return failure status
4. Not interrupt your workflow