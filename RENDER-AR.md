# تجهيز KANEKI BOT على Render

## إعدادات الخدمة
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Node.js: 22 أو أحدث (محدد في package.json)

## التخزين الدائم (مهم)
أنشئ Persistent Disk في Render واربطه على المسار `/var/data`.

## متغيرات البيئة
أضف في Environment:
- `PHONE_NUMBER`: رقم واتساب المراد ربطه مع مفتاح الدولة، أرقام فقط مثل `9665XXXXXXXX` أو `249XXXXXXXXX` (بدون +).
- `OWNER_NUMBER`: رقم المالك مع مفتاح الدولة، أرقام فقط. يمكن وضع أكثر من رقم مفصولاً بفاصلة.
- `SESSION_DIR`: `/var/data/sessions/main`
- `BOT_DB_PATH`: `/var/data/vito.sqlite`

بعد الحفظ، نفّذ Manual Deploy. راقب Logs للحصول على Pairing Code. لا تشارك رمز الاقتران أو مجلد sessions مع أي شخص.

## تنبيه
هذا التعديل يمرر رقم الربط من متغير `PHONE_NUMBER` مباشرة، لتجنب أسئلة الطرفية التفاعلية التي لا تناسب خدمة Render. لم يتم اختبار اتصال واتساب الفعلي؛ يلزم إكمال الربط ومراجعة Logs.
