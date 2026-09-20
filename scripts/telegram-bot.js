#!/usr/bin/env node
/**
 * Telegram Bot - Bug Bounty Status Reporter (Professional Edition)
 *
 * Features:
 *   - Inline keyboard menus
 *   - Callback query handling
 *   - Professional formatting
 *   - No external dependencies
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy PROXY_PORT=10808 node telegram-bot.js
 */

const https = require('https');
const http = require('http');
const tls = require('tls');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';
const PROXY_HOST = process.env.PROXY_HOST || '127.0.0.1';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '10808');

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}
if (!CHAT_ID) {
  console.error('❌ TELEGRAM_CHAT_ID is required');
  process.exit(1);
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    }).on('error', reject);
  });
}

function telegramApi(method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const targetHost = 'api.telegram.org';
    const targetPath = `/bot${BOT_TOKEN}/${method}`;

    const connectReq = http.request({
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: 'CONNECT',
      path: `${targetHost}:443`,
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        return;
      }

      const tlsSocket = tls.connect({
        host: targetHost,
        socket: socket,
        servername: targetHost,
      }, () => {
        const reqData = [
          `POST ${targetPath} HTTP/1.1`,
          `Host: ${targetHost}`,
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(payload)}`,
          'Connection: close',
          '',
          payload,
        ].join('\r\n');

        tlsSocket.write(reqData);

        let data = '';
        tlsSocket.on('data', (chunk) => data += chunk);
        tlsSocket.on('end', () => {
          try {
            const bodyStart = data.indexOf('\r\n\r\n');
            if (bodyStart === -1) { reject(new Error('Invalid HTTP response')); return; }
            let responseBody = data.slice(bodyStart + 4);
            if (data.toLowerCase().includes('transfer-encoding: chunked')) {
              const chunks = [];
              let remaining = responseBody;
              while (remaining.length > 0) {
                const lineEnd = remaining.indexOf('\r\n');
                if (lineEnd === -1) break;
                const chunkSize = parseInt(remaining.slice(0, lineEnd), 16);
                if (chunkSize === 0) break;
                chunks.push(remaining.slice(lineEnd + 2, lineEnd + 2 + chunkSize));
                remaining = remaining.slice(lineEnd + 2 + chunkSize + 2);
              }
              responseBody = chunks.join('');
            }
            resolve(JSON.parse(responseBody));
          } catch (e) {
            reject(new Error('Failed to parse Telegram response'));
          }
        });
      });
      tlsSocket.on('error', reject);
    });

    connectReq.on('error', (err) => {
      reject(new Error(`Proxy connection failed: ${err.message}`));
    });
    connectReq.setTimeout(30000, () => {
      connectReq.destroy();
      reject(new Error('Proxy connection timed out'));
    });
    connectReq.end();
  });
}

// ─── Keyboards ──────────────────────────────────────────────────────────────

const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📊 داشبورد', callback_data: 'dashboard' },
      { text: '🔥 آسیب‌پذیری‌ها', callback_data: 'vulns' },
    ],
    [
      { text: '🔍 اسکن‌های اخیر', callback_data: 'scans' },
      { text: '🎯 برنامه‌ها', callback_data: 'programs' },
    ],
    [
      { text: '🌐 ساب‌دامین‌ها', callback_data: 'subdomains' },
      { text: '🎯 تارگت‌های آسیب‌پذیر', callback_data: 'targets' },
    ],
    [
      { text: '🔄 رفرش', callback_data: 'refresh' },
      { text: '❓ راهنما', callback_data: 'help' },
    ],
  ],
};

const BACK_KEYBOARD = {
  inline_keyboard: [
    [{ text: '⬅️ بازگشت به منو', callback_data: 'menu' }],
  ],
};

// ─── Message Formatting ─────────────────────────────────────────────────────

function formatWelcome() {
  return [
    '🛡 *Bug Bounty Automation Platform*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '👋 سلام! من بات گزارش وضعیت پلتفرم هستم.',
    '',
    'از منوی زیر انتخاب کن:',
  ].join('\n');
}

function formatDashboard(stats) {
  const vulns = stats.vulnerabilities || {};
  return [
    '📊 *داشبورد کلی*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '┌─────────────────────────┐',
    `│ 🎯 برنامه‌ها:     *${String(stats.programs || 0).padStart(6)}* │`,
    `│ 🌐 دامنه‌ها:      *${String(stats.domains || 0).padStart(6)}* │`,
    `│ 🔗 ساب‌دامین‌ها:  *${String(stats.subdomains || 0).padStart(6)}* │`,
    '└─────────────────────────┘',
    '',
    '🔥 *آسیب‌پذیری‌ها:*',
    `   🔴 بحرانی:  *${vulns.critical || 0}*`,
    `   🟠 بالا:    *${vulns.high || 0}*`,
    `   🟡 متوسط:   *${vulns.medium || 0}*`,
    `   🟢 پایین:   *${vulns.low || 0}*`,
    `   🔵 اطلاعاتی: *${vulns.info || 0}*`,
    `   ─────────────`,
    `   📈 مجموع:   *${vulns.total || 0}*`,
    '',
    `⏰ آخرین بروزرسانی: _${new Date().toLocaleString('fa-IR')}_`,
  ].join('\n');
}

function formatVulns(vulns) {
  const total = vulns.total || 0;
  const criticalPct = total > 0 ? Math.round((vulns.critical || 0) / total * 100) : 0;
  const highPct = total > 0 ? Math.round((vulns.high || 0) / total * 100) : 0;
  const medPct = total > 0 ? Math.round((vulns.medium || 0) / total * 100) : 0;
  const lowPct = total > 0 ? Math.round((vulns.low || 0) / total * 100) : 0;

  return [
    '🔥 *گزارش آسیب‌پذیری‌ها*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔴 بحرانی:   *${vulns.critical || 0}*  (${criticalPct}%)`,
    `${'█'.repeat(Math.ceil(criticalPct / 5))}${'░'.repeat(20 - Math.ceil(criticalPct / 5))}`,
    '',
    `🟠 بالا:     *${vulns.high || 0}*  (${highPct}%)`,
    `${'█'.repeat(Math.ceil(highPct / 5))}${'░'.repeat(20 - Math.ceil(highPct / 5))}`,
    '',
    `🟡 متوسط:    *${vulns.medium || 0}*  (${medPct}%)`,
    `${'█'.repeat(Math.ceil(medPct / 5))}${'░'.repeat(20 - Math.ceil(medPct / 5))}`,
    '',
    `🟢 پایین:    *${vulns.low || 0}*  (${lowPct}%)`,
    `${'█'.repeat(Math.ceil(lowPct / 5))}${'░'.repeat(20 - Math.ceil(lowPct / 5))}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `📈 مجموع: *${total}* آسیب‌پذیری`,
    '',
    `⏰ _${new Date().toLocaleString('fa-IR')}_`,
  ].join('\n');
}

function formatScans(recentScans) {
  if (!recentScans || recentScans.length === 0) {
    return '📭 *هیچ اسکن اخیری وجود نداره*';
  }

  const lines = [
    '🔍 *اسکن‌های اخیر*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  for (let i = 0; i < Math.min(recentScans.length, 8); i++) {
    const scan = recentScans[i];
    const statusIcon = scan.status === 'completed' ? '✅' :
                       scan.status === 'running' ? '⏳' :
                       scan.status === 'queued' ? '🕐' : '❌';
    const date = scan.createdAt ? new Date(scan.createdAt).toLocaleString('fa-IR') : '';

    lines.push(`${statusIcon} *${scan.type || 'scan'}*`);
    lines.push(`   🎯 ${scan.target || 'unknown'}`);
    lines.push(`   📅 ${date}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatPrograms(count) {
  return [
    '🎯 *برنامه‌های فعال*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `تعداد برنامه‌های فعال: *${count}*`,
    '',
    `⏰ _${new Date().toLocaleString('fa-IR')}_`,
  ].join('\n');
}

function formatSubdomains(count) {
  return [
    '🌐 *ساب‌دامین‌ها*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `تعداد کل ساب‌دامین‌ها: *${count}*`,
    '',
    `⏰ _${new Date().toLocaleString('fa-IR')}_`,
  ].join('\n');
}

function formatTargets(targets) {
  if (!targets || targets.length === 0) {
    return '📭 *هیچ تارگت آسیب‌پذیری ثبت نشده*';
  }

  const lines = [
    '🎯 *تارگت‌های پرآسیب‌پذیری*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  for (let i = 0; i < Math.min(targets.length, 10); i++) {
    const t = targets[i];
    const bar = '🟥'.repeat(Math.min(t.count, 5));
    lines.push(`${i + 1}. *${t._id}*`);
    lines.push(`   ${bar} (${t.count} آسیب‌پذیری)`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatHelp() {
  return [
    '❓ *راهنمای بات*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 *داشبورد* — نمای کلی پلتفرم',
    '🔥 *آسیب‌پذیری‌ها* — گزارش با نمودار',
    '🔍 *اسکن‌ها* — لیست اسکن‌های اخیر',
    '🎯 *برنامه‌ها* — تعداد برنامه‌های فعال',
    '🌐 *ساب‌دامین‌ها* — آمار ساب‌دامین‌ها',
    '🎯 *تارگت‌ها* — پرآسیب‌پذیرترین اهداف',
    '',
    '🔄 *رفرش* — بروزرسانی اطلاعات',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '_دستورات: /start /status /vulns /scans_',
  ].join('\n');
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function getDashboardData() {
  return await fetchJson(`${API_URL}/reports/dashboard`);
}

async function handleCallback(callbackData) {
  try {
    const stats = await getDashboardData();

    switch (callbackData) {
      case 'dashboard':
      case 'refresh':
        return { text: formatDashboard(stats), keyboard: BACK_KEYBOARD };
      case 'vulns':
        return { text: formatVulns(stats.vulnerabilities || {}), keyboard: BACK_KEYBOARD };
      case 'scans':
        return { text: formatScans(stats.recentScans), keyboard: BACK_KEYBOARD };
      case 'programs':
        return { text: formatPrograms(stats.programs || 0), keyboard: BACK_KEYBOARD };
      case 'subdomains':
        return { text: formatSubdomains(stats.subdomains || 0), keyboard: BACK_KEYBOARD };
      case 'targets':
        return { text: formatTargets(stats.topVulnerableTargets), keyboard: BACK_KEYBOARD };
      case 'help':
        return { text: formatHelp(), keyboard: BACK_KEYBOARD };
      case 'menu':
        return { text: formatWelcome(), keyboard: MAIN_MENU_KEYBOARD };
      default:
        return { text: formatWelcome(), keyboard: MAIN_MENU_KEYBOARD };
    }
  } catch (err) {
    return { text: `❌ خطا: ${err.message}`, keyboard: BACK_KEYBOARD };
  }
}

// ─── Send/Edit Messages ─────────────────────────────────────────────────────

async function sendMessageWithKeyboard(chatId, text, keyboard) {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function editMessage(chatId, messageId, text, keyboard) {
  await telegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function answerCallback(callbackQueryId) {
  await telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
  });
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const result = await telegramApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
    });

    if (!result.ok || !result.result) return;

    for (const update of result.result) {
      lastUpdateId = update.update_id;

      // Handle callback queries (button presses)
      if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id.toString();
        const messageId = cb.message.message_id;
        const data = cb.data;

        try {
          await answerCallback(cb.id);
          const response = await handleCallback(data);
          await editMessage(chatId, messageId, response.text, response.keyboard);
        } catch (err) {
          console.error('Callback error:', err.message);
        }
        continue;
      }

      // Handle text messages
      const message = update.message;
      if (!message || !message.text) continue;

      const chatId = message.chat.id.toString();
      const command = message.text.trim().split(' ')[0].toLowerCase();

      switch (command) {
        case '/start':
        case '/menu':
          await sendMessageWithKeyboard(chatId, formatWelcome(), MAIN_MENU_KEYBOARD);
          break;
        case '/status':
          const resp = await handleCallback('dashboard');
          await sendMessageWithKeyboard(chatId, resp.text, BACK_KEYBOARD);
          break;
        case '/vulns':
          const vResp = await handleCallback('vulns');
          await sendMessageWithKeyboard(chatId, vResp.text, BACK_KEYBOARD);
          break;
        case '/scans':
          const sResp = await handleCallback('scans');
          await sendMessageWithKeyboard(chatId, sResp.text, BACK_KEYBOARD);
          break;
        case '/help':
          await sendMessageWithKeyboard(chatId, formatHelp(), BACK_KEYBOARD);
          break;
        default:
          await sendMessageWithKeyboard(chatId, formatWelcome(), MAIN_MENU_KEYBOARD);
          break;
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🤖 Telegram Bot starting...');
  console.log(`📡 API URL: ${API_URL}`);
  console.log(`💬 Chat ID: ${CHAT_ID}`);
  console.log(`🌐 Proxy: ${PROXY_HOST}:${PROXY_PORT}`);

  // Send startup message with menu
  try {
    await sendMessageWithKeyboard(CHAT_ID, formatWelcome(), MAIN_MENU_KEYBOARD);
    console.log('✅ Startup message sent');
  } catch (err) {
    console.error('⚠️  Could not send startup message:', err.message);
  }

  console.log('✅ Bot is running. Listening for commands...');

  while (true) {
    await pollUpdates();
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
