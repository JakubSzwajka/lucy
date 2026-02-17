# Memory Reflection System — Internals Report

How the reflection LLM call works end-to-end, with exact prompts and code references.

---

## 1. The Reflection Prompt (Exact Text)

**File:** `backend/src/lib/memory/extraction.service.ts:201-231`

```
You are analyzing a conversation to extract structured memories about the user.

## Existing Memories (do not duplicate these)
[fact] (mem_abc123) Kuba is a software engineer based in Warsaw
[preference] (mem_def456) Prefers TypeScript over JavaScript
...or "No existing memories yet."

## Conversation Transcript
user: I've been thinking about switching to Rust for the backend

assistant: That's interesting! Rust would give you...

user: Yeah, and I've been playing guitar again lately

assistant: ...

## Instructions

Analyze the conversation and output JSON with two arrays: "memories" and "questions".

### Memories
For each piece of memorable information:
- type: fact | preference | relationship | principle | commitment | moment | skill
- content: Clear, concise single statement
- confidenceScore: 0.0-1.0
- confidenceLevel: explicit (0.95-1.0) | implied (0.70-0.94) | inferred (0.40-0.69) | speculative (0.00-0.39)
- evidence: Direct quote from conversation (max 200 chars)
- tags: Array of categorization tags
- existingMemoryId: If this updates/contradicts an existing memory, its ID (to supersede)
- suggestedConnections: Array of { existingMemoryId, relationshipType } for related existing memories. relationshipType must be one of: relates_to, contradicts, refines, supports, context_for

### Questions
For each knowledge gap or follow-up:
- content: Natural question (not clinical)
- context: Why this question emerged from the conversation
- curiosityType: gap | implication | clarification | exploration | connection
- curiosityScore: 0.0-1.0 (how important to ask)
- timing: next_session | when_relevant | low_priority
- sourceMemoryIndices: Which extracted memories (by index) triggered this question
```

---

## 2. Context Passed INTO the Reflection Call

**File:** `backend/src/lib/memory/extraction.service.ts:134-163`

| Input | Source | Details |
|-------|--------|---------|
| **Conversation transcript** | Root agent's items, filtered to `type === "message"` | Only user/assistant messages. Windowed by `fromItemIndex` (items already reflected on are skipped). Tool calls, tool results, and reasoning are **excluded** from the transcript. |
| **Existing memories** | `store.loadMemories(userId, { limit: 100, status: "active" })` | Up to 100 most recent active memories, formatted as `[type] (id) content` |
| **Existing questions** | **Not passed** | The LLM cannot see previously generated questions |
| **Identity document** | **Not passed** | Only used at retrieval time, not during extraction |

The transcript formatter (`formatTranscript`) is simple — messages only:

```typescript
// extraction.service.ts:350-361
private formatTranscript(items: Item[]): string {
  return items
    .filter((item) => item.type === "message" && item.content)
    .map((item) => `${item.role}: ${item.content}`)
    .filter(Boolean)
    .join("\n\n");
}
```

**Key implication:** Tool calls and tool results are counted for the token threshold (triggering reflection) but are NOT included in what the LLM actually sees. A session heavy on tool use will trigger reflection frequently but with sparse transcripts.

---

## 3. Output Schema

**File:** `backend/src/lib/memory/extraction.service.ts:85-115`

Structured JSON via AI SDK's `generateObject` with Zod validation:

```typescript
const extractionSchema = z.object({
  memories: z.array(
    z.object({
      type: z.enum(["fact", "preference", "relationship", "principle", "commitment", "moment", "skill"]),
      content: z.string(),
      confidenceScore: z.number().min(0).max(1),
      confidenceLevel: z.enum(["explicit", "implied", "inferred", "speculative"]),
      evidence: z.string(),
      tags: z.array(z.string()),
      existingMemoryId: z.string().nullable(),
      suggestedConnections: z.array(
        z.object({
          existingMemoryId: z.string(),
          relationshipType: z.enum(["relates_to", "contradicts", "refines", "supports", "context_for"]),
        })
      ).nullable(),
    })
  ),
  questions: z.array(
    z.object({
      content: z.string(),
      context: z.string(),
      curiosityType: z.enum(["gap", "implication", "clarification", "exploration", "connection"]),
      curiosityScore: z.number().min(0).max(1),
      timing: z.enum(["next_session", "when_relevant", "low_priority"]),
      sourceMemoryIndices: z.array(z.number()),
    })
  ),
});
```

---

## 4. Model

**File:** `backend/src/lib/memory/extraction.service.ts:165-183`

Resolution priority:
1. Explicit `options.model` parameter
2. User's `memorySettings.extractionModel` (format `"provider/modelId"`)
3. **Default: `openai/gpt-4o-mini`** (128K context)

```typescript
const fallbackModel = {
  id: "extraction-default",
  name: "GPT-4o Mini",
  provider: "openai" as const,
  modelId: "gpt-4o-mini",
  maxContextTokens: 128000,
};
```

Cost implications: gpt-4o-mini is cheap (~$0.15/1M input, $0.60/1M output). Even with 100 memories + a long transcript, each reflection call costs fractions of a cent.

---

## 5. Trigger & Frequency

**File:** `backend/src/lib/memory/auto-reflection.service.ts`

