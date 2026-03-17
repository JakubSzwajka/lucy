# Anamnesis — Agent Notebook

> Shared scratchpad for agents working on this PRD. Read before starting any task. Append findings.

## Critical Context

### The init() bug (Task 1)
- `.pi/extensions/continuity/index.ts` line 16 creates `new ContinuitySkill()` but never calls `init()`
- `init()` calls `framework.init()` which calls `orchestrator.init()` (loads prompt files) and `store.init()` (creates directories)
- Without init, every `reflect()` call throws immediately
- **The entire memory system has never executed in production**

### Path migration (Task 2)
- Current constants: `MEMORY_PATH = ".agents/memory/MEMORY.md"`, `QUESTIONS_PATH = ".agents/memory/questions.md"`
- New paths: `.agents/anamnesis/memory/MEMORY.md`, `.agents/anamnesis/memory/questions.md`
- `MemoryStore` default `basePath` in `memory-store.js` line 16: `join(process.env.HOME || '~', 'clawd', 'memory')` — this is wrong for Lucy, needs to be project-relative
- `ContinuitySkill` default `memoryDir` in `src/index.js` line 18: same issue

### LLM calls go through OpenRouter
- `llm-call.js` calls OpenRouter directly with `OPENROUTER_API_KEY`
- Model: `anthropic/claude-sonnet-4` (default), overridable via `LLM_CALL_MODEL` env var
- Each call: ~2-4K input tokens, ~1-2K output tokens
- Cost per reflection (3 calls): ~$0.06-0.12

### Pi SDK hook interface
- `before_agent_start` receives `event` with `event.systemPrompt`, returns `{ systemPrompt: string }`
- `session_before_compact` receives `event` with `event.preparation` containing `messagesToSummarize`, `firstKeptEntryId`, `tokensBefore`
- These are the ONLY two hooks. No timer, no idle, no background processing.
- `serializeConversation(convertToLlm(messages))` converts Pi messages to plain text

### The reflect() call in compaction hook
- Line 68: `skill.reflect({ session: "custom", summary: conversationText })`
- `session: "custom"` hits the `options.session` branch in `src/index.js` line 78
- This calls `this.storage.readFile("custom")` which tries to read a file named "custom" — **this is wrong**
- Should be using `options.content` or `options.summary` instead
- There's actually a bug here beyond init — the `summary` key doesn't match any of the `reflect()` option branches (session/sessionId/content)
- **Fix in Task 1: pass `{ content: conversationText }` instead of `{ session: "custom", summary: conversationText }`**

---

## Wave 4: Entity Architecture Cleanup

### Three-system model (Tasks 24-30)
The entity is composed of three systems: **experience** (anamnesis), **knowledge** (understanding graph), **skills** (executable capabilities). These were mixed in `.agents/skills/`. Wave 4 separates them.

### Key moves:
- `.agents/anamnesis/` → `.agents/experience/` (same content, clearer name)
- `.agents/skills/knowledge/*.md` → `.agents/knowledge/` (these are understanding, not skills)
- `.agents/skills/kuba/SKILL.md` → `.agents/knowledge/kuba.md` (person knowledge, not a skill)
- `.pi/extensions/continuity/` absorbed into `.pi/extensions/anamnesis/` (already happening in practice — continuity imports from anamnesis everywhere)
- `PROMPT.md` updated to describe three systems, not the old mixed "skills and knowledge" section

### The continuity → anamnesis merge (Task 25)
The continuity extension already imports 9 modules from `../anamnesis/`. The ContinuitySkill class, orchestrator, sub-agent prompts, schemas, llm-call, and memory-store all live in `.pi/extensions/continuity/src/`. Move that entire `src/` tree into `.pi/extensions/anamnesis/src/`. The main `index.ts` from continuity becomes `.pi/extensions/anamnesis/index.ts`. Delete `.pi/extensions/continuity/`.

### Knowledge classification rule
- **Can I execute it?** → stays in skills/
- **Does it help me understand the world?** → moves to knowledge/
- **Is it a person, project, process, or concept?** → knowledge

Current classification:
| Item | Currently | Should be | Action |
|------|-----------|-----------|--------|
| telegram-notify/ | skills/ | skills/ | Stay |
| browse/ | skills/ | skills/ | Stay |
| kuba/SKILL.md | skills/ | knowledge/kuba.md | Move + rename |
| knowledge/lucy.md | skills/knowledge/ | knowledge/lucy.md | Move up |
| knowledge/kuba-personal.md | skills/knowledge/ | knowledge/kuba-personal.md | Move up |
| knowledge/kuba-ai-workflow.md | skills/knowledge/ | knowledge/kuba-ai-workflow.md | Move up |
| knowledge/ralph.md | skills/knowledge/ | knowledge/ralph.md | Move up |
| knowledge/mydancedna.md | skills/knowledge/ | knowledge/mydancedna.md | Move up |

### Wikilink resolution after move
PROMPT.md currently says: 1. `.agents/skills/name/SKILL.md`, 2. `.agents/skills/knowledge/name.md`
After: 1. `.agents/skills/name/SKILL.md`, 2. `.agents/knowledge/name.md`
