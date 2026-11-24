
/* =====================================================
   TawasulNet2 - Secure Service Worker
   Next.js 14.2.5
   Purpose:
   - Offline fallback
   - Cache static application assets only
   - Never cache private or financial data
===================================================== */

const CACHE_PREFIX = 'tawasulnet2-static-';

const CACHE_VERSION = 'v1-20261123';

const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const OFFLINE_URL = '/offline';

// الملفات الأساسية التي يسمح بتخزينها
const PRECACHE_URLS = [
  OFFLINE_URL,
];

// مسارات الملفات الثابتة المسموح بتخزينها
const STATIC_PATHS = [
  '/_next/static/',
  '/icons/',
];

// ملفات الأيقونات الموجودة في public/icons
const ICON_FILES = [
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// أنواع الملفات الثابتة المسموح بتخزينها
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.ico',
];

// النطاقات التي يجب عدم التدخل في طلباتها
const EXTERNAL_PROTECTED_HOSTS = [
  'supabase.co',
  'adsterra.com',
  'publift.com',
];

/* =====================================================
   Helpers
===================================================== */

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isProtectedRequest(url) {
  const hostname = url.hostname.toLowerCase();

  return EXTERNAL_PROTECTED_HOSTS.some((host) =>
    hostname === host || hostname.endsWith('.' + host)
  );
}

// استثناء المسارات الحساسة وطلبات API
function isSensitivePath(pathname) {
  const path = pathname.toLowerCase();

  const blockedPaths = [
    '/api/',
    '/login',
    '/signup',
    '/admin',
    '/distributor',
    '/dashboard',
    '/auth/',
    '/rest/',
    '/storage/',
    '/functions/',
  ];

  return blockedPaths.some((blocked) =>
    path === blocked.replace(/\/$/, '') ||
    path.startsWith(blocked)
  );
}

// تحديد الملفات الثابتة المسموح بتخزينها
function isAllowedStaticAsset(url, request) {
  if (!isSameOrigin(url)) return false;

  if (isProtectedRequest(url)) return false;

  if (isSensitivePath(url.pathname)) return false;

  if (url.search) return false;

  const pathname = url.pathname;

  const isNextStatic = pathname.startsWith('/_next/static/');

  const isIconPath = pathname.startsWith('/icons/');

  const isKnownIcon = ICON_FILES.includes(pathname);

  if (!isNextStatic && !isIconPath && !isKnownIcon) {
    return false;
  }

  const hasAllowedExtension = STATIC_EXTENSIONS.some(
    (extension) => pathname.toLowerCase().endsWith(extension)
  );

  if (!hasAllowedExtension) return false;

  // لا نخزن صفحات HTML
  if (request.destination === 'document') return false;

  return true;
}

/* =====================================================
   Install
===================================================== */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // تخزين صفحة Offline فقط
      try {
        const response = await fetch(OFFLINE_URL, {
          cache: 'reload',
          credentials: 'same-origin',
        });

        if (
          response.ok &&
          response.type === 'basic'
        ) {
          await cache.put(OFFLINE_URL, response);
        }
      } catch (error) {
        // لا نفشل تثبيت Service Worker إذا تعذر تحميل الصفحة
        console.warn(
          '[TawasulNet2 SW] Offline page unavailable during install.'
        );
      }

      // تخزين الأيقونات الموجودة فعلياً فقط
      for (const iconPath of ICON_FILES) {
        try {
          const response = await fetch(iconPath, {
            cache: 'reload',
            credentials: 'same-origin',
          });

          if (
            response.ok &&
            response.type === 'basic'
          ) {
            await cache.put(iconPath, response);
          }
        } catch (error) {
          // تجاهل الأيقونات غير الموجودة
        }
      }

      await self.skipWaiting();
    })()
  );
});

/* =====================================================
   Activate
===================================================== */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      // حذف إصدارات Service Worker القديمة الخاصة بهذا التطبيق فقط
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith(CACHE_PREFIX) &&
            cacheName !== CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }

          return Promise.resolve(false);
        })
      );

      await self.clients.claim();
    })()
  );
});

/* =====================================================
   Fetch
===================================================== */

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // طلبات القراءة فقط
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // عدم التدخل في المواقع الخارجية
  if (!isSameOrigin(url)) return;

  // استثناء الإعلانات والخدمات الخارجية المحمية
  if (isProtectedRequest(url)) return;

  // عدم تخزين أو اعتراض API والصفحات الحساسة
  if (isSensitivePath(url.pathname)) return;

  // التعامل مع صفحات الموقع
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // محاولة الاتصال بالموقع أولاً
          return await fetch(request);
        } catch (error) {
          // عند انقطاع الإنترنت عرض صفحة Offline فقط
          const cache = await caches.open(CACHE_NAME);

          const offlinePage = await cache.match(OFFLINE_URL);

          if (offlinePage) {
            return offlinePage;
          }

          // صفحة احتياطية بسيطة إذا لم تكن صفحة Offline مخزنة
          return new Response(
            `<!DOCTYPE html>
            <html lang="ar" dir="rtl">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>غير متصل بالإنترنت</title>
              </head>
              <body style="font-family:Arial,sans-serif;text-align:center;padding:40px;direction:rtl">
                <h2>لا يوجد اتصال بالإنترنت</h2>
                <p>يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.</p>
                <button onclick="location.reload()">إعادة المحاولة</button>
              </body>
            </html>`,
            {
              status: 503,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
              },
            }
          );
        }
      })()
    );

    return;
  }

  // لا يتم تخزين أي شيء سوى الملفات الثابتة المسموح بها
  if (!isAllowedStaticAsset(url, request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        // تخزين الاستجابة الصحيحة فقط
        if (
          response.ok &&
          response.status === 200 &&
          response.type === 'basic' &&
          !response.headers.has('Set-Cookie')
        ) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        // لا نقدم بيانات قديمة بدلاً من طلب فشل
        return new Response('الملف غير متاح حالياً', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    })()
  );
});