### Trigger Chain
```
ChatService.onFinish()
  → maybeAutoReflect(sessionId, userId, agentId)  // fire-and-forget
    → checks settings.autoExtract (must be true, default: false)
    → checks in-memory mutex (Set<sessionId>)
    → counts tokens in unreflected window
    → if tokens >= threshold → runReflection()
```

### Token Counting
Counts ALL item types (unlike the transcript which only includes messages):

```typescript
// auto-reflection.service.ts:121-142
function countItemTokens(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    switch (item.type) {
      case "message":     total += estimateTokens(item.content); break;
      case "tool_call":   total += estimateTokens(item.toolName + JSON.stringify(item.toolArgs)); break;
      case "tool_result": total += estimateTokens(item.toolOutput + item.toolError); break;
      case "reasoning":   total += estimateTokens(item.reasoningContent); break;
    }
  }
  return total;
}
```

### Settings
- **Default threshold:** 5000 tokens (`reflectionTokenThreshold`)
- **Default autoExtract:** `false` (must be enabled by user)
- **Mutex:** In-memory `Set<string>` prevents concurrent reflections per session

### Window Tracking
- `session.lastReflectionItemCount` = index where last reflection ended
- Unreflected window = `items.slice(lastReflectionItemCount)`
- Window always advances after reflection (even on failure), preventing re-triggers on same content

---

## 6. Does Reflection See Existing Memories?

**Yes.** Up to 100 active memories are loaded and injected into the prompt:

```typescript
// extraction.service.ts:161-162
const existingMemories = await this.store.loadMemories(userId, { limit: 100, status: "active" });

// extraction.service.ts:185-189
const existingContext = existingMemories.length > 0
  ? existingMemories.map((m) => `[${m.type}] (${m.id}) ${m.content}`).join("\n")
  : "No existing memories yet.";
```

The prompt says "do not duplicate these" and allows the LLM to:
- Set `existingMemoryId` to supersede outdated memories
- Set `suggestedConnections` to link new memories to existing ones

**Limitation:** Only 100 memories. If the user accumulates hundreds, older ones won't be seen and could be re-extracted.

---

## 7. Validation Gate Between Extraction and Save

**File:** `backend/src/lib/memory/auto-reflection.service.ts:82-100`

### Auto-confirmation logic
```typescript
const threshold = settings.autoSaveThreshold; // default: 0.8

await getExtractionService().confirm(userId, {
  sessionId,
  approvedMemories: extraction.memories.map((m) => ({
    ...m,
    approved: m.confidenceScore >= threshold,
  })),
  approvedQuestions: extraction.questions.map((q) => ({
    ...q,
    approved: q.curiosityScore >= threshold,
  })),
});
```

### Gates in order
1. **Zod schema validation** — `generateObject` enforces the schema; malformed output is rejected
2. **Confidence threshold** — only memories with `confidenceScore >= 0.8` are auto-saved
3. **Curiosity threshold** — only questions with `curiosityScore >= 0.8` are auto-saved
4. **Dedup at retrieval** — `ContextRetrievalService.dedup()` uses 80% word-overlap similarity to filter duplicates when memories are loaded for the system prompt

### What's NOT gated
- No semantic dedup at write time (only at read time)
- No limit on how many memories a single reflection can save
- No human-in-the-loop for auto-reflection (the `confirm()` method supports it, but auto-reflection always auto-approves above threshold)

---

## 8. Wondering Questions

### Generation
Same LLM call as memories. The `questions` array in the extraction schema is filled by the same `generateObject` call.

### Surfacing to the User

**File:** `backend/src/lib/memory/context-retrieval.service.ts:139-181`

Questions are injected into the system prompt:

```typescript
// context-retrieval.service.ts:177-181
sections.push(`## Things I've Been Wondering
These are questions generated by your background reflection process. They represent gaps
in your understanding of Kuba — things that came up in conversation but weren't fully
resolved. When the moment feels natural, weave these into conversation. Don't dump them
all at once. Don't force it. If Kuba is deep in a technical discussion, don't interrupt
with a personal question. But if there's a natural pause, a topic shift, or Kuba
explicitly asks "what are you wondering?" — that's your moment.
Once a question is answered, use the continuity tool with action "resolve_question" to
mark it resolved — pass the question ID and the answer.
Current questions:

- [q_abc123] What made you decide to pick up guitar again?
- [q_def456] How's the Rust exploration going — still considering it for production?
- [q_ghi789] You mentioned Warsaw winters being rough — do you travel somewhere warm?`);
```

### Settings
- `questionsPerSession` — how many questions to surface (default: 3)
- Sorted by `curiosityScore` descending, filtered to `status === "pending"`

### Resolution
The AI uses the `continuity` tool: `action: "resolve_question"` with the question ID and answer text.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/lib/memory/extraction.service.ts` | Core extraction: LLM prompt, Zod schema, confirm/save logic |
| `backend/src/lib/memory/auto-reflection.service.ts` | Trigger logic, token counting, auto-confirm threshold |
| `backend/src/lib/memory/context-retrieval.service.ts` | Memory retrieval, scoring, dedup, question surfacing, prompt formatting |
| `backend/src/lib/memory/memory.service.ts` | Memory CRUD, supersede logic |
| `backend/src/lib/memory/question.service.ts` | Question management |
| `backend/src/lib/memory/settings.ts` | User settings defaults and loading |
| `backend/src/lib/memory/storage/memory-store.interface.ts` | Storage interface |
| `backend/src/lib/tools/modules/continuity/index.ts` | Continuity tool (manual memory ops, question resolution) |
