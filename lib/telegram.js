const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(text, options = {}) {
  const token = options.token || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
  const parseMode = options.parseMode || 'HTML';

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in environment variables.');
  }
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID is missing in environment variables.');
  }

  // Telegram messages cannot exceed 4096 characters.
  const chunks = splitMessage(text, 4000);

  const results = [];
  for (const chunk of chunks) {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API Error: ${data.description || 'Unknown error'}`);
    }
    results.push(data.result);
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
