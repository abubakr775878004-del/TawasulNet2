
'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // التأكد من دعم Service Worker
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // السماح بالتسجيل عبر HTTPS أو localhost فقط
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    const isSecure = window.location.protocol === 'https:';

    if (!isSecure && !isLocalhost) {
      return;
    }

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        // منع تكرار التسجيل إذا كان مسجلاً بالفعل
        const existingRegistration =
          await navigator.serviceWorker.getRegistration('/');

        if (cancelled) return;

        if (
          existingRegistration &&
          existingRegistration.active &&
          existingRegistration.active.scriptURL.endsWith('/sw.js')
        ) {
          return;
        }

        // تسجيل Service Worker
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

      } catch (error) {
        // أخطاء التسجيل لا تؤثر على تشغيل الموقع
        console.warn(
          '[PWA] Service Worker registration failed:',
          error
        );
      }
    };

    registerServiceWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
