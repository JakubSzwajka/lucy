# Memory Classification Prompt

## Task

Analyze the following conversation transcript and extract discrete, structured memories.

## Conversation Transcript

```
{{conversation}}
```

## Existing Memory Context

{{#if existing_memories}}
The following memories already exist - avoid duplicates:
```json
{{existing_memories}}
```
{{else}}
No existing memories provided.
{{/if}}

## Instructions

1. Read through the entire conversation carefully
2. Identify statements that contain memorable information about the user
3. Classify each memory according to the type definitions
4. Extract the most accurate representation of each memory
5. Assign relevant tags for future retrieval
6. Assess salience dimensions for each memory: importance (0-1), novelty (0-1), and affect (valence -1 to 1, arousal 0-1)
7. Set valid_from to today's date (ISO format, date only) for every new memory
8. For each memory, identify which conversation turn it came from (e.g., 'user message 3') and record as source_turn
9. Return the structured JSON output

## Output Format

Respond with ONLY valid JSON matching this structure:

```json
{
  "memories": [
    {
      "id": "{{generate_uuid}}",
      "type": "fact|preference|relationship|principle|commitment|moment|skill",
      "content": "Clear, concise memory statement",
      "source_quote": "Direct quote from conversation",
      "source_turn": "user message N",
      "tags": ["tag1", "tag2"],
      "context": "When/why this was mentioned",
      "uncertain": false,
      "salience": {
        "importance": 0.7,
        "novelty": 0.3,
        "affect_heuristic": {
          "valence": 0.5,
          "arousal": 0.3
        }
      },
      "valid_from": "2026-03-17"
    }
  ],
  "extraction_metadata": {
    "messages_analyzed": 0,
    "memories_extracted": 0,
    "skipped_reasons": ["reason1", "reason2"]
  }
}
```

## Quality Checklist

Before returning, verify:
- [ ] Each memory is atomic (single piece of information)
- [ ] Types are correctly assigned per the decision tree
- [ ] Source quotes are accurate
- [ ] No duplicates with existing memories
- [ ] Tags are relevant and useful for retrieval
- [ ] Uncertain memories are flagged
- [ ] Each memory has a source_turn identifying which conversation turn it came from

## Salience Assessment Guide

- **importance** (0-1): How significant is this to the entity's ongoing existence and relationship? Routine facts ~0.3, key preferences ~0.5, relationship shifts ~0.8, life decisions ~0.9
- **novelty** (0-1): How unexpected or surprising is this? Expected follow-up ~0.2, new topic ~0.5, contradicts known fact ~0.8, completely surprising ~0.9
- **affect_heuristic**: Retrieval weighting signal, NOT phenomenological measurement
  - **valence** (-1 to 1): Negative to positive emotional tone. Frustration ~-0.5, neutral ~0, excitement ~0.7
  - **arousal** (0-1): Activation level. Calm statement ~0.2, excited sharing ~0.7, urgent request ~0.9
