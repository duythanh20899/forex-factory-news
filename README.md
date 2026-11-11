# 📈 ForexFactory Economic Calendar Telegram Bot (Vercel + Cron-job.org)

Bot Telegram tự động cập nhật và cảnh báo lịch kinh tế từ **ForexFactory.com** chạy trên **Vercel Serverless Function** kết hợp với **Cron-job.org**.

---

## 🌟 Tính năng nổi bật

1. **Chuẩn Serverless & Tiết kiệm 100% chi phí:**
   - Không cần thuê VPS, không sợ đầy RAM hay crash server.
   - Chạy trên gói miễn phí (Hobby) của Vercel vĩnh viễn.
2. **Dữ liệu chuẩn từ ForexFactory:**
   - Lấy trực tiếp từ nguồn FairEconomy/ForexFactory JSON feed chính thống, cực nhanh (< 200ms), không lo bị chặn Cloudflare hay Captcha.
3. **Cảnh báo thông minh:**
   - 🔴 **Tin Đỏ (High)** & 🟠 **Tin Cam (Medium)**: Tự động gắn cờ quốc gia (🇺🇸 USD, 🇪🇺 EUR, 🇬🇧 GBP,...), giờ Việt Nam (GMT+7), số liệu Dự báo (Forecast) & Trước đó (Previous).
   - Quét trước giờ ra tin (ví dụ: cảnh báo trước 15 - 30 phút).
   - Tự động bỏ qua nếu không có tin, không gây spam kênh chat.
4. **Hỗ trợ Chatbot 2 chiều (Interactive Webhook):**
   - Chat trực tiếp với Bot bằng các lệnh: `/today`, `/upcoming`, `/high`, `/all`, `/id`.
5. **Bảo mật với `CRON_SECRET`:**
   - Ngăn chặn người lạ spam đường dẫn API của bạn.

---

## 📂 Cấu trúc dự án

```text
forex-factory-news/
├── api/
│   ├── check-news.js    # Endpoint API cho Cron-job.org gọi định kỳ
│   └── webhook.js       # Endpoint nhận tin nhắn và lệnh từ Telegram
├── lib/
│   ├── forexfactory.js  # Lấy dữ liệu, lọc tin theo múi giờ & định dạng tin nhắn HTML
│   └── telegram.js      # Gửi tin nhắn đến Telegram Bot API (tự động cắt tin nếu dài)
├── .env.example         # File mẫu cấu hình biến môi trường
├── package.json
├── test.js              # File test lấy dữ liệu và hiển thị định dạng ở local
├── vercel.json          # Cấu hình Vercel Serverless
└── README.md
```

---

## 🛠 Hướng dẫn cài đặt từng bước

### Bước 1: Tạo Telegram Bot và lấy Chat ID

1. Mở Telegram, tìm kiếm **`@BotFather`** và bấm `/start`.
2. Gửi lệnh `/newbot`, đặt tên cho Bot và username kết thúc bằng `bot` (ví dụ: `my_forex_news_bot`).
3. BotFather sẽ cấp cho bạn một **API Token** có dạng: `7123456789:AAFx...` -> Đây chính là `TELEGRAM_BOT_TOKEN`.
4. Tìm và bấm **Start** với con bot bạn vừa tạo.
5. Để lấy `TELEGRAM_CHAT_ID`:
   - Chat với bot **`@userinfobot`** trên Telegram để thấy ngay `Id` của bạn.
   - Nếu muốn gửi vào **Group/Kênh**: Thêm bot vào nhóm, cấp quyền Admin, gửi 1 tin nhắn bất kỳ vào nhóm rồi dùng bot `@RawDataBot` để xem ID nhóm (ID nhóm thường bắt đầu bằng dấu trừ, ví dụ `-100123456789`).

---

### Bước 2: Triển khai (Deploy) lên Vercel

#### Cách 1: Triển khai qua Vercel CLI (Nhanh nhất)
1. Cài đặt Vercel CLI (nếu chưa có):
   ```bash
   npm install -g vercel
   ```
2. Đứng tại thư mục dự án và gõ:
   ```bash
   vercel
   ```
3. Làm theo hướng dẫn trên màn hình để liên kết tài khoản Vercel.
4. Triển khai bản chính thức (Production):
   ```bash
   vercel --prod
   ```
   Bạn sẽ nhận được URL ứng dụng, ví dụ: `https://my-forex-bot.vercel.app`.

