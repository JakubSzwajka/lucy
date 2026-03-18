// ---------------------------------------------------------------------------
// Anamnesis Extension
// ---------------------------------------------------------------------------
// The experience system for Lucy. Handles:
// - Dynamic context assembly (before_agent_start)
// - Reflection pipeline on compaction (session_before_compact)
// - Knowledge tools (knowledge_search, knowledge_create)
// ---------------------------------------------------------------------------

import { ExtensionAPI, serializeConversation, convertToLlm } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { ContinuitySkill } from "./src/index.js";
import { buildJournalPrompt, appendJournalEntry } from "./journal.js";
import { knowledgeSearch, knowledgeCreate } from "./knowledge.js";
import { llmCall } from "./src/framework/src/llm-call.js";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const MEMORY_PATH = ".agents/experience/memory/MEMORY.md";
const QUESTIONS_PATH = ".agents/experience/memory/questions.md";

/**
 * Estimate token count from text.
 * Simple heuristic: ~0.75 words per token (conservative).
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.ceil(words / 0.75);
}

const MAX_CONTEXT_TOKENS = 4000;

const skill = new ContinuitySkill();

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await skill.init();
    initialized = true;
    console.log("[anamnesis] skill initialized (lazy)");
  }
}

async function readSectionFile(
  path: string,
  prefix: string,
): Promise<string | null> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .split("\n")
    .filter((line) => !/^<!--.*-->$/.test(line.trim()))
    .join("\n")
    .trim();

  if (!cleaned) return null;
  return `_${prefix}_\n\n${cleaned}`;
}

function parseMemoriesFromMarkdown(content: string): any[] {
  const memories: any[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const type = lines[0].trim().toLowerCase();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("- ")) {
        const memory: any = { type, content: line.slice(2).trim() };

        if (i + 1 < lines.length && lines[i + 1].trim().startsWith("<!--")) {
          try {
            const metaLine = lines[i + 1].trim();
            const meta = JSON.parse(metaLine.slice(4, -3));
            Object.assign(memory, meta);
            i++;
          } catch {}
        }

        memories.push(memory);
      }
    }
  }

  return memories;
}

function parsePredictions(content: string): any[] {
  const predictions: any[] = [];
  const lines = content.split('\n');
  let current: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      if (current) predictions.push(current);
      const isPending = trimmed.startsWith('- [ ]');
      current = {
        content: trimmed.slice(6).replace(/\s*\[.*\]\s*$/, '').trim(),
        status: isPending ? 'pending' : 'resolved'
      };
    } else if (current && trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      try {
        const meta = JSON.parse(trimmed.slice(4, -3));
        Object.assign(current, meta);
      } catch {}
    }
  }
  if (current) predictions.push(current);
  return predictions;
}

function formatPredictions(predictions: any[]): string {
  const lines = ['# Predictions', '', `_Last updated: ${new Date().toISOString()}_`, ''];
  const pending = predictions.filter(p => p.status === 'pending');
  const resolved = predictions.filter(p => p.status !== 'pending');

  if (pending.length > 0) {
    lines.push('## Pending', '');
    for (const p of pending) {
      lines.push(`- [ ] ${p.content}`);
      const meta = { id: p.id, planted: p.planted, confidence: p.confidence, status: p.status, source_memory_ids: p.source_memory_ids };
      lines.push(`  <!-- ${JSON.stringify(meta)} -->`, '');
    }
  }

  if (resolved.length > 0) {
    lines.push('## Resolved', '');
    for (const p of resolved.slice(0, 20)) {
      lines.push(`- [x] ${p.content} [${p.status}]`);
      const meta = { id: p.id, planted: p.planted, resolved: p.resolved_at, status: p.status };
      lines.push(`  <!-- ${JSON.stringify(meta)} -->`, '');
    }
  }

  return lines.join('\n');
}

export default function (pi: ExtensionAPI) {
  // --- Knowledge tools: LLM-callable tools for the knowledge graph ---

  pi.registerTool({
    name: "knowledge_search",
    label: "Knowledge Search",
    description: "Search your knowledge graph (.agents/knowledge/) for nodes matching a query. Returns matching nodes with their content and wikilinks. Use this to find what you already know about a topic before creating new nodes or answering questions about known subjects.",
    promptSnippet: "Search your knowledge graph for existing understanding about a topic",
    promptGuidelines: [
      "Use knowledge_search before creating new nodes — check what already exists",
      "Use knowledge_search when a conversation touches a topic you might have a node about",
      "The knowledge graph contains durable understanding — not memories or transient facts",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query — a topic, person name, project, or concept to find in the knowledge graph" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const mkResult = (text: string) => ({ content: [{ type: "text" as const, text }], details: undefined });
      try {
        const results = await knowledgeSearch(params?.query || "");
        if (results.length === 0) {
          return mkResult(`No knowledge nodes found for "${params?.query || ""}". The knowledge graph has no entry for this topic yet. If you've learned something durable about it, consider creating a node with knowledge_create.`);
        }
        const formatted = results.map(r => {
          const links = r.wikilinks.length > 0 ? `\nConnects to: ${r.wikilinks.map(l => `[[${l}]]`).join(", ")}` : "";
          return `## [[${r.name}]]\n${r.description}\n\n${r.content}${links}`;
        }).join("\n\n---\n\n");
        return mkResult(`Found ${results.length} knowledge node(s):\n\n${formatted}`);
      } catch (err) {
        return mkResult(`knowledge_search failed: ${(err as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "knowledge_create",
    label: "Knowledge Create",
    description: "Create a new knowledge node in .agents/knowledge/. Validates: name, description, content under 100 lines, at least one [[wikilink]] connecting to the existing graph (No Orphans rule), no duplicates. Use this when you learn something DURABLE about the world — not transient facts, not memories, not tasks. Knowledge is understanding that would be true regardless of when you learned it.",
    promptSnippet: "Create a new knowledge node — durable understanding connected to the graph",
    promptGuidelines: [
      "Only create knowledge nodes for durable understanding, not transient facts or memories",
      "Every node MUST have at least one [[wikilink]] in prose explaining the connection",
      "Check if a node exists first with knowledge_search before creating",
      "Keep nodes under 100 lines — extract sub-nodes if growing",
      "The distinction: 'Kuba was frustrated on March 10' = memory. 'Docker builds need layer ordering' = knowledge",
    ],
    parameters: Type.Object({
      name: Type.String({ description: "Node name — kebab-case, descriptive (e.g., 'docker-layer-ordering', 'session-management')" }),
      description: Type.String({ description: "One-line description of what this node contains — used for index scanning" }),
      content: Type.String({ description: "Markdown content of the node. Must include at least one [[wikilink]] in prose. Do NOT include frontmatter (---) — it's added automatically from name/description." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const mkResult = (text: string) => ({ content: [{ type: "text" as const, text }], details: undefined });
      try {
        const result = await knowledgeCreate({
          name: params?.name || "",
          description: params?.description || "",
          content: params?.content || "",
        });

        if (!result.success) {
          const errMsg = result.errors.join("\n- ");
          const warnMsg = result.warnings.length > 0 ? `\n\nWarnings:\n- ${result.warnings.join("\n- ")}` : "";
          return mkResult(`Failed to create knowledge node:\n- ${errMsg}${warnMsg}`);
        }

        const warnMsg = result.warnings.length > 0 ? `\n\nWarnings:\n- ${result.warnings.join("\n- ")}` : "";
        return mkResult(`Knowledge node created: ${result.path}${warnMsg}`);
      } catch (err) {
        return mkResult(`knowledge_create failed: ${(err as Error).message}`);
      }
    },
  });

  // --- Prompt injection: dynamic context assembly ---
  pi.on("before_agent_start", async (_event) => {
    await ensureInit();
    console.log("[anamnesis] before_agent_start: assembling context");

    const parts: string[] = [];
    const loaded: string[] = [];

    // 0. Entity orientation
    try {
      const entityPath = ".agents/entity.md";
      if (existsSync(entityPath)) {
        const raw = await readFile(entityPath, "utf-8");
        const trimmed = raw.trim();
        if (trimmed) {
          parts.push("_Entity orientation:_\n\n" + trimmed);
          loaded.push("entity");
        }
      }
    } catch {}

    // 0.5. Knowledge graph index
    try {
      const { loadKnowledgeIndex, renderKnowledgeIndex } = await import("./knowledge.js");
      const index = await loadKnowledgeIndex();
      const rendered = renderKnowledgeIndex(index);
      if (rendered) {
        parts.push(rendered);
        loaded.push(`knowledge(${index.length} nodes)`);
      }
    } catch {}

    // 1. Disposition context
    try {
      const { loadDispositionProfile, renderDispositionContext } = await import("./dispositions.js");
      const profile = await loadDispositionProfile();
      if (profile) {
        parts.push(renderDispositionContext(profile));
        loaded.push("dispositions");
      }
    } catch {}

    // 1.5. Relational context (Kuba)
    try {
      const { loadRelationship, renderRelationshipContext } = await import("./relations.js");
      const kuba = await loadRelationship("kuba");
      if (kuba) {
        parts.push(renderRelationshipContext(kuba));
        loaded.push("relations");
      }
    } catch {}

    // 2. Memory context (salience-scored + narrative-reconstructed)
    try {
      const { scoreMemories } = await import("./salience.js");
      const { reconstructNarrative } = await import("./narrative-reconstruct.js");

      const memoryContent = existsSync(MEMORY_PATH)
        ? await readFile(MEMORY_PATH, "utf-8")
        : null;

      if (memoryContent) {
        const memories = parseMemoriesFromMarkdown(memoryContent);

        if (memories.length > 0) {
          const contextHint = ""; // Empty on fresh start, that's OK
          const scored = scoreMemories(memories, contextHint);
          const narrative = reconstructNarrative(scored);
          if (narrative) {
            parts.push("_Memories from previous sessions:_\n\n" + narrative);
            loaded.push(`memories(${memories.length} total, ${scored.length} scored)`);
          }
        }
      }
    } catch {}

    // 3. Tension context
    try {
      const { loadTensions, renderTensionContext } = await import("./tensions.js");
      const tensions = await loadTensions();
      const tensionCtx = renderTensionContext(tensions);
      if (tensionCtx) {
        parts.push(tensionCtx);
        loaded.push(`tensions(${tensions.length})`);
      }
    } catch {}

    // 4. Predictions context
    try {
      const predictionsPath = ".agents/experience/memory/predictions.md";
      if (existsSync(predictionsPath)) {
        const raw = await readFile(predictionsPath, "utf-8");
        const pendingMatch = raw.match(/- \[ \] .+/g);
        if (pendingMatch?.length) {
          const predictions = pendingMatch.slice(0, 3).map(p => p.replace("- [ ] ", "").trim());
          parts.push("_Pending predictions:_\n" + predictions.map(p => `- ${p}`).join("\n"));
          loaded.push(`predictions(${pendingMatch.length} pending)`);
        }
      }
    } catch {}

    // 5. Questions context
    try {
      const questionsContent = await readSectionFile(
        QUESTIONS_PATH,
        "Questions generated from past reflections. Ask when the moment feels right — don't force them.",
      );
      if (questionsContent) {
        parts.push(questionsContent);
        loaded.push("questions");
      }
    } catch {}

    // 6. Recent journal excerpt
    try {
      const { readRecentJournal } = await import("./journal.js");
      const journal = await readRecentJournal();
      if (journal) {
        parts.push("_From my journal:_\n\n" + journal);
        loaded.push("journal");
      }
    } catch {}

    // 7. Growth arcs
    try {
      const { loadArcs, renderArcsContext } = await import("./arcs.js");
      const arcs = await loadArcs();
      const arcsCtx = renderArcsContext(arcs);
      if (arcsCtx) {
        parts.push(arcsCtx);
        loaded.push(`arcs(${arcs.length})`);
      }
    } catch {}

    if (parts.length === 0) {
      console.log("[anamnesis] before_agent_start: no context sections loaded");
      return {};
    }

    let assembled = "## What's On My Mind\n\n" + parts.join("\n\n");

    // Token budget validation — truncate if exceeding limit
    let tokens = estimateTokens(assembled);
    console.log(`[anamnesis] before_agent_start: ${parts.length} sections [${loaded.join(", ")}], ~${tokens} tokens`);

    if (tokens > MAX_CONTEXT_TOKENS) {
      console.log(`[anamnesis] before_agent_start: exceeds ${MAX_CONTEXT_TOKENS} limit, truncating`);

      // Truncation strategy: remove sections from the end (lowest priority first)
      // Priority order: dispositions > memories > tensions > predictions > questions > journal > arcs
      // So we remove arcs first, then journal, then questions, etc.
      while (parts.length > 1 && estimateTokens("## What's On My Mind\n\n" + parts.join("\n\n")) > MAX_CONTEXT_TOKENS) {
        parts.pop();
        loaded.pop();
      }

      assembled = "## What's On My Mind\n\n" + parts.join("\n\n");
      tokens = estimateTokens(assembled);
      console.log(`[anamnesis] before_agent_start: truncated to ${parts.length} sections, ~${tokens} tokens`);

      // If still over budget with just one section, hard-truncate
      if (tokens > MAX_CONTEXT_TOKENS) {
        const words = assembled.split(/\s+/);
        const maxWords = Math.floor(MAX_CONTEXT_TOKENS * 0.75);
        assembled = words.slice(0, maxWords).join(' ') + '\n\n_[context truncated to fit token budget]_';
        console.log(`[anamnesis] before_agent_start: hard-truncated to ${maxWords} words`);
      }
    }

    return {
      systemPrompt: _event.systemPrompt + "\n\n" + assembled,
    };
  });

  // --- Compaction hook: trigger reflection ---
  pi.on("session_before_compact", async (event, _ctx) => {
    await ensureInit();
    const { preparation } = event;

    const msgCount = preparation.messagesToSummarize.length;
    console.log(`[anamnesis] session_before_compact: ${msgCount} messages to summarize, ${preparation.tokensBefore} tokens before`);

    const conversationText = serializeConversation(
      convertToLlm(preparation.messagesToSummarize),
    );
    const userMsgCount = (conversationText.match(/^\[User\]:/gm) || []).length;
    console.log(`[anamnesis] session_before_compact: serialized ${conversationText.length} chars, ${userMsgCount} user messages`);

    // Check foresight signals from previous sessions
    try {
      const predictionsPath = ".agents/experience/memory/predictions.md";
      if (existsSync(predictionsPath)) {
        const raw = await readFile(predictionsPath, "utf-8");
        const predictions = parsePredictions(raw);
        const pending = predictions.filter(p => p.status === 'pending');
        console.log(`[anamnesis] foresight: ${predictions.length} total predictions, ${pending.length} pending`);

        if (pending.length > 0) {
          const conversationLower = conversationText.toLowerCase();
          let confirmed = 0;

          for (const pred of pending) {
            const keywords = pred.content.toLowerCase()
              .split(/\s+/)
              .filter((w: string) => w.length > 4)
              .slice(0, 5);

            const matches = keywords.filter((kw: string) => conversationLower.includes(kw));
            const matchRatio = keywords.length > 0 ? matches.length / keywords.length : 0;

            if (matchRatio >= 0.4) {
              pred.status = 'confirmed';
              pred.resolved_at = new Date().toISOString().split('T')[0];
              confirmed++;
            }
            // Don't auto-violate — predictions stay pending until confirmed or expire
          }

          if (confirmed > 0) {
            await writeFile(predictionsPath, formatPredictions(predictions), 'utf-8');
            console.log(`[anamnesis] foresight: ${confirmed} predictions confirmed`);

            // Append note to disposition profile about confirmed predictions
            try {
              const profilePath = ".agents/experience/dispositions/profile.md";
              if (existsSync(profilePath)) {
                const profile = await readFile(profilePath, "utf-8");
                const confirmedPreds = pending.filter(p => p.status === 'confirmed');
                const note = confirmedPreds.map(p =>
                  `- "${p.content}" — confirmed ${p.resolved_at}`
                ).join('\n');
                const updated = profile.replace(
                  '### Active Predictions',
                  `### Active Predictions\n\n#### Recently Confirmed\n${note}\n`
                );
                await writeFile(profilePath, updated, 'utf-8');
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.log(`[anamnesis] foresight check failed: ${(err as Error).message}`);
    }

    console.log("[anamnesis] session_before_compact: starting reflection pipeline");
    const reflectStart = Date.now();
    const result = await skill.reflect({ content: conversationText });
    const reflectMs = Date.now() - reflectStart;

    if (result.success) {
      console.log(
        `[anamnesis] reflection complete in ${reflectMs}ms — ${result.memories_extracted} extracted, ${result.memories_added} added, ${result.questions_generated} questions`,
      );
    } else {
      console.log(`[anamnesis] reflection skipped: ${result.message}`);
    }

    // Write journal entry (non-blocking — don't fail compaction if journal fails)
    if (result.success) {
      try {
        console.log("[anamnesis] writing journal entry");
        const journalPrompt = buildJournalPrompt({
          memoriesExtracted: result.memories_extracted ?? 0,
          memoriesAdded: result.memories_added ?? 0,
          questionsGenerated: result.questions_generated ?? 0,
          topMemories: [],
          topQuestions: [],
          predictions: [],
        });
        const journalResult = await llmCall({
          systemPrompt: journalPrompt.systemPrompt,
          message: journalPrompt.message,
        });
        await appendJournalEntry(journalResult.content);
        console.log("[anamnesis] journal entry written");
      } catch (err) {
        console.log(`[anamnesis] journal write failed: ${(err as Error).message}`);
      }
    }

    const summary = result.success
      ? `[Reflection ${result.job_id}] Extracted ${result.memories_extracted} memories (${result.memories_added} new). Generated ${result.questions_generated} questions. Use recalled memories and questions as background context for continued conversation.`
      : "Reflection did not complete. Continue with available context.";

    return {
      compaction: {
        summary,
        firstKeptEntryId: preparation.firstKeptEntryId,
        tokensBefore: preparation.tokensBefore,
      },
    };
  });
}
