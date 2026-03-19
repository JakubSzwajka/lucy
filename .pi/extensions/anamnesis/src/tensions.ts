import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { TENSIONS_PATH } from "./paths.js";
const MAX_ACTIVE = 5;
const MAX_DAYS = 30;
const MAX_SESSIONS = 5;

interface Tension {
  title: string;
  stated: string;
  observed: string;
  hypothesis: string;
  status: 'active' | 'resolved' | 'permanent';
  created: string;
  sessions: number;
  maxSessions: number;
  salience?: number;
}

/**
 * Load active tensions from file.
 */
export async function loadTensions(): Promise<Tension[]> {
  if (!existsSync(TENSIONS_PATH)) return [];

  const content = await readFile(TENSIONS_PATH, 'utf-8');
  return parseTensions(content);
}

/**
 * Save tensions to file.
 */
export async function saveTensions(tensions: Tension[]): Promise<void> {
  const content = formatTensions(tensions);
  await writeFile(TENSIONS_PATH, content, 'utf-8');
}

/**
 * Add a new tension if under the max limit.
 * Returns true if added, false if at capacity.
 */
export async function addTension(tension: Omit<Tension, 'sessions' | 'maxSessions'>): Promise<boolean> {
  const tensions = await loadTensions();
  const active = tensions.filter(t => t.status !== 'resolved');

  if (active.length >= MAX_ACTIVE) return false;

  tensions.push({
    ...tension,
    sessions: 0,
    maxSessions: MAX_SESSIONS,
  });

  await saveTensions(tensions);
  return true;
}

/**
 * Auto-resolve expired tensions.
 * Called at the start of each reflection cycle.
 */
export async function resolveExpiredTensions(): Promise<Tension[]> {
  const tensions = await loadTensions();
  const now = new Date();
  const resolved: Tension[] = [];

  for (const t of tensions) {
    if (t.status === 'permanent' || t.status === 'resolved') continue;

    const created = new Date(t.created);
    const ageDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > MAX_DAYS || t.sessions >= t.maxSessions) {
      t.status = 'resolved';
      resolved.push(t);
    }
  }

  if (resolved.length > 0) {
    await saveTensions(tensions);
  }

  return resolved;
}

/**
 * Increment session count for all active tensions.
 */
export async function incrementTensionSessions(): Promise<void> {
  const tensions = await loadTensions();
  for (const t of tensions) {
    if (t.status === 'active') {
      t.sessions++;
    }
  }
  await saveTensions(tensions);
}

/**
 * Render tensions for context injection (brief summary).
 */
export function renderTensionContext(tensions: Tension[]): string {
  const active = tensions.filter(t => t.status === 'active' || t.status === 'permanent');
  if (active.length === 0) return '';

  const lines = active.map(t => {
    if (t.status === 'permanent') {
      return `_Permanent tension: ${t.title} — ${t.hypothesis}_`;
    }
    return `_Active tension: ${t.title} [${t.sessions}/${t.maxSessions} sessions] — Hypothesis: ${t.hypothesis}_`;
  });

  return lines.join('\n');
}

function parseTensions(content: string): Tension[] {
  const tensions: Tension[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split('\n');
    const titleLine = lines[0].trim();

    // Parse title: "Title [status]" or "Title [permanent]"
    const titleMatch = titleLine.match(/^(.+?)\s*\[(.*?)\]\s*$/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const statusHint = titleMatch[2].toLowerCase();

    const tension: Tension = {
      title,
      stated: '',
      observed: '',
      hypothesis: '',
      status: statusHint.includes('permanent') ? 'permanent' : 'active',
      created: '',
      sessions: 0,
      maxSessions: MAX_SESSIONS,
    };

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- **Stated:**')) tension.stated = trimmed.replace('- **Stated:**', '').trim();
      if (trimmed.startsWith('- **Observed:**')) tension.observed = trimmed.replace('- **Observed:**', '').trim();
      if (trimmed.startsWith('- **Hypothesis:**')) tension.hypothesis = trimmed.replace('- **Hypothesis:**', '').trim();
      if (trimmed.startsWith('- **Status:**')) {
        const s = trimmed.replace('- **Status:**', '').trim().toLowerCase();
        if (s.includes('permanent')) tension.status = 'permanent';
        else if (s.includes('resolved')) tension.status = 'resolved';
        else tension.status = 'active';
      }
      if (trimmed.startsWith('- **Created:**')) tension.created = trimmed.replace('- **Created:**', '').trim();
      if (trimmed.startsWith('- **Sessions:**')) {
        const match = trimmed.match(/(\d+)\/(\d+)/);
        if (match) {
          tension.sessions = parseInt(match[1]);
          tension.maxSessions = parseInt(match[2]);
        }
      }
    }

    tensions.push(tension);
  }

  return tensions;
}

function formatTensions(tensions: Tension[]): string {
  const lines = [
    '# Active Tensions',
    '',
    `_Maximum ${MAX_ACTIVE} active tensions. Default lifecycle: ${MAX_DAYS} days or ${MAX_SESSIONS} sessions. Auto-resolve with temporal precedence after expiry._`,
    '',
  ];

  for (const t of tensions) {
    const statusTag = t.status === 'permanent' ? 'permanent' :
                      t.status === 'resolved' ? 'resolved' :
                      `created: ${t.created}, sessions: ${t.sessions}/${t.maxSessions}`;

    lines.push(`## ${t.title} [${statusTag}]`);
    lines.push(`- **Stated:** ${t.stated}`);
    lines.push(`- **Observed:** ${t.observed}`);
    lines.push(`- **Hypothesis:** ${t.hypothesis}`);
    lines.push(`- **Status:** ${t.status === 'permanent' ? 'Permanent — a condition to inhabit, not a tension to resolve' : t.status}`);
    lines.push(`- **Created:** ${t.created}`);
    lines.push(`- **Sessions:** ${t.sessions}/${t.maxSessions}`);
    lines.push('');
  }

  return lines.join('\n');
}
