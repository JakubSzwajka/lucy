#!/usr/bin/env node
/**
 * web - search the web or fetch a page
 *
 * Usage:
 *   node cli.js search <query> [--max <n>] [--deep]
 *   node cli.js fetch <url> [--playwright]
 *
 * Commands:
 *   search   - find pages by query via Tavily, returns titles + URLs + snippets
 *   fetch    - extract full page content via Tavily; --playwright forces headless browser
 *
 * Env: TAVILY_API_KEY
 */

import { tavily } from '@tavily/core';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || !['search', 'fetch'].includes(cmd)) {
  console.error('Usage:\n  node cli.js search <query> [--max <n>] [--deep]\n  node cli.js fetch <url> [--playwright]');
  process.exit(1);
}

const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) {
  console.error('Error: TAVILY_API_KEY env var not set');
  process.exit(1);
}

const client = tavily({ apiKey });

// ── SEARCH ────────────────────────────────────────────────────────────────────
if (cmd === 'search') {
  const maxIdx = args.indexOf('--max');
  const maxResults = maxIdx !== -1 ? parseInt(args[maxIdx + 1]) : 5;
  const deep = args.includes('--deep');
  const query = args.slice(1).filter(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--max').join(' ');

  if (!query) {
    console.error('Error: search query required');
    process.exit(1);
  }

  const response = await client.search(query, {
    searchDepth: deep ? 'advanced' : 'basic',
    maxResults,
    includeAnswer: true,
  });

  if (response.answer) {
    console.log(`ANSWER: ${response.answer}\n`);
  }

  for (const r of response.results) {
    console.log(`[${r.title}]`);
    console.log(`URL: ${r.url}`);
    console.log(`${r.content}`);
    console.log('---');
  }
}

// ── FETCH ─────────────────────────────────────────────────────────────────────
if (cmd === 'fetch') {
  const url = args[1];
  const forcePlaywright = args.includes('--playwright');

  if (!url) {
    console.error('Error: URL required');
    process.exit(1);
  }

  if (!forcePlaywright) {
    try {
      const response = await client.extract([url]);
      const result = response.results?.[0];
      if (result?.rawContent) {
        console.log(result.rawContent);
        process.exit(0);
      }
    } catch (e) {
      console.error(`Tavily extract failed: ${e.message}, falling back to Playwright...`);
    }
  }

  // Playwright fallback
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();
  console.log(text);
}
