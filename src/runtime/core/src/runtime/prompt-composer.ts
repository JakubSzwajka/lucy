// ---------------------------------------------------------------------------
// Prompt Composer — single source of truth for prompt.md mutations
// ---------------------------------------------------------------------------
//
// Manages tagged sections in the system prompt file. Each section is wrapped
// in HTML comment markers (<!-- TAG:START --> / <!-- TAG:END -->) and can be
// replaced atomically. Sections can be sourced from static files or built
// dynamically.
//
// Usage:
//   const composer = new PromptComposer();
//   composer.addFileSection("MEMORY", ".agents/memory/MEMORY.md", {
//     prefix: "Recalled memories from previous sessions.",
//   });
//   composer.addDynamicSection("CONTEXT", async () => buildContextLines());
//   await composer.sync();
// ---------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionOptions {
  /** Short description injected before the content. */
  prefix?: string;
  /** Markdown heading level for the section title (default: ##). */
  heading?: string;
}

interface FileSection {
  kind: "file";
  tag: string;
  filePath: string;
  options: SectionOptions;
}

interface DynamicSection {
  kind: "dynamic";
  tag: string;
  builder: () => Promise<string | null>;
  options: SectionOptions;
}

type Section = FileSection | DynamicSection;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function markers(tag: string): { start: string; end: string } {
  return {
    start: `<!-- ${tag}:START -->`,
    end: `<!-- ${tag}:END -->`,
  };
}

/**
 * Replace or append a tagged section in the prompt content.
 * If `body` is null, removes the section entirely.
 */
export function replaceSection(
  content: string,
  tag: string,
  body: string | null,
): string {
  const { start, end } = markers(tag);
  const startIdx = content.indexOf(start);
  const endIdx = content.indexOf(end);

  if (body === null) {
    // Remove existing section (including surrounding blank lines)
    if (startIdx !== -1 && endIdx !== -1) {
      const before = content.slice(0, startIdx).replace(/\n+$/, "\n");
      const after = content.slice(endIdx + end.length).replace(/^\n+/, "\n");
      return before + after;
    }
    return content;
  }

  const block = [start, "", body, "", end].join("\n");

  if (startIdx !== -1 && endIdx !== -1) {
    return (
      content.slice(0, startIdx) +
      block +
      content.slice(endIdx + end.length)
    );
  }

  // Append at end
  return content.trimEnd() + "\n\n" + block + "\n";
}

// ---------------------------------------------------------------------------
// PromptComposer
// ---------------------------------------------------------------------------

export class PromptComposer {
  private sections: Section[] = [];

  private getPromptPath(): string {
    return resolve(process.env.PI_BRIDGE_PROMPT ?? "PROMPT.md");
  }

  /**
   * Register a file-based section.
   * Content is read from `filePath` at sync time. If the file doesn't exist,
   * the section is removed from the prompt.
   */
  addFileSection(
    tag: string,
    filePath: string,
    options: SectionOptions = {},
  ): this {
    this.sections.push({ kind: "file", tag, filePath: resolve(filePath), options });
    return this;
  }

  /**
   * Register a dynamically-built section.
   * Builder returns the section body, or null to remove the section.
   */
  addDynamicSection(
    tag: string,
    builder: () => Promise<string | null>,
    options: SectionOptions = {},
  ): this {
    this.sections.push({ kind: "dynamic", tag, builder, options });
    return this;
  }

  /**
   * Build the final body for a section: optional heading + prefix + content.
   * If `heading` is explicitly set to `false`, no heading is added (useful when
   * the source file already contains its own heading).
   *
   * Strips all lines that start with <!-- and end with --> from rawContent before formatting.
   */
  private formatBody(
    rawContent: string,
    options: SectionOptions,
  ): string {
    // Remove all lines that start with <!-- and end with -->
    const cleaned = rawContent
      .split("\n")
      .filter(line => !/^<!--.*-->$/.test(line.trim()))
      .join("\n");

    const parts: string[] = [];

    if (options.heading !== undefined) {
      parts.push(options.heading);
      parts.push("");
    }

    if (options.prefix) {
      parts.push(`_${options.prefix}_`);
      parts.push("");
    }

    parts.push(cleaned.trim());

    return parts.join("\n");
  }

  /**
   * Resolve a single section to its tag + body (or null).
   */
  private async resolveSection(
    section: Section,
  ): Promise<{ tag: string; body: string | null }> {
    if (section.kind === "file") {
      if (!existsSync(section.filePath)) {
        return { tag: section.tag, body: null };
      }
      const raw = await readFile(section.filePath, "utf-8");
      const trimmed = raw.trim();
      if (!trimmed) {
        return { tag: section.tag, body: null };
      }
      return {
        tag: section.tag,
        body: this.formatBody(trimmed, section.options),
      };
    }

    // Dynamic
    const raw = await section.builder();
    if (raw === null) {
      return { tag: section.tag, body: null };
    }
    return {
      tag: section.tag,
      body: this.formatBody(raw, section.options),
    };
  }

  /**
   * Sync all registered sections into the prompt file.
   * Reads once, applies all section replacements, writes once.
   */
  async sync(): Promise<void> {
    const promptPath = this.getPromptPath();

    let content: string;
    try {
      content = await readFile(promptPath, "utf-8");
    } catch {
      // No prompt file — nothing to do
      return;
    }

    // Resolve all sections in parallel
    const resolved = await Promise.all(
      this.sections.map((s) => this.resolveSection(s)),
    );

    // Apply all replacements sequentially on the same content string
    let updated = content;
    for (const { tag, body } of resolved) {
      updated = replaceSection(updated, tag, body);
    }

    if (updated !== content) {
      await writeFile(promptPath, updated, "utf-8");
    }
  }
}
