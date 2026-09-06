'use client';

import { useEffect, useRef } from 'react';

/*
 * =========================================================
 * نظام الإعلانات المركزي — شبكة تواصل
 * =========================================================
 *
 * مزود الإعلان:
 * HilltopAds
 *
 * نوع المنطقة:
 * MultiTag 300x250
 *
 * يستخدم في:
 * - لوحة المدير
 * - لوحة الموزع
 *
 * لا توجد أي صلاحيات خاصة داخل هذا الملف.
 * هذا الملف لا يعدل قاعدة البيانات ولا RLS.
 * =========================================================
 */

/*
 * =========================================================
 * HilltopAds
 * =========================================================
 */

const HILLTOP_AD_SRC =
  '//quarrelsomebitter.com/b_XqVrsed.G/ly0HY/W_ca/de/mm9JuFZvUQl/kMPgTQcPz/OKTEEp3pMFjKkLtCN/zkM/5qMQTNcDzhM/wv';

function HilltopAd({ compact = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    /*
     * منع تحميل نفس الإعلان أكثر من مرة داخل
     * نفس المكوّن.
     */
    if (container.dataset.loaded === 'true') {
      return;
    }

    container.dataset.loaded = 'true';

    const script = document.createElement('script');

    script.settings = {};

    script.src = HILLTOP_AD_SRC;
    script.async = true;
    script.referrerPolicy = 'no-referrer-when-downgrade';

    container.appendChild(script);

    return () => {
      /*
       * إزالة السكربت عند مغادرة الصفحة.
       * هذا يمنع تراكم نسخ متعددة منه أثناء
       * التنقل داخل التطبيق.
       */
      try {
        script.remove();
      } catch {
        // تجاهل خطأ الإزالة إن لم يعد العنصر موجودًا.
      }

      if (container) {
        container.dataset.loaded = 'false';
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="إعلان"
      style={{
        width: '100%',
        minHeight: compact ? 100 : 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
        background: 'var(--surface-2)',
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
        <HilltopAd compact={compact} />
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
 * لا يحتاج إلى أي تعديل في صفحة المدير.
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
        <HilltopAd />
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
 * لا يحتاج إلى أي تعديل في صفحة الموزع.
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
        <HilltopAd compact />
      </div>
    </div>
  );
}
