import { fetchCalendar, filterEvents, buildTelegramMessage } from './lib/forexfactory.js';

async function runTest() {
  console.log('🔄 Đang kiểm tra kết nối tới Forex Factory...');
  const events = await fetchCalendar();
  console.log(`✅ Lấy thành công ${events.length} sự kiện trong tuần!`);

  console.log('\n--- MẪU 3 SỰ KIỆN ĐẦU TIÊN ---');
  console.log(events.slice(0, 3));

  console.log('\n--- LỌC TIN HÔM NAY (Medium + High) ---');
  const now = Date.now();
  const timeZone = 'Asia/Ho_Chi_Minh';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayDateStr = formatter.format(new Date(now));
  const startOfDay = new Date(`${todayDateStr}T00:00:00+07:00`).getTime();
  const endOfDay = new Date(`${todayDateStr}T23:59:59+07:00`).getTime();

  const todayEvents = filterEvents(events, {
    fromTime: startOfDay,
    toTime: endOfDay,
    minImpact: 'Medium',
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF']
  });

  console.log(`Tìm thấy ${todayEvents.length} sự kiện hôm nay.`);

  const message = buildTelegramMessage({
    title: 'LỊCH TIN KINH TẾ HÔM NAY',
    events: todayEvents.slice(0, 5), // take first 5
    timeZone,
    note: 'Demo tin tức hiển thị trên Telegram'
  });

  console.log('\n--- NỘI DUNG TIN NHẮN TELEGRAM SẼ GỬI ---');
  console.log(message);
}

runTest().catch(console.error);
