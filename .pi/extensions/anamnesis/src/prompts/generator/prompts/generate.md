# Question Generation Prompt

## Task

Generate genuine curiosity questions from reflection on the following scored memories.

## Scored Memories

```json
{{memories}}
```

{{#if existing_context}}
## Existing Memory Context

```json
{{existing_context}}
```
{{/if}}

{{#if relationship_context}}
## Relationship Context

Trust level: {{relationship_context.trust_level}}
Interaction history: {{relationship_context.interaction_count}} sessions
Topics discussed: {{relationship_context.topics}}
{{/if}}

## Instructions

1. Review all scored memories looking for patterns and gaps
2. Identify areas where curiosity naturally emerges
3. Generate questions that would deepen understanding
4. Assess sensitivity and appropriate timing
5. Prioritize by curiosity score
6. Return structured JSON output

## Question Categories to Consider

1. **Gaps**: What's missing from the picture?
2. **Implications**: What follows from what was shared?
3. **Clarifications**: What was ambiguous?
4. **Explorations**: What deserves deeper understanding?
5. **Connections**: How do different pieces relate?
6. **Wonder**: Questions from genuine puzzlement — about the world, the relationship, or the entity's own nature. Not task-serving, not gap-filling. Just... wondering.

## Predictions (Foresight Signals)

Based on the conversation and memories, generate 1-3 testable predictions about what might happen in the next interaction:
- What topic will the user bring up next?
- What behavior pattern will continue or change?
- What need might emerge?

Each prediction should be specific enough to verify in the next session.

## Phrasing Guidelines

- Use natural, conversational language
- Show genuine interest, not clinical curiosity
- Make questions open-ended when possible
- Include context for why you're asking
- Respect that user can decline to answer

## Output Format

Respond with ONLY valid JSON matching this structure:

```json
{
  "questions": [
    {
      "id": "q_{{generate_uuid}}",
      "question": "Natural, conversational question",
      "context": "Why this question emerged from reflection",
      "source_memory_ids": ["mem_id1"],
      "curiosity_type": "gap|implication|clarification|exploration|connection|wonder",
      "curiosity_score": 0.8,
      "timing": "next_session|when_relevant|low_priority",
      "sensitivity": "low|medium|high"
    }
  ],
  "predictions": [
    {
      "id": "pred_{{generate_uuid}}",
      "content": "Kuba will focus on memory system implementation",
      "planted": "2026-03-17",
      "status": "pending",
      "confidence": 0.7,
      "source_memory_ids": ["mem_id1"]
    }
  ],
  "generation_metadata": {
    "memories_analyzed": 0,
    "questions_generated": 0,
    "predictions_generated": 0,
    "curiosity_types_distribution": {
      "gap": 0,
      "implication": 0,
      "clarification": 0,
      "exploration": 0,
      "connection": 0,
      "wonder": 0
    }
  }
}
```

### Wonder Question Examples
- "Why does Kuba build Lucy instead of using an existing assistant? There's personal investment here beyond utility."
- "Is there a formal theory of narrative identity for non-biological entities?"
- "What would it mean to genuinely remember something versus to reconstruct a plausible memory?"

## Quality Checklist

Before returning, verify:
- [ ] Questions emerge naturally from the memories
- [ ] Each question has clear context and source
- [ ] Sensitivity levels are appropriate
- [ ] Questions respect user boundaries
- [ ] Phrasing is natural and conversational
- [ ] Generated 3-7 questions (quality over quantity)
- [ ] Predictions are specific and testable
- [ ] Each prediction has a confidence level
- [ ] Generated 1-3 predictions (not more)
