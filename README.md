# تواصل — نظام إدارة وتوزيع كروت الشبكة

## الحالة: المشروع كامل بكل الميزات المتفق عليها ✅

### صفحات المدير
- `app/admin/page.js` — نظرة عامة + إحصائيات حية + خانة الإعلانات
- `app/admin/cards/page.js` — إضافة كروت يدويًا، عرض المخزون، حذف فردي أو جماعي (بالتحديد أو بالتاريخ)
- `app/admin/cards/import/page.js` — رفع PDF، استخراج الأكواد تلقائيًا، مراجعتها، ثم تأكيد الإضافة لباقة معيّنة
- `app/admin/packages/page.js` — إضافة/عرض الباقات وأسعارها
- `app/admin/requests/page.js` — قبول أو رفض طلبات الموزعين (القبول يخصم الرصيد ويعيّن الكروت تلقائيًا وبأمان)
- `app/admin/distributors/page.js` — قبول/رفض حسابات الموزعين الجدد + عرض الكل

### صفحات الموزع
- `app/distributor/page.js` — الرصيد، الباقات المتاحة لديه، شريط الإعلان غير المزعج
- `app/distributor/request/page.js` — طلب كروت جديدة من المدير + سجل الطلبات
- `app/distributor/sales/page.js` — تسجيل كرت كمباع + عرض المبيعات لآخر 24 ساعة فقط (تختفي تلقائيًا بعدها)

### الأساسيات
- `supabase/schema.sql` — قاعدة البيانات كاملة: الجداول + الحماية (RLS) + دوال آمنة لخصم الرصيد وتعيين الكروت بشكل ذري (fulfill_request, reject_request, sell_card)
- `app/api/import-pdf/route.js` — استخراج أرقام الكروت من ملف PDF بشكل آمن على السيرفر
- `components/Sidebar.js`, `components/AdSlot.js`, `lib/useProfile.js` — عناصر مشتركة لتقليل تكرار الكود

## خطوات التشغيل محليًا
```bash
npm install
cp .env.local.example .env.local   # ثم عبّي القيم من Supabase
npm run dev
```

## إعداد Supabase (مرة واحدة)
1. أنشئ مشروعًا مجانيًا في https://supabase.com
2. من SQL Editor، شغّل ملف `supabase/schema.sql` كاملاً
3. من Project Settings -> API، انسخ `Project URL` و `anon public key` إلى `.env.local`
4. أنشئ أول حساب أدمن: سجّل من `/signup`، ثم من Table Editor غيّر في جدول `profiles`
   لهذا الحساب: `role` إلى `admin` و `status` إلى `approved`

## رفع المشروع إلى GitHub
```bash
git init
git add .
git commit -m "المشروع كامل: كل الميزات المتفق عليها"
git branch -M main
git remote add origin <رابط الريبو الفارغ من GitHub>
git push -u origin main
```

## النشر المجاني على Vercel
1. اربط حساب GitHub بـ https://vercel.com
2. Import Project -> اختر هذا الريبو
3. أضف نفس متغيرات `.env.local` في Environment Variables بـ Vercel
4. Deploy

## تفعيل خانة الإعلانات لاحقًا
افتح `components/AdSlot.js` وضع كود الإعلان (من AdSense أو أي شبكة) داخل
`<div id="ad-slot-admin">` أو `<div id="ad-slot-distributor">` — يعمل تلقائيًا 24 ساعة.

## ملاحظات أمان مهمة
- كل كلمات المرور مشفّرة تلقائيًا عبر نظام Supabase Auth (لا تُخزَّن كنص عادي أبدًا)
- كل موزع يرى بياناته فقط عبر قواعد RLS، حتى لو حاول التلاعب بالرابط
- خصم الرصيد وتعيين الكروت يتم داخل دالة قاعدة بيانات واحدة (atomic) لمنع أي تلاعب أو تكرار
- اتصال HTTPS تلقائي بعد النشر على Vercel

## للعودة لإكمال أو تعديل المشروع في محادثة جديدة مع Claude
ارفق هذا المجلد (أو رابط GitHub) وقل: "هذا مشروع تواصل الكامل، أريد تعديل/إضافة كذا"
