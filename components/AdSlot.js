
'use client';

import { useEffect, useRef } from 'react';

/*
 * =========================================================
 * نظام الإعلانات المركزي — شبكة تواصل
 * =========================================================
 *
 * مزود الإعلان:
 * Adsterra
 *
 * أماكن العرض:
 * - لوحة المدير
 * - لوحة الموزع
 *
 * لا توجد أي صلاحيات خاصة داخل هذا الملف.
 * لا يتم تعديل قاعدة البيانات أو RLS.
 * =========================================================
 */

/*
 * =========================================================
 * إعدادات Adsterra
 * =========================================================
 */

const ADSTERRA_AD_SRC =
  'https://bauval.org/21/a6f283f58e36528c1b39b2284d1efec6';

const ADSTERRA_CONTAINER_ID =
  'container-a6f283f58e36528c1b39b2284d1efec6';

/*
 * =========================================================
 * مكوّن الإعلان المركزي
 * =========================================================
 */

function AdsterraAd({ compact = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    // منع تحميل الإعلان أكثر من مرة داخل المكوّن.
    if (container.dataset.loaded === 'true') {
      return;
    }

    container.dataset.loaded = 'true';

    const script = document.createElement('script');

    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_AD_SRC;

    // إنشاء الحاوية التي يستخدمها Adsterra.
    const adContainer = document.createElement('div');

    adContainer.id = ADSTERRA_CONTAINER_ID;
    adContainer.style.width = '100%';

    // ترتيب عناصر كود Adsterra الأصلي.
    container.appendChild(script);
    container.appendChild(adContainer);

    return () => {
      // إزالة الإعلان عند مغادرة الصفحة.
      try {
        script.remove();
        adContainer.remove();
      } catch {
        // تجاهل أخطاء الإزالة.
      }

      container.dataset.loaded = 'false';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="إعلان"
      style={{
        width: '100%',
        minHeight: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        background: 'var(--surface-2)',
        overflow: 'visible',
      }}
    />
  );
}

/*
 * =========================================================
 * مكوّن محتوى الإعلان
 * =========================================================
 */

function AdContent({
  compact = false,
  title = 'المساحة الإعلانية',
  subtitle = '',
}) {
  return (
    <div
      className="panel"
      style={{
        margin: 0,
        padding: compact ? '14px 18px' : 18,
      }}
    >
      <div
        className="panel-head"
        style={{
          marginBottom: compact ? 10 : 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <h3>{title}</h3>

        {subtitle && (
          <span className="muted">
            {subtitle}
          </span>
        )}
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 300,
          margin: '0 auto',
        }}
      >
        <AdsterraAd compact={compact} />
      </div>
    </div>
  );
}

/*
 * =========================================================
 * إعلان المدير
 * =========================================================
 *
 * يستخدم داخل:
 * app/admin/page.js
 *
 * لا يحتاج إلى تعديل طريقة استدعائه.
 * =========================================================
 */

export function AdSlotAdmin() {
  return (
    <div
      className="panel"
      style={{
        marginTop: 20,
      }}
    >
      <div
        className="panel-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <h3>المساحة الإعلانية</h3>

        <span className="muted">
          خاصة بالمدير
        </span>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 300,
          margin: '0 auto',
        }}
      >
        <AdsterraAd />
      </div>
    </div>
  );
}

/*
 * =========================================================
 * إعلان الموزع
 * =========================================================
 *
 * يستخدم داخل:
 * app/distributor/page.js
 *
 * لا يحتاج إلى تعديل طريقة استدعائه.
 * =========================================================
 */

export function AdSlotBar() {
  return (
    <div
      className="panel"
      style={{
        padding: '14px 18px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 18,
            }}
          >
            📺
          </span>

          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              fontWeight: 600,
            }}
          >
            مساحة إعلانية
          </span>
        </div>

        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-soft)',
          }}
        >
          إعلان مدعوم
        </span>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 300,
          margin: '0 auto',
        }}
      >
        <AdsterraAd compact />
      </div>
    </div>
  );
}
