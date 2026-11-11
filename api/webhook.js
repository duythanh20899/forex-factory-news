import { fetchCalendar, filterEvents, buildTelegramMessage, getDateStringInTimezone } from '../lib/forexfactory.js';
import { sendTelegramMessage } from '../lib/telegram.js';

const QUICK_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📅 Hôm nay (Đỏ & Cam)', callback_data: '/today' },
      { text: '🔴 Chỉ tin Đỏ', callback_data: '/high' }
    ],
    [
      { text: '⏰ 2 Giờ tới', callback_data: '/upcoming' },
      { text: '🟡 Tất cả tin', callback_data: '/all' }
    ]
  ]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Endpoint is Running');
  }

  const { message, callback_query } = req.body || {};

  // Handle both standard text messages and inline button clicks (callback queries)
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

  const command = rawText.trim().split(' ')[0].toLowerCase().replace(/@.+$/, '');
  const timeZone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
  const currenciesParam = process.env.CURRENCIES || 'USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF';
  const currencies = currenciesParam.split(',').map(c => c.trim()).filter(Boolean);

  try {
    if (command === '/start' || command === '/help') {
      const welcomeText = `👋 <b>Xin chào ${fromName}!</b>\n\n` +
        `Tôi là Bot cập nhật lịch kinh tế từ <b>ForexFactory</b> 📈\n\n` +
        `<b>Các lệnh hỗ trợ:</b>\n` +
        `🔹 <code>/today</code>: Xem các tin kinh tế quan trọng hôm nay (🔴 & 🟠)\n` +
        `🔹 <code>/high</code>: Chỉ xem tin đỏ quan trọng nhất hôm nay (🔴 High)\n` +
        `🔹 <code>/upcoming</code>: Xem tin trong 2 giờ tới\n` +
        `🔹 <code>/all</code>: Xem tất cả tin hôm nay (bao gồm cả tin vàng 🟡)\n` +
        `🔹 <code>/id</code>: Lấy Chat ID của bạn / nhóm này\n\n` +
        `<i>Bấm vào các nút dưới đây để xem nhanh:</i>`;

      await sendTelegramMessage(welcomeText, { chatId, replyMarkup: QUICK_KEYBOARD });
      return res.status(200).send('OK');
    }

    if (command === '/id') {
      const idText = `🆔 <b>Chat ID của bạn:</b> <code>${chatId}</code>`;
      await sendTelegramMessage(idText, { chatId });
      return res.status(200).send('OK');
    }

    if (['/today', '/high', '/all', '/upcoming'].includes(command)) {
      const allEvents = await fetchCalendar();
      const now = Date.now();

      let targetEvents = [];
      let title = '';
      let minImpact = 'Medium';

      if (command === '/high') {
        minImpact = 'High';
      } else if (command === '/all') {
        minImpact = 'Low';
      }

      if (command === '/upcoming') {
        const fromTime = now;
        const toTime = now + 2 * 60 * 60 * 1000; // 2 hours
        targetEvents = filterEvents(allEvents, {
          fromTime,
          toTime,
          timeZone,
          minImpact: 'Medium',
          currencies
        });
        title = `TIN KINH TẾ TRONG 2 GIỜ TỚI`;
      } else {
        // Today
        const todayDateStr = getDateStringInTimezone(new Date(now), timeZone);

        targetEvents = filterEvents(allEvents, {
          exactDay: todayDateStr,
          timeZone,
          minImpact,
          currencies
        });

        title = command === '/high' 
          ? `LỊCH TIN ĐỎ HÔM NAY (🔴 High Impact)` 
          : `LỊCH TIN KINH TẾ HÔM NAY`;
      }

      if (targetEvents.length === 0) {
        await sendTelegramMessage(`ℹ️ Không có tin kinh tế nào phù hợp trong khoảng thời gian này.`, {
          chatId,
          replyMarkup: QUICK_KEYBOARD
        });
        return res.status(200).send('OK');
      }

      const msg = buildTelegramMessage({
        title,
        events: targetEvents,
        timeZone,
        note: `Tổng cộng: ${targetEvents.length} tin.`
      });

      await sendTelegramMessage(msg, {
        chatId,
        replyMarkup: QUICK_KEYBOARD
      });
      return res.status(200).send('OK');
    }

    return res.status(200).send('Unknown command');
  } catch (error) {
    console.error('Webhook error:', error);
    try {
      await sendTelegramMessage(`⚠️ Có lỗi xảy ra khi xử lý: ${error.message}`, { chatId });
    } catch (_) {}
    return res.status(200).send('Error');
  }
}
