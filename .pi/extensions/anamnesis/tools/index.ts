// ---------------------------------------------------------------------------
// Anamnesis — Tool registrations
// ---------------------------------------------------------------------------
// LLM-callable tools for the knowledge graph: knowledge_search, knowledge_create
// ---------------------------------------------------------------------------

import { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { knowledgeSearch, knowledgeCreate } from "../src/context/knowledge.js";

export function registerTools(pi: ExtensionAPI) {
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
}
