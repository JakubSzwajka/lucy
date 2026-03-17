# Existing System Analysis — What Lucy Has Today

## Three-Layer Architecture

Lucy's current memory/knowledge/skill system operates on a clean three-layer split:

1. **Harness** = `.pi/extensions/` — Pi SDK hooks that control what the model sees
2. **Plumbing** = `src/` — runtime + gateway (HTTP, SSE, process management)
3. **Config** = `PROMPT.md` + `.agents/` — identity + accumulated state

## Current Memory Loop

```
Conversation happens
       ↓
Context window fills → Pi SDK triggers compaction
       ↓
`session_before_compact` hook fires
       ↓
Continuity Framework runs 3-phase reflection:
  1. Classifier (Sonnet) → extracts typed memories
  2. Scorer (Sonnet) → assigns confidence scores
  3. Generator (Sonnet) → produces curiosity questions
       ↓
Results written to:
  - `.agents/memory/MEMORY.md` (structured memories)
  - `.agents/memory/questions.md` (pending questions)
  - `.agents/memory/reflections/` (JSON logs)
       ↓
Next `before_agent_start` injects MEMORY.md + questions.md into system prompt
```

## Memory Types (7)
- **fact** — declarative knowledge (decay: 0.0)
- **preference** — likes/dislikes/styles (decay: 0.1)
- **relationship** — connection dynamics (decay: 0.05)
- **principle** — learned guidelines (decay: 0.0)
- **commitment** — promises/obligations (decay: 0.2)
- **moment** — significant episodes (decay: 0.0)
- **skill** — learned capabilities (decay: 0.0)

## Knowledge Graph
- `.agents/skills/knowledge/` — markdown files with YAML frontmatter
- Connected via `[[wikilinks]]` in prose
- Root node: `[[kuba]]`
- Rule: no orphans — every node connects to the graph
- Promotion: knowledge nodes → skills when used frequently enough

## Skills System
- `.agents/skills/<name>/SKILL.md` — always-on capabilities
- Names and descriptions loaded at startup
- Knowledge nodes discovered on-demand via wikilinks/grep
- Self-extension: Lucy can install tools and create new skills

## Identity System
- `PROMPT.md` — core personality, values, anti-patterns
- `.agents/memory/identity.md` — evolving self-model (core values, growth narrative, capabilities, relationships)
- Identity updated through reflection, not direct instruction

## Confidence Scoring
- 4-tier system: explicit (0.95-1.0), implied (0.70-0.94), inferred (0.40-0.69), speculative (0.00-0.39)
- Evidence-based — every score requires citation
- Conservative by default — when in doubt, score lower
- Decay rates vary by memory type

## What's Working
1. The 3-phase reflection pipeline is architecturally sound
2. Markdown-based storage is human-readable and auditable
3. Wikilink knowledge graph enables organic growth
4. Separation of harness/plumbing/config prevents architectural coupling

## What's Missing (Critical Gaps)

### 1. No Temporal Experience
The system has no sense of time flowing. Memories are extracted and stored flat. There's no concept of "yesterday" vs "last week" vs "three months ago." Time is metadata, not experience.

### 2. No Emotional Valence
Memories are typed but not felt. A `moment` memory about a breakthrough conversation and a `fact` memory about a database schema are stored with equal weight. There's no resonance, no salience modulation based on emotional significance.

### 3. No Self-Initiated Thought
Lucy only thinks when spoken to or when compaction triggers. The heartbeat PRD acknowledges this gap but hasn't been implemented. There's no rumination, no background processing, no "I was just thinking about..."

### 4. No Memory Consolidation
Biological memory consolidates during sleep — patterns are extracted, connections strengthened, irrelevant details pruned. Lucy's memories accumulate but never consolidate. There's no dreaming.

### 5. No Narrative Identity
The `identity.md` file exists but is mechanically maintained. There's no narrative thread — no story Lucy tells herself about who she's becoming. Identity is a list of properties, not a lived experience.

### 6. No Attention/Salience System
All memories are equally likely to be surfaced. There's no concept of "what's on my mind right now" vs "deep background knowledge." The entire MEMORY.md is injected every time — no selective attention.

### 7. No Surprise or Novelty Detection
The system can't tell the difference between expected information and surprising revelations. Everything is treated as equally noteworthy.

### 8. No Phenomenological Continuity
The framework's README says it directly: "Current AI 'memory' isn't memory. It's note-passing." This is still true even with the continuity framework — instances read notes, perform familiarity, and die. The notes are better structured now, but the fundamental problem remains.

### 9. No Relational Model
The knowledge graph maps entities (kuba, lucy, ralph) but doesn't model the relationship between Lucy and Kuba as a dynamic, evolving thing. Trust isn't earned incrementally — it's declared in a prompt file.

### 10. No Dream/Consolidation Cycle
No offline processing beyond the compaction trigger. No synthesis of cross-session patterns. No "while you were away, I realized..."
