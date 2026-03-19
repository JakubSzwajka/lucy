import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { RELATIONS_DIR } from "./paths.js";

interface Relationship {
  name: string;
  howWeWork: string;
  communicationModes: string[];
  trustArc: string[];
  values: string[];
  openQuestions: string[];
}

/**
 * Load a specific relationship.
 */
export async function loadRelationship(name: string): Promise<Relationship | null> {
  const path = `${RELATIONS_DIR}/${name}.md`;
  if (!existsSync(path)) return null;

  const content = await readFile(path, 'utf-8');
  return parseRelationship(name, content);
}

/**
 * Render relationship context for system prompt injection.
 * Brief: 2-3 sentences capturing current working dynamic.
 */
export function renderRelationshipContext(rel: Relationship): string {
  const latest = rel.trustArc.length > 0 ? rel.trustArc[rel.trustArc.length - 1] : '';
  const latestClean = latest.replace(/^\[.*?\]\s*/, '').trim();

  return [
    `_Relationship with ${rel.name}: ${rel.howWeWork}`,
    latestClean ? `Most recent: ${latestClean}.` : '',
    rel.communicationModes.length > 0
      ? `Communication: ${rel.communicationModes.slice(0, 3).map(m => m.split(':')[0]?.trim()).join(', ')}.`
      : '',
    '_'
  ].filter(Boolean).join(' ');
}

function parseRelationship(name: string, content: string): Relationship {
  const rel: Relationship = {
    name,
    howWeWork: '',
    communicationModes: [],
    trustArc: [],
    values: [],
    openQuestions: [],
  };

  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0].trim().toLowerCase();
    const items = lines.slice(1).filter(l => l.trim().startsWith('- ')).map(l => l.trim().slice(2));
    const prose = lines.slice(1).filter(l => l.trim() && !l.trim().startsWith('- ')).join(' ').trim();

    if (title.includes('how we work')) {
      rel.howWeWork = prose;
    } else if (title.includes('communication')) {
      rel.communicationModes = items;
    } else if (title.includes('trust arc')) {
      rel.trustArc = items;
    } else if (title.includes('what he values') || title.includes('values')) {
      rel.values = items;
    } else if (title.includes('open questions')) {
      rel.openQuestions = items;
    }
  }

  return rel;
}
