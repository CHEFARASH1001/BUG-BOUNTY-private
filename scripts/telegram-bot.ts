#!/usr/bin/env ts-node
/**
 * Telegram Bot - Bug Bounty Status Reporter
 *
 * Reports the latest status of your bug bounty platform:
 * - Active programs count
 * - Domains & subdomains
 * - Vulnerabilities (by severity)
 * - Recent scans
 * - Top vulnerable targets
 *
 * Commands:
 *   /status   - Full dashboard report
 *   /vulns    - Vulnerability summary
 *   /scans    - Recent scans
 *   /programs - Active programs
 *   /help     - Show available commands
 *
 * Environment variables:
 *   TELEGRAM_BOT_TOKEN  - Your Telegram bot token (from @BotFather)
 *   TELEGRAM_CHAT_ID    - Your chat ID (from @userinfobot)
 *   API_URL             - Backend API URL (default: http://localhost:4000/api/v1)
 */

import https from 'https';
import http from 'http';

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  console.error('   Get one from @BotFather on Telegram');
  process.exit(1);
}

if (!CHAT_ID) {
  console.error('❌ TELEGRAM_CHAT_ID is required');
  console.error('   Get yours from @userinfobot on Telegram');
  process.exit(1);
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

function telegramApi(method: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid Telegram API response'));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Message Formatting ─────────────────────────────────────────────────────

function formatDashboard(stats: any): string {
  const vulns = stats.vulnerabilities || {};
  const lines = [
    '📊 *Bug Bounty Dashboard*',
    '',
    `🎯 Programs: *${stats.programs || 0}*`,
    `🌐 Domains: *${stats.domains || 0}*`,
    `🔗 Subdomains: *${stats.subdomains || 0}*`,
    '',
    '🔥 *Vulnerabilities:*',
    `  🔴 Critical: *${vulns.critical || 0}*`,
    `  🟠 High: *${vulns.high || 0}*`,
    `  🟡 Medium: *${vulns.medium || 0}*`,
    `  🟢 Low: *${vulns.low || 0}*`,
    `  🔵 Info: *${vulns.info || 0}*`,
    `  📈 Total: *${vulns.total || 0}*`,
  ];

  if (stats.recentScans?.length > 0) {
    lines.push('', '🔍 *Recent Scans:*');
    for (const scan of stats.recentScans.slice(0, 5)) {
      const status = scan.status === 'completed' ? '✅' : scan.status === 'running' ? '⏳' : '❌';
      lines.push(`  ${status} ${scan.type || 'scan'} → ${scan.target || 'unknown'}`);
    }
  }

  if (stats.topVulnerableTargets?.length > 0) {
    lines.push('', '🎯 *Top Vulnerable Targets:*');
    for (const target of stats.topVulnerableTargets.slice(0, 5)) {
      lines.push(`  • ${target._id} (${target.count} vulns)`);
    }
  }

  lines.push('', `⏰ _${new Date().toLocaleString('fa-IR')}_`);
  return lines.join('\n');
}

function formatVulns(vulns: any): string {
  const lines = [
    '🔥 *Vulnerability Summary*',
    '',
    `🔴 Critical: *${vulns.critical || 0}*`,
    `🟠 High: *${vulns.high || 0}*`,
    `🟡 Medium: *${vulns.medium || 0}*`,
    `🟢 Low: *${vulns.low || 0}*`,
    `🔵 Info: *${vulns.info || 0}*`,
    '',
    `📈 Total: *${vulns.total || 0}*`,
    '',
    `⏰ _${new Date().toLocaleString('fa-IR')}_`,
  ];
  return lines.join('\n');
}

function formatHelp(): string {
  return [
    '🤖 *Bug Bounty Bot Commands*',
    '',
    '/status \\- Full dashboard report',
    '/vulns \\- Vulnerability summary',
    '/scans \\- Recent scans',
    '/programs \\- Active programs',
    '/help \\- Show this message',
  ].join('\n');
}

// ─── Command Handlers ───────────────────────────────────────────────────────

async function handleStatus(): Promise<string> {
  try {
    const stats = await fetchJson(`${API_URL}/reports/dashboard`);
    return formatDashboard(stats);
  } catch (err: any) {
    return `❌ خطا در دریافت وضعیت: ${err.message}`;
  }
}

async function handleVulns(): Promise<string> {
  try {
    const stats = await fetchJson(`${API_URL}/reports/dashboard`);
    return formatVulns(stats.vulnerabilities || {});
  } catch (err: any) {
    return `❌ خطا: ${err.message}`;
  }
}

async function handleScans(): Promise<string> {
  try {
    const stats = await fetchJson(`${API_URL}/reports/dashboard`);
    if (!stats.recentScans?.length) return '📭 هیچ اسکن اخیری وجود نداره';

    const lines = ['🔍 *Recent Scans*', ''];
    for (const scan of stats.recentScans.slice(0, 10)) {
      const status = scan.status === 'completed' ? '✅' : scan.status === 'running' ? '⏳' : '❌';
      lines.push(`${status} *${scan.type || 'scan'}* → ${scan.target || 'unknown'}`);
      if (scan.createdAt) {
        lines.push(`   📅 ${new Date(scan.createdAt).toLocaleString('fa-IR')}`);
      }
    }
    return lines.join('\n');
  } catch (err: any) {
    return `❌ خطا: ${err.message}`;
  }
}

async function handlePrograms(): Promise<string> {
  try {
    const stats = await fetchJson(`${API_URL}/reports/dashboard`);
    return `🎯 *Active Programs:* ${stats.programs || 0}`;
  } catch (err: any) {
    return `❌ خطا: ${err.message}`;
  }
}

// ─── Send Message ───────────────────────────────────────────────────────────

async function sendMessage(chatId: string, text: string): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

let lastUpdateId = 0;

async function pollUpdates(): Promise<void> {
  try {
    const result = await telegramApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
    });

    if (!result.ok || !result.result) return;

    for (const update of result.result) {
      lastUpdateId = update.update_id;

      const message = update.message;
      if (!message?.text) continue;

      const chatId = message.chat.id.toString();
      const command = message.text.trim().split(' ')[0].toLowerCase();

      let response: string;

      switch (command) {
        case '/status':
        case '/start':
          response = await handleStatus();
          break;
        case '/vulns':
          response = await handleVulns();
          break;
        case '/scans':
          response = await handleScans();
          break;
        case '/programs':
          response = await handlePrograms();
          break;
        case '/help':
          response = formatHelp();
          break;
        default:
          response = await handleStatus();
          break;
      }

      await sendMessage(chatId, response);
    }
  } catch (err: any) {
    console.error('Polling error:', err.message);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🤖 Telegram Bot starting...');
  console.log(`📡 API URL: ${API_URL}`);
  console.log(`💬 Chat ID: ${CHAT_ID}`);

  // Send startup message
  await sendMessage(CHAT_ID, '🟢 *Bot Started*\n\nبات گزارش وضعیت فعال شد\\.\nبرای دیدن وضعیت بفرست: /status');

  console.log('✅ Bot is running. Listening for commands...');

  // Start polling loop
  while (true) {
    await pollUpdates();
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