#### Cách 2: Triển khai qua GitHub
1. Tạo một repository mới trên GitHub và push mã nguồn này lên.
2. Đăng nhập [vercel.com](https://vercel.com), bấm **Add New** -> **Project**.
3. Chọn repo GitHub vừa tạo và bấm **Deploy**.

---

### Bước 3: Cài đặt Biến Môi Trường (Environment Variables) trên Vercel

Vào Vercel Dashboard -> Chọn Project của bạn -> **Settings** -> **Environment Variables**, thêm các biến sau:

| Tên biến | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | `7123456789:AAFx...` | Token bot lấy từ BotFather |
| `TELEGRAM_CHAT_ID` | `123456789` hoặc `-100...` | ID chat hoặc ID nhóm nhận tin |
| `CRON_SECRET` | `forex_secret_token_2026` | Mã bí mật bảo vệ URL API (tùy chọn) |
| `MIN_IMPACT` | `Medium` | Mức tin tối thiểu: `High`, `Medium`, hoặc `Low` |
| `CURRENCIES` | `USD,EUR,GBP,JPY,CAD,AUD,NZD,CHF` | Các đồng tiền cần theo dõi |
| `TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ hiển thị (Mặc định: Giờ VN) |
| `WINDOW_MINUTES` | `30` | Khoảng thời gian quét trước giờ ra tin (phút) |

> 💡 *Sau khi thêm biến môi trường, hãy vào tab **Deployments** -> bấm vào dấu 3 chấm cạnh bản deploy mới nhất -> **Redeploy** để Vercel cập nhật các biến này.*

---

### Bước 4: Thiết lập Cron-job.org

Đăng ký tài khoản miễn phí tại [cron-job.org](https://cron-job.org) và tạo các lịch quét tự động:

#### Job 1: Cảnh báo trước giờ ra tin (Khuyên dùng)
- **Title**: `ForexFactory Upcoming Alert`
- **URL**: 
  - Nếu có dùng `CRON_SECRET`:
    ```
    https://<domain-cua-ban>.vercel.app/api/check-news?mode=upcoming&window=30&secret=forex_secret_token_2026
    ```
  - Nếu không dùng `CRON_SECRET`:
    ```
    https://<domain-cua-ban>.vercel.app/api/check-news?mode=upcoming&window=30
    ```
- **Schedule**: Chạy mỗi **15 phút** một lần (hoặc 10 phút, 30 phút tùy bạn muốn).
- **Request Method**: `GET`
- 👉 *Cơ chế*: Mỗi lần chạy, API sẽ kiểm tra xem trong `window` (ví dụ 30 phút) tới có tin đỏ/cam nào không. Nếu có thì bắn tin nhắn cảnh báo đến Telegram, nếu không có thì trả về JSON 200 im lặng, không làm phiền người dùng.

#### Job 2: Điểm tin tổng hợp buổi sáng (Tùy chọn)
- **Title**: `ForexFactory Morning Briefing`
- **URL**:
  ```
  https://<domain-cua-ban>.vercel.app/api/check-news?mode=today&secret=forex_secret_token_2026
  ```
- **Schedule**: Chạy định kỳ vào **07:00 sáng** hàng ngày (từ Thứ 2 đến Thứ 6).
- 👉 *Cơ chế*: Gửi một bảng tổng hợp tất cả các tin kinh tế quan trọng trong ngày hôm đó để bạn lên kế hoạch giao dịch.

---

### Bước 5: Kích hoạt tính năng Chat tương tác (Webhook - Tùy chọn)

Nếu bạn muốn chat trực tiếp với bot bằng các lệnh `/today`, `/high`, `/upcoming`:
Gõ lệnh này trên Terminal (hoặc trình duyệt) để cài đặt Webhook cho Telegram:

```bash
curl -F "url=https://<domain-cua-ban>.vercel.app/api/webhook" https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

Khi nhận được phản hồi `{"ok":true,"result":true,"description":"Webhook was set"}`, bạn đã hoàn tất! Bây giờ hãy mở Telegram và gửi `/today` cho bot để thử nghiệm!

---

## 🧪 Chạy thử nghiệm ở Local

Bạn có thể chạy thử trực tiếp trên máy tính để xem định dạng tin tức:

```bash
node test.js
```
