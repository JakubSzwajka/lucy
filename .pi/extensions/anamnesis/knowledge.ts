// ---------------------------------------------------------------------------
// Knowledge Tools — programmatic access to the knowledge graph
// ---------------------------------------------------------------------------
// Provides: knowledge_search, knowledge_create, knowledge index loading.
// Knowledge nodes are markdown files in .agents/knowledge/ with YAML
// frontmatter (name, description) and wikilinked prose.
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const KNOWLEDGE_DIR = ".agents/knowledge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeNode {
  name: string;
  description: string;
  filename: string;
  content: string;
  wikilinks: string[];
}

export interface KnowledgeIndex {
  nodes: { name: string; description: string; filename: string }[];
  totalNodes: number;
}

export interface CreateNodeOptions {
  name: string;
  description: string;
  content: string;
}

export interface CreateNodeResult {
  success: boolean;
  path: string;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Index — scan the knowledge directory for all nodes
// ---------------------------------------------------------------------------

export async function loadKnowledgeIndex(): Promise<KnowledgeIndex> {
  if (!existsSync(KNOWLEDGE_DIR)) {
    return { nodes: [], totalNodes: 0 };
  }

  const files = await readdir(KNOWLEDGE_DIR);
  const mdFiles = files.filter(f => f.endsWith(".md"));
  const nodes: KnowledgeIndex["nodes"] = [];

  for (const file of mdFiles) {
    const path = join(KNOWLEDGE_DIR, file);
    const raw = await readFile(path, "utf-8");
    const frontmatter = parseFrontmatter(raw);

    nodes.push({
      name: frontmatter.name || file.replace(".md", ""),
      description: frontmatter.description || "",
      filename: file,
    });
  }

  return { nodes, totalNodes: nodes.length };
}

/**
 * Render the knowledge index for context injection.
 * Compact format: ~30-80 tokens depending on node count.
 */
export function renderKnowledgeIndex(index: KnowledgeIndex): string | null {
  if (index.totalNodes === 0) return null;

  const nodeList = index.nodes
    .map(n => `[[${n.name}]]` + (n.description ? ` — ${n.description}` : ""))
    .join("\n  ");

  return `_Knowledge graph (${index.totalNodes} nodes):_\n  ${nodeList}\n_Search with grep in .agents/knowledge/ to read full nodes. Create new nodes proactively when you learn something durable._`;
}

// ---------------------------------------------------------------------------
// Search — find nodes by keyword or wikilink
// ---------------------------------------------------------------------------

export async function knowledgeSearch(query: string): Promise<KnowledgeNode[]> {
  if (!existsSync(KNOWLEDGE_DIR)) return [];

  const files = await readdir(KNOWLEDGE_DIR);
  const mdFiles = files.filter(f => f.endsWith(".md"));
  const results: KnowledgeNode[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  for (const file of mdFiles) {
    const path = join(KNOWLEDGE_DIR, file);
    const raw = await readFile(path, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    const contentLower = raw.toLowerCase();

    // Score by: name match, description match, content keyword match
    let score = 0;
    const name = (frontmatter.name || file.replace(".md", "")).toLowerCase();

    if (name === queryLower || name.includes(queryLower)) score += 10;
    if (frontmatter.description?.toLowerCase().includes(queryLower)) score += 5;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) score += 1;
    }

    if (score > 0) {
      results.push({
        name: frontmatter.name || file.replace(".md", ""),
        description: frontmatter.description || "",
        filename: file,
        content: raw,
        wikilinks: extractWikilinks(raw),
      });
    }
  }

  // Sort by relevance (name matches first)
  results.sort((a, b) => {
    const aName = a.name.toLowerCase().includes(queryLower) ? 1 : 0;
    const bName = b.name.toLowerCase().includes(queryLower) ? 1 : 0;
    return bName - aName;
  });

  return results;
}

// ---------------------------------------------------------------------------
// Create — write a new knowledge node with validation
// ---------------------------------------------------------------------------

export async function knowledgeCreate(options: CreateNodeOptions): Promise<CreateNodeResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Validate name ---
  if (!options.name || options.name.trim().length === 0) {
    errors.push("Name is required.");
  }
  const slug = options.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!slug) {
    errors.push(`Invalid name "${options.name}" — must produce a valid filename slug.`);
  }

  // --- Validate description ---
  if (!options.description || options.description.trim().length === 0) {
    errors.push("Description is required (one line explaining what this node contains).");
  }
  if (options.description && options.description.length > 200) {
    warnings.push("Description is long (>200 chars). Keep it to one line for index scanning.");
  }

  // --- Validate content ---
  if (!options.content || options.content.trim().length === 0) {
    errors.push("Content is required.");
  }

  const lines = (options.content || "").split("\n").length;
  if (lines > 100) {
    warnings.push(`Content is ${lines} lines (max recommended: 100). Consider extracting sub-nodes.`);
  }

  // --- Check for wikilinks (no orphans rule) ---
  const wikilinks = extractWikilinks(options.content || "");
  if (wikilinks.length === 0) {
    errors.push("No wikilinks found. Every knowledge node must connect to the existing graph (No Orphans rule). Add at least one [[wikilink]] in prose.");
  }

  // --- Check wikilinks resolve ---
  for (const link of wikilinks) {
    const linkSlug = link.toLowerCase().replace(/\s+/g, "-");
    const skillPath = join(".agents/skills", linkSlug, "SKILL.md");
    const knowledgePath = join(KNOWLEDGE_DIR, `${linkSlug}.md`);

    if (!existsSync(skillPath) && !existsSync(knowledgePath)) {
      warnings.push(`Wikilink [[${link}]] doesn't resolve to an existing node. Create it or link to something that exists.`);
    }
  }

  // --- Check for duplicates ---
  const targetPath = join(KNOWLEDGE_DIR, `${slug}.md`);
  if (existsSync(targetPath)) {
    errors.push(`Node "${slug}.md" already exists. Use knowledge_search to read it first, then update it directly.`);
  }

  // --- Validate frontmatter is NOT in content (we add it) ---
  if (options.content.trimStart().startsWith("---")) {
    warnings.push("Content starts with '---' — looks like frontmatter is included in content. Frontmatter is added automatically from name/description fields.");
  }

  // --- If errors, don't write ---
  if (errors.length > 0) {
    return { success: false, path: targetPath, errors, warnings };
  }

  // --- Build the file ---
  const frontmatter = `---\nname: ${options.name}\ndescription: ${options.description}\n---\n\n`;
  const fullContent = frontmatter + options.content.trim() + "\n";

  await writeFile(targetPath, fullContent, "utf-8");
  console.log(`[knowledge] created node: ${slug}.md (${wikilinks.length} wikilinks)`);

  return { success: true, path: targetPath, errors: [], warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

function extractWikilinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}
