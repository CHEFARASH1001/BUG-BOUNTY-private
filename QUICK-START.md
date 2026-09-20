# 🚀 راهنمای سریع استفاده

## 1️⃣ ورود به سایت

### لینک سایت:
```
http://localhost:3000
```

### ساخت کاربر مدیر:
```bash
docker compose -f docker-compose.dev.yml exec backend npm run create-admin
```
اطلاعات ورود را با `ADMIN_EMAIL`، `ADMIN_PASSWORD` و `ADMIN_NAME` به‌صورت متغیر محیطی تعیین کن.

---

## 2️⃣ استفاده از بات تلگرام

### راه‌اندازی بات:
```bash
cd /home/arash-niknam/Desktop/BUG-BOUNTY
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
export TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
export PROXY_PORT=10808
node scripts/telegram-bot.js
```

### دستورات بات در تلگرام:
- `/status` - نمایش داشبورد کامل
- `/vulns` - لیست آسیب‌پذیری‌ها
- `/scans` - اسکن‌های اخیر
- `/programs` - برنامه‌های باگ بانتی
- `/help` - راهنما

### نام کاربری بات:
```
@ChefarashBot
```

---

## 3️⃣ وضعیت سرویس‌ها

همه سرویس‌ها در حال اجرا هستند:

| سرویس | پورت | آدرس |
|-------|------|------|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 4000 | http://localhost:4000 |
| MongoDB | 27017 | localhost:27017 |
| RabbitMQ Management | 15672 | http://localhost:15672 |
| RabbitMQ | 5672 | localhost:5672 |

---

## 4️⃣ دستورات مفید Docker

### مشاهده وضعیت کانتینرها:
```bash
docker ps
```

### مشاهده لاگ‌ها:
```bash
# لاگ بکند
docker logs bb-backend -f

# لاگ فرانت‌اند
docker logs bb-frontend -f
```

### ری‌استارت سرویس‌ها:
```bash
# ری‌استارت همه
docker compose -f docker-compose.dev.yml restart

# ری‌استارت بکند فقط
docker restart bb-backend

# ری‌استارت فرانت‌اند فقط
docker restart bb-frontend
```

### خاموش کردن همه:
```bash
docker compose -f docker-compose.dev.yml down
```

### روشن کردن همه:
```bash
docker compose -f docker-compose.dev.yml up -d
```

---

## 5️⃣ تست API

### تست لاگین:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "YOUR_EMAIL", "password": "YOUR_PASSWORD"}'
```

### چک کردن داشبورد:
```bash
curl http://localhost:4000/api/v1/reports/dashboard
```

---

## 🎯 اولین استفاده

1. مرورگر رو باز کن
2. به آدرس `http://localhost:3000` برو
3. با حسابی که ساخته‌ای وارد شو
4. از پنل Admin استفاده کن!

---

## 📱 نکات مهم

- **بات تلگرام:** حتما پروکسی روی پورت 10808 فعال باشه (Xray)
- **لاگین:** اگر مشکل داشتی، بکند رو ری‌استارت کن
- **پورت‌ها:** مطمئن شو پورت‌های 3000 و 4000 آزاد باشن

---

## 🆘 عیب‌یابی

### اگر سایت باز نشد:
```bash
docker logs bb-frontend -f
```

### اگر لاگین کار نکرد:
```bash
docker logs bb-backend -f
```

### اگر بات تلگرام وصل نشد:
```bash
# چک کردن پروکسی
ss -tlnp | grep 10808

# چک کردن بکند
curl http://localhost:4000/api/v1/reports/dashboard
```
