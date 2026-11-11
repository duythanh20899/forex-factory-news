import { fetchCalendar, filterEvents, buildTelegramMessage, getDateStringInTimezone } from '../lib/forexfactory.js';
import { sendTelegramMessage } from '../lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Endpoint is Running');
  }

  const { message } = req.body || {};
  if (!message || !message.text) {
    return res.status(200).send('OK (No text)');
  }

  const chatId = message.chat.id;
  const rawText = message.text.trim();
  const command = rawText.split(' ')[0].toLowerCase().replace(/@.+$/, ''); // Remove @botname if in group

  const timeZone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
  const currenciesParam = process.env.CURRENCIES || 'USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF';
  const currencies = currenciesParam.split(',').map(c => c.trim()).filter(Boolean);

  try {
    if (command === '/start' || command === '/help') {
      const welcomeText = `👋 <b>Xin chào ${message.from?.first_name || 'Trader'}!</b>\n\n` +
        `Tôi là Bot cập nhật lịch kinh tế từ <b>ForexFactory</b> 📈\n\n` +
        `<b>Các lệnh hỗ trợ:</b>\n` +
        `🔹 <code>/today</code>: Xem các tin kinh tế quan trọng hôm nay (🔴 & 🟠)\n` +
        `🔹 <code>/high</code>: Chỉ xem tin đỏ quan trọng nhất hôm nay (🔴 High)\n` +
        `🔹 <code>/upcoming</code>: Xem tin trong 2 giờ tới\n` +
        `🔹 <code>/all</code>: Xem tất cả tin hôm nay (bao gồm cả tin vàng 🟡)\n` +
        `🔹 <code>/id</code>: Lấy Chat ID của bạn / nhóm này\n\n` +
        `<i>Bot tự động cảnh báo trước giờ ra tin thông qua Vercel + Cron-job.org!</i>`;

      await sendTelegramMessage(welcomeText, { chatId });
      return res.status(200).send('OK');
    }

    if (command === '/id') {
      const idText = `🆔 <b>Chat ID của bạn:</b> <code>${chatId}</code>\n` +
        `Loại chat: <b>${message.chat.type}</b>`;
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
        await sendTelegramMessage(`ℹ️ Không có tin kinh tế nào phù hợp trong khoảng thời gian này.`, { chatId });
        return res.status(200).send('OK');
      }

      const msg = buildTelegramMessage({
        title,
        events: targetEvents,
        timeZone,
        note: `Tổng cộng: ${targetEvents.length} tin.`
      });

      await sendTelegramMessage(msg, { chatId });
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
