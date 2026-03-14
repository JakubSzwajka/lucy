#!/usr/bin/env node
/**
 * Telegram Notify CLI - Send messages to Kuba
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    command: null,
    options: {},
    positional: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];

      if (next && !next.startsWith('--')) {
        parsed.options[key] = next;
        i++;
      } else {
        parsed.options[key] = true;
      }
    } else if (!parsed.command) {
      parsed.command = arg;
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

/**
 * Load configuration
 */
async function loadConfig() {
  const configPath = join(__dirname, 'config.json');
  
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    // Return default config if file doesn't exist
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID || '123456789', // Kuba's chat ID
      baseUrl: 'https://api.telegram.org/bot'
    };
  }
}

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(botToken, chatId, message, options = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: options.markdown ? 'Markdown' : undefined,
    disable_notification: options.silent || false
  };

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Telegram API error: ${result.description || response.statusText}`);
    }

    return {
      success: true,
      messageId: result.result.message_id,
      chatId: result.result.chat.id
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save failed message for retry
 */
async function saveFailedMessage(message, error) {
  const retryDir = join(__dirname, 'retry');
  
  try {
    await fs.mkdir(retryDir, { recursive: true });
    
    const failedMessage = {
      message,
      error,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    const filename = `failed_${Date.now()}.json`;
    const filePath = join(retryDir, filename);
    
    await fs.writeFile(filePath, JSON.stringify(failedMessage, null, 2));
    
    console.log(`Failed message saved to: ${filename}`);
  } catch (saveError) {
    console.error('Failed to save retry message:', saveError.message);
  }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Telegram Notify - Send messages to Kuba

Usage:
  telegram-notify <command> [options]

Commands:
  send         Send a message to Kuba

Options:
  --message <text>     Message content to send
  --context <type>     Context type (session, reflection, insight)
  --silent             Send without notification sound
  --markdown           Enable Markdown formatting

Examples:
  telegram-notify send --message "Reflection complete: 7 memories extracted"
  telegram-notify send --message "**Important Update**" --markdown
  telegram-notify send --message "Background insight discovered" --silent

Environment:
  TELEGRAM_BOT_TOKEN   Bot token for Telegram API
  TELEGRAM_CHAT_ID     Kuba's chat ID (optional, uses config default)
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const parsed = parseArgs(args);

  try {
    const config = await loadConfig();

    if (!config.botToken) {
      console.error('Error: TELEGRAM_BOT_TOKEN not found in environment or config');
      process.exit(1);
    }

    switch (parsed.command) {
      case 'send': {
        if (!parsed.options.message) {
          console.error('Error: --message is required');
          process.exit(1);
        }

        console.log('Sending message to Kuba...');
        
        const result = await sendTelegramMessage(
          config.botToken,
          config.chatId,
          parsed.options.message,
          {
            markdown: parsed.options.markdown,
            silent: parsed.options.silent
          }
        );

        if (result.success) {
          console.log('✅ Message sent successfully');
          console.log(`Message ID: ${result.messageId}`);
        } else {
          console.error('❌ Failed to send message:', result.error);
          await saveFailedMessage(parsed.options.message, result.error);
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${parsed.command}`);
        console.log('Run with --help for usage information');
        process.exit(1);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();