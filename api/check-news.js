import { fetchCalendar, filterEvents, buildTelegramMessage, getDateStringInTimezone } from '../lib/forexfactory.js';
import { sendTelegramMessage } from '../lib/telegram.js';

const INLINE_BUTTONS = {
  inline_keyboard: [
    [
      { text: '📅 Lịch hôm nay (🔴 & ⚪)', callback_data: '/today' },
      { text: '🔴 Chỉ tin Đỏ', callback_data: '/high' }
    ],
    [
      { text: '⏰ Tin trong 2 giờ tới', callback_data: '/upcoming' }
    ]
  ]
};

export default async function handler(req, res) {
  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Security Check (Optional but recommended)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    const querySecret = req.query.secret;
    const isAuthorized =
      querySecret === cronSecret ||
      authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
    }
  }

  try {
    const now = Date.now();
    const timeZone = process.env.TIMEZONE || req.query.timezone || 'Asia/Ho_Chi_Minh';
    const currenciesParam = req.query.currencies || process.env.CURRENCIES || 'USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF';
    const currencies = currenciesParam.split(',').map(c => c.trim()).filter(Boolean);

    const mode = (req.query.mode || 'upcoming').toLowerCase();
    const preview = req.query.preview === 'true'; // If true, return JSON without sending Telegram

    // 2. Fetch all events from ForexFactory
    const allEvents = await fetchCalendar();

    let targetEvents = [];
    let title = '';
    let note = '';

    if (mode === 'today') {
      // Đầu ngày báo cả Tin Đỏ (High) và Ngày nghỉ lễ ngân hàng (Holiday / Non-Economic)
      const todayDateStr = getDateStringInTimezone(new Date(now), timeZone);

      targetEvents = filterEvents(allEvents, {
        exactDay: todayDateStr,
        timeZone,
        allowedImpacts: ['High', 'Holiday', 'Non-Economic'],
        currencies
      });

      title = `LỊCH TIN ĐỎ 🔴 & NGHỈ LỄ ⚪ HÔM NAY`;
      note = `Tổng cộng có ${targetEvents.length} sự kiện chú ý trong ngày.`;
    } else {
      // Quét định kỳ trước giờ ra tin (upcoming): CHỈ BÁO TIN ĐỎ (High), BỎ QUA NGÀY NGHỈ
      const windowMinutes = parseInt(req.query.window || process.env.WINDOW_MINUTES || '30', 10);
      const fromTime = now;
      const toTime = now + windowMinutes * 60 * 1000;

      targetEvents = filterEvents(allEvents, {
        fromTime,
        toTime,
        timeZone,
        allowedImpacts: ['High'], // Chỉ lấy tin Đỏ, không lấy ngày nghỉ
        currencies
      });

      title = `CẢNH BÁO: TIN ĐỎ 🔴 TRONG ${windowMinutes} PHÚT TỚI`;
      note = `Hãy chú ý quản lý vốn và rủi ro trước giờ ra tin!`;
    }

    // 3. If no matching events found
    if (targetEvents.length === 0) {
      return res.status(200).json({
        success: true,
        mode,
        message: mode === 'upcoming' 
          ? 'No upcoming red news in window.' 
          : 'No red or holiday events today.',
        eventsCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Build Telegram Message
    const message = buildTelegramMessage({
      title,
      events: targetEvents,
      timeZone,
      note
    });

    // 5. Send to Telegram (unless preview=true)
    let telegramResult = null;
    if (!preview) {
      telegramResult = await sendTelegramMessage(message, {
        replyMarkup: INLINE_BUTTONS
      });
    }

    return res.status(200).json({
      success: true,
      mode,
      sentToTelegram: !preview,
      eventsCount: targetEvents.length,
      events: targetEvents,
      telegramResult
    });

  } catch (error) {
    console.error('Error in /api/check-news:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
}
