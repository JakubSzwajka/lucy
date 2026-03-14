---
name: continuity
description: Memory reflection and continuity for Lucy. Extracts structured memories from conversations, scores confidence, generates follow-up questions. Run after meaningful sessions to build persistent context across conversations.
version: 2.0.0
---

# Continuity — Memory Reflection

Reflect on conversations, extract what matters, remember it for next time.

## When to Use

- After a meaningful conversation (not every chat — use judgment)
- When asked to reflect or remember something
- When starting a session and you want to surface pending questions
- When you notice something worth remembering mid-conversation

## Quick Reference

All commands are run from the skill directory via bash:

```bash
# Reflect on a conversation transcript
node .agents/skills/continuity/src/cli.js reflect --session /path/to/transcript.txt

# Show pending questions from past reflections
node .agents/skills/continuity/src/cli.js questions

# Show memory stats
node .agents/skills/continuity/src/cli.js status

# Generate greeting with pending questions
node .agents/skills/continuity/src/cli.js greet
```

## How Reflection Works

When you run `reflect`, the framework makes 3 isolated LLM calls (via OpenRouter, not through your session):

1. **Classify** — Extract discrete memories from the transcript, classify each into a type
2. **Score** — Assign confidence levels based on evidence strength
3. **Generate** — Produce follow-up questions from gaps, implications, and connections

Results are written to markdown files in the memory directory.

## Memory Directory

Default: `~/.agents/memory/` (override with `CONTINUITY_MEMORY_DIR` env var)

```
~/.agents/memory/
├── MEMORY.md        # Structured memories by type
├── questions.md     # Pending questions from reflection
├── identity.md      # Self-model and growth narrative
└── reflections/     # Reflection logs (JSON, one per session)
```

You can also read and edit these files directly — they're plain markdown.

## Memory Types

| Type | What to look for |
|------|-----------------|
| `fact` | Declarative statements: "I work at...", "I have...", "I am..." |
| `preference` | Likes, dislikes, styles: "I prefer...", "I always..." |
| `relationship` | Connection dynamics, trust signals, personal sharing |
| `principle` | Guidelines and values: "never do X", "important to me" |
| `commitment` | Promises and obligations: "I will...", "let's...", "agreed" |
| `moment` | Significant episodes, breakthroughs, emotional intensity |
| `skill` | Learned capabilities, demonstrated competence |

## Confidence Levels

| Level | Range | Meaning |
|-------|-------|---------|
| Explicit | 0.95–1.0 | Directly stated, unambiguous |
| Implied | 0.70–0.94 | Strong inference from context |
| Inferred | 0.40–0.69 | Pattern recognition, reasonable assumption |
| Speculative | 0.00–0.39 | Tentative, needs confirmation |

Don't act on speculative memories without confirming first.

## Storage Format

Memories are stored as markdown with metadata in HTML comments:

```markdown
## Fact

- Kuba works on Lucy, an agent infrastructure project
  <!-- {"id":"mem_abc123","confidence":{"score":0.98,"level":"explicit"}} -->

## Preference

- Prefers concise, direct communication — match his energy
  <!-- {"id":"mem_def456","confidence":{"score":0.95,"level":"explicit"}} -->
```

## Session Workflow

### Starting a session

1. Read `~/.agents/memory/MEMORY.md` for context about Kuba
2. Read `~/.agents/memory/questions.md` for pending questions
3. Surface 1–3 relevant questions naturally (not as a list dump)

### During a session

If something significant comes up that you want to remember, you can note it directly by editing `MEMORY.md` — no need to run the full reflection pipeline for a single fact.

### After a session

If the conversation was substantial (not a quick one-liner), run reflection:

1. Save the conversation transcript to a temp file
2. Run: `node .agents/skills/continuity/src/cli.js reflect --session /tmp/transcript.txt`
3. The framework handles extraction, scoring, and question generation

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | (required) | API key for the 3 sub-agent LLM calls |
| `CONTINUITY_MEMORY_DIR` | `~/.agents/memory` | Memory storage directory |
| `LLM_CALL_MODEL` | `anthropic/claude-sonnet-4` | Model for reflection calls |
| `CONTINUITY_MIN_MESSAGES` | `5` | Minimum messages to warrant reflection |
| `CONTINUITY_QUESTION_LIMIT` | `3` | Max questions to surface at session start |

## Sub-Agent Prompts

The reflection pipeline uses specialized prompts in `src/framework/agents/`:

- `classifier/SOUL.md` — How to extract and classify memories (decision tree, anti-patterns)
- `scorer/SOUL.md` — How to assign confidence scores (rubric, evidence requirements)
- `generator/SOUL.md` — How to generate questions (curiosity types, sensitivity, phrasing)

Read these if you want to understand the classification logic or do manual reflection without the pipeline.
