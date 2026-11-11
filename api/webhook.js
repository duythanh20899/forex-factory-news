import { fetchCalendar, filterEvents, buildTelegramMessage, getDateStringInTimezone } from '../lib/forexfactory.js';
import { sendTelegramMessage } from '../lib/telegram.js';

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

  // Extract command (handling e.g. "/today@forex_news_group_bot" -> "/today")
  const match = rawText.match(/\/([a-zA-Z0-9_]+)/);
  const command = match ? `/${match[1].toLowerCase()}` : rawText.trim().toLowerCase();

  const timeZone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
  const currenciesParam = process.env.CURRENCIES || 'USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF';
  const currencies = currenciesParam.split(',').map(c => c.trim()).filter(Boolean);

  // Clean up any existing custom keyboard on the client
  const replyMarkup = { remove_keyboard: true };

  try {
    if (command === '/start' || command === '/help') {
      const welcomeText = `👋 <b>Xin chào ${fromName}!</b>\n\n` +
        `Tôi là Bot cập nhật lịch kinh tế <b>ForexFactory</b> 📈\n` +
        `<i>(Chỉ lọc tin Đỏ 🔴 biến động mạnh và tin Trắng ⚪ nghỉ lễ ngân hàng)</i>\n\n` +
        `<b>Các lệnh hỗ trợ:</b>\n` +
        `🔹 <code>/today</code>: Xem lịch tin đỏ 🔴 & nghỉ lễ ⚪ hôm nay\n` +
        `🔹 <code>/high</code>: Chỉ xem tin đỏ quan trọng (🔴 High Impact)\n` +
        `🔹 <code>/upcoming</code>: Xem tin đỏ sắp ra trong 2 giờ tới\n` +
        `🔹 <code>/id</code>: Lấy Chat ID của nhóm này`;

      await sendTelegramMessage(welcomeText, { chatId, replyMarkup });
      return res.status(200).send('OK');
    }

    if (command === '/id') {
      const idText = `🆔 <b>Chat ID:</b> <code>${chatId}</code>`;
      await sendTelegramMessage(idText, { chatId, replyMarkup });
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
          allowedImpacts: ['High'], // Sắp ra tin: chỉ báo tin ĐỎ, không báo ngày nghỉ
          currencies
        });
        title = `TIN ĐỎ 🔴 TRONG 2 GIỜ TỚI`;
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
          replyMarkup
        });
        return res.status(200).send('OK');
      }

      const msg = buildTelegramMessage({
        title,
        events: targetEvents,
        timeZone,
        note: `Tổng cộng: ${targetEvents.length} sự kiện.`
      });

      await sendTelegramMessage(msg, { chatId, replyMarkup });
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
