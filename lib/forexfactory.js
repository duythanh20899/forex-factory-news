const FF_CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

// Mapping impact to priority order and icon
export const IMPACT_CONFIG = {
  High: { level: 3, icon: '🔴', label: 'Mạnh (High)' },
  Medium: { level: 2, icon: '🟠', label: 'Vừa (Medium)' },
  Low: { level: 1, icon: '🟡', label: 'Nhẹ (Low)' },
  'Non-Economic': { level: 0, icon: '⚪', label: 'Nghỉ lễ/Khác' },
  Holiday: { level: 0, icon: '⚪', label: 'Nghỉ lễ' }
};

// Currency flags
export const CURRENCY_FLAGS = {
  USD: '🇺🇸 USD',
  EUR: '🇪🇺 EUR',
  GBP: '🇬🇧 GBP',
  JPY: '🇯🇵 JPY',
  AUD: '🇦🇺 AUD',
  CAD: '🇨🇦 CAD',
  CHF: '🇨🇭 CHF',
  NZD: '🇳🇿 NZD',
  CNY: '🇨🇳 CNY',
  ALL: '🌐 ALL'
};

/**
 * Fetch calendar data from Forex Factory (via FairEconomy JSON CDN)
 */
export async function fetchCalendar() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(FF_CALENDAR_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForexFactoryBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`ForexFactory HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format a Date to YYYY-MM-DD in the target timeZone
 */
export function getDateStringInTimezone(date, timeZone = 'Asia/Ho_Chi_Minh') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Filter events by time window, impact, and currency
 */
export function filterEvents(events, options = {}) {
  const {
    fromTime = null,
    toTime = null,
    exactDay = null, // 'YYYY-MM-DD'
    timeZone = 'Asia/Ho_Chi_Minh',
    minImpact = 'Medium', // 'High' | 'Medium' | 'Low'
    currencies = [] // e.g. ['USD', 'EUR', 'GBP']
  } = options;

  const minLevel = IMPACT_CONFIG[minImpact]?.level ?? 2;
  const currencySet = currencies.length > 0
    ? new Set(currencies.map(c => c.toUpperCase()))
    : null;

  return events.filter(item => {
    // Check Impact
    const impactInfo = IMPACT_CONFIG[item.impact] || { level: 0 };
    if (impactInfo.level < minLevel) {
      return false;
    }

    // Check Currency
    if (currencySet) {
      const country = (item.country || '').toUpperCase();
      if (!currencySet.has(country) && country !== 'ALL') {
        return false;
      }
    }

    const eventDate = new Date(item.date);
    const eventTime = eventDate.getTime();
    if (isNaN(eventTime)) return false;

    // Check Exact Day match if specified
    if (exactDay) {
      const eventDayStr = getDateStringInTimezone(eventDate, timeZone);
      if (eventDayStr !== exactDay) {
        return false;
      }
    }

    // Check Time range
    if (fromTime && eventTime < fromTime) return false;
    if (toTime && eventTime > toTime) return false;

    return true;
  });
}

/**
 * Format a single event for Telegram
 */
export function formatSingleEvent(event, timeZone = 'Asia/Ho_Chi_Minh') {
  const impactInfo = IMPACT_CONFIG[event.impact] || { icon: '⚪' };
  const flag = CURRENCY_FLAGS[event.country?.toUpperCase()] || `💱 ${event.country || 'N/A'}`;
  
  const eventDate = new Date(event.date);
  const timeStr = eventDate.toLocaleTimeString('vi-VN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  let text = `${impactInfo.icon} <b>${timeStr}</b> | <b>${flag}</b>\n`;
  text += `   📌 <b>${escapeHtml(event.title)}</b>\n`;

  const details = [];
  if (event.forecast) details.push(`Dự báo: <code>${escapeHtml(event.forecast)}</code>`);
  if (event.previous) details.push(`Trước: <code>${escapeHtml(event.previous)}</code>`);
  
  if (details.length > 0) {
    text += `   📊 ${details.join(' | ')}\n`;
  }

  return text;
}

/**
 * Build a full Telegram message
 */
export function buildTelegramMessage({
  title,
  events,
  timeZone = 'Asia/Ho_Chi_Minh',
  note = ''
}) {
  if (!events || events.length === 0) {
    return null;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  let message = `🔔 <b>${title}</b>\n`;
  message += `📅 <i>${dateStr} (Giờ VN)</i>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Sort events by time
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(ev => {
    message += formatSingleEvent(ev, timeZone) + '\n';
  });

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <i>🔴 Tin Đỏ (High) | 🟠 Tin Cam (Medium)</i>`;
  if (note) {
    message += `\n⚠️ <i>${note}</i>`;
  }

  return message;
}

/**
 * Escape HTML special characters for Telegram HTML parse_mode
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
