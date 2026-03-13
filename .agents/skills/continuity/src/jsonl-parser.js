/**
 * JSONL Parser - Converts Pi session JSONL format to plain text transcript
 *
 * Standalone utility. Not part of the skill internals.
 * Use this to prepare a transcript before passing to the continuity skill.
 *
 * Usage (as script):
 *   node jsonl-parser.js /data/pi/sessions/--app--/session.jsonl > /tmp/transcript.txt
 *   node jsonl-parser.js /data/pi/sessions/--app--/session.jsonl --from 2026-03-13T19:30
 *
 * Pi session JSONL format per line:
 *   { type: "message", id, parentId, timestamp, message: { role, content: [...] } }
 *
 * Roles: "user", "assistant", "toolResult"
 * Content types: "text", "toolCall", "toolResult"
 */

import { readFile } from 'fs/promises';

/**
 * Parse a Pi session JSONL file into a plain text transcript
 * @param {string} filePath - Path to the .jsonl file
 * @param {Object} options
 * @param {string} [options.from] - ISO timestamp — only include messages after this time
 * @returns {Promise<string>} Plain text transcript
 */
export async function parseJsonlSession(filePath, options = {}) {
  const raw = await readFile(filePath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);

  const fromTime = options.from ? new Date(options.from).getTime() : null;
  const messages = [];

  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }

    if (obj.type !== 'message' || !obj.message) continue;

    // Filter by time scope if requested
    if (fromTime && obj.timestamp) {
      if (new Date(obj.timestamp).getTime() < fromTime) continue;
    }

    const { role, content } = obj.message;

    // Only care about user and assistant turns
    if (role !== 'user' && role !== 'assistant') continue;

    const text = extractText(content);
    if (!text) continue;

    const label = role === 'user' ? 'User' : 'Assistant';
    messages.push(`${label}: ${text}`);
  }

  return messages.join('\n\n');
}

/**
 * Extract plain text from a content array, skip tool noise
 * @param {Array|string} content
 * @returns {string}
 */
function extractText(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

// Run as CLI script
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const fromArg = args.find(a => a.startsWith('--from='))?.split('=')[1];

  if (!filePath) {
    console.error('Usage: node jsonl-parser.js <session.jsonl> [--from=ISO_TIMESTAMP]');
    process.exit(1);
  }

  parseJsonlSession(filePath, { from: fromArg })
    .then(transcript => process.stdout.write(transcript + '\n'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
