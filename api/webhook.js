import { fetchCalendar, filterEvents, buildTelegramMessage, getDateStringInTimezone } from '../lib/forexfactory.js';
import { sendTelegramMessage } from '../lib/telegram.js';

// Persistent Keyboard attached to bottom of chat input
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '📅 /today (Tin đỏ & Nghỉ lễ)' }, { text: '🔴 /high (Chỉ tin đỏ)' }],
    [{ text: '⏰ /upcoming (2 giờ tới)' }, { text: 'ℹ️ /start' }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// Inline clickable buttons inside messages
const INLINE_BUTTONS = {
  inline_keyboard: [
    [
      { text: '📅 Hôm nay (🔴 & ⚪)', callback_data: '/today' },
      { text: '🔴 Chỉ tin Đỏ', callback_data: '/high' }
    ],
    [
      { text: '⏰ 2 Giờ tới', callback_data: '/upcoming' }
    ]
  ]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Endpoint is Running');
  }

  const { message, callback_query } = req.body || {};

  let chatId = null;
  let rawText = '';
  let fromName = 'Trader';
  let callbackQueryId = null;

  if (callback_query) {
    chatId = callback_query.message.chat.id;
    rawText = callback_query.data || '';
    fromName = callback_query.from?.first_name || 'Trader';
    callbackQueryId = callback_query.id;
  } else if (message) {
    chatId = message.chat.id;
    rawText = message.text || '';
    fromName = message.from?.first_name || 'Trader';
  } else {
    return res.status(200).send('OK (Ignored event)');
  }

  // Answer callback query quickly if present
  if (callbackQueryId) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    }).catch(() => {});
  }

  // Extract command (handling e.g. "📅 /today (Tin đỏ & Nghỉ lễ)" -> "/today")
  const match = rawText.match(/\/([a-zA-Z0-9_]+)/);
  const command = match ? `/${match[1].toLowerCase()}` : rawText.trim().toLowerCase();

  const timeZone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
  const currenciesParam = process.env.CURRENCIES || 'USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF';
  const currencies = currenciesParam.split(',').map(c => c.trim()).filter(Boolean);

  try {
    if (command === '/start' || command === '/help') {
      const welcomeText = `👋 <b>Xin chào ${fromName}!</b>\n\n` +
        `Tôi là Bot cập nhật lịch kinh tế <b>ForexFactory</b> 📈\n` +
        `<i>(Chỉ lọc tin Đỏ 🔴 biến động mạnh và tin Trắng ⚪ nghỉ lễ ngân hàng)</i>\n\n` +
        `<b>Các lệnh hỗ trợ:</b>\n` +
        `🔹 <code>/today</code>: Xem lịch tin đỏ 🔴 & nghỉ lễ ⚪ hôm nay\n` +
        `🔹 <code>/high</code>: Chỉ xem tin đỏ quan trọng (🔴 High Impact)\n` +
        `🔹 <code>/upcoming</code>: Xem tin sắp ra trong 2 giờ tới\n` +
        `🔹 <code>/id</code>: Lấy Chat ID của bạn / nhóm\n\n` +
        `<i>Bạn có thể bấm vào bàn phím bên dưới hoặc các nút để tra cứu nhanh!</i>`;

      await sendTelegramMessage(welcomeText, {
        chatId,
        replyMarkup: MAIN_KEYBOARD
      });
      return res.status(200).send('OK');
    }

    if (command === '/id') {
      const idText = `🆔 <b>Chat ID của bạn:</b> <code>${chatId}</code>`;
      await sendTelegramMessage(idText, { chatId, replyMarkup: MAIN_KEYBOARD });
      return res.status(200).send('OK');
    }

    if (['/today', '/high', '/upcoming'].includes(command)) {
      const allEvents = await fetchCalendar();
      const now = Date.now();

      let targetEvents = [];
      let title = '';
      const allowedImpacts = command === '/high' ? ['High'] : ['High', 'Holiday', 'Non-Economic'];

      if (command === '/upcoming') {
        const fromTime = now;
        const toTime = now + 2 * 60 * 60 * 1000; // 2 hours
        targetEvents = filterEvents(allEvents, {
          fromTime,
          toTime,
          timeZone,
          allowedImpacts,
          currencies
        });
        title = `TIN ĐỎ & NGHỈ LỄ TRONG 2 GIỜ TỚI`;
      } else {
        // Today
        const todayDateStr = getDateStringInTimezone(new Date(now), timeZone);

        targetEvents = filterEvents(allEvents, {
          exactDay: todayDateStr,
          timeZone,
          allowedImpacts,
          currencies
        });

        title = command === '/high' 
          ? `LỊCH TIN ĐỎ HÔM NAY (🔴 High Impact)` 
          : `LỊCH TIN ĐỎ 🔴 & NGHỈ LỄ ⚪ HÔM NAY`;
      }

      if (targetEvents.length === 0) {
        await sendTelegramMessage(`ℹ️ Không có tin đỏ hoặc ngày nghỉ lễ nào trong khung thời gian này.`, {
          chatId,
          replyMarkup: MAIN_KEYBOARD
        });
        return res.status(200).send('OK');
      }

      const msg = buildTelegramMessage({
        title,
        events: targetEvents,
        timeZone,
        note: `Tổng cộng: ${targetEvents.length} sự kiện.`
      });

      await sendTelegramMessage(msg, {
        chatId,
        replyMarkup: MAIN_KEYBOARD
      });
      return res.status(200).send('OK');
    }

    return res.status(200).send('Unknown command');
  } catch (error) {
    console.error('Webhook error:', error);
    try {
      await sendTelegramMessage(`⚠️ Có lỗi xảy ra khi xử lý: ${error.message}`, {
        chatId,
        replyMarkup: MAIN_KEYBOARD
      });
    } catch (_) {}
    return res.status(200).send('Error');
  }
}
