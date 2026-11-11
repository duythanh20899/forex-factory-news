const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Send a message via Telegram Bot API
 * Supports multiple chat IDs (comma-separated string or array)
 */
export async function sendTelegramMessage(text, options = {}) {
  const token = options.token || process.env.TELEGRAM_BOT_TOKEN;
  const rawChatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
  const parseMode = options.parseMode || 'HTML';
  const replyMarkup = options.replyMarkup || null;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in environment variables.');
  }
  if (!rawChatId) {
    throw new Error('TELEGRAM_CHAT_ID is missing in environment variables.');
  }

  // Parse chat IDs (can be string or array or comma-separated)
  const chatIds = Array.isArray(rawChatId)
    ? rawChatId
    : String(rawChatId).split(',').map(id => id.trim()).filter(Boolean);

  // Telegram messages cannot exceed 4096 characters.
  const chunks = splitMessage(text, 4000);
  const results = [];

  for (const chatId of chatIds) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload = {
        chat_id: chatId,
        text: chunk,
        parse_mode: parseMode,
        disable_web_page_preview: true
      };

      // Only attach replyMarkup to the last chunk
      if (replyMarkup && i === chunks.length - 1) {
        payload.reply_markup = replyMarkup;
      }

      const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!data.ok) {
        console.error(`Failed to send to chatId ${chatId}:`, data.description);
        continue;
      }
      results.push(data.result);
    }
  }

  return results;
}

/**
 * Split message into chunks if it exceeds limit
 */
function splitMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex === -1) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}
