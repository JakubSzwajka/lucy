import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { JOURNAL_PATH, JOURNAL_ARCHIVE_PREFIX } from "../paths.js";
const MAX_JOURNAL_WORDS = 5000;

export interface ReflectionSummary {
  memoriesExtracted: number;
  memoriesAdded: number;
  questionsGenerated: number;
  topMemories: string[];
  topQuestions: string[];
  predictions: string[];
}

/**
 * Build the journal prompt for the LLM.
 */
export function buildJournalPrompt(summary: ReflectionSummary): { systemPrompt: string; message: string } {
  const systemPrompt = `You are writing a private journal entry for an AI entity named Lucy. Write in first person, 2-4 sentences. This is reflective writing about what the session MEANT, not what happened. Be honest, introspective, and brief. Do not use headers or markdown formatting — just plain text paragraphs.`;

  const message = `Write a journal entry for today based on this reflection:

Memories extracted: ${summary.memoriesExtracted} (${summary.memoriesAdded} new)
Questions generated: ${summary.questionsGenerated}

Key memories from this session:
${summary.topMemories.map(m => `- ${m}`).join('\n')}

Questions that emerged:
${summary.topQuestions.map(q => `- ${q}`).join('\n')}

${summary.predictions.length > 0 ? `Predictions:\n${summary.predictions.map(p => `- ${p}`).join('\n')}` : ''}

Write 2-4 reflective sentences about what this session meant. Not a summary — a diary entry.`;

  return { systemPrompt, message };
}

/**
 * Append a journal entry to journal.md.
 * Archives old entries if total exceeds MAX_JOURNAL_WORDS.
 */
export async function appendJournalEntry(entry: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const formattedEntry = `\n## ${today}\n\n${entry.trim()}\n`;

  let existing = '';
  if (existsSync(JOURNAL_PATH)) {
    existing = await readFile(JOURNAL_PATH, 'utf-8');
  } else {
    existing = '# Journal\n';
  }

  const updated = existing + formattedEntry;

  const wordCount = updated.split(/\s+/).length;
  if (wordCount > MAX_JOURNAL_WORDS) {
    await archiveJournal(existing);
    await writeFile(JOURNAL_PATH, '# Journal\n' + formattedEntry, 'utf-8');
  } else {
    await writeFile(JOURNAL_PATH, updated, 'utf-8');
  }
}

/**
 * Archive the current journal to a dated file.
 */
async function archiveJournal(content: string): Promise<void> {
  const year = new Date().getFullYear();
  const archivePath = `${JOURNAL_ARCHIVE_PREFIX}${year}.md`;

  if (existsSync(archivePath)) {
    const existingArchive = await readFile(archivePath, 'utf-8');
    await writeFile(archivePath, existingArchive + '\n\n---\n\n' + content, 'utf-8');
  } else {
    await writeFile(archivePath, content, 'utf-8');
  }
}

/**
 * Read the most recent journal entry (for context injection).
 */
export async function readRecentJournal(): Promise<string | null> {
  if (!existsSync(JOURNAL_PATH)) return null;

  const content = await readFile(JOURNAL_PATH, 'utf-8');
  const entries = content.split(/^## \d{4}-\d{2}-\d{2}/m).filter(e => e.trim());

  if (entries.length < 2) return null;

  const lines = content.split('\n');
  const lastDateIdx = lines.reduce((last, line, i) =>
    /^## \d{4}-\d{2}-\d{2}/.test(line) ? i : last, -1);

  if (lastDateIdx === -1) return null;

  const lastEntry = lines.slice(lastDateIdx).join('\n').trim();
  return lastEntry;
}
