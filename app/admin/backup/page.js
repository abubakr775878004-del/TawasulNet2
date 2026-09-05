'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BackupPage() {
  const fileInputRef = useRef(null);

  const [loadingBackup, setLoadingBackup] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [backupInfo, setBackupInfo] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = '/login';
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .maybeSingle();

      if (
        profileError ||
        profile?.role !== 'admin' ||
        profile?.status !== 'active'
      ) {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Backup page admin check failed:', err);
      window.location.href = '/';
    }
  }

  async function createBackup() {
    setLoadingBackup(true);
    setMessage('');
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.'
        );
      }

      const response = await fetch('/api/admin/backup/database', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        let errorMessage =
          'حدث خطأ أثناء إنشاء النسخة الاحتياطية.';

        try {
          const data = await response.json();

          if (data?.error) {
            errorMessage = data.error;
          }
        } catch {
          // تجاهل خطأ قراءة JSON
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      const contentDisposition =
        response.headers.get('Content-Disposition') || '';

      let filename = `tawasul-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      const filenameMatch = contentDisposition.match(
        /filename="?([^"]+)"?/i
      );

      if (filenameMatch?.[1]) {
        filename = filenameMatch[1];
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage(
        'تم إنشاء النسخة الاحتياطية وتحميلها بنجاح.'
      );
    } catch (err) {
      setError(
        err?.message ||
          'حدث خطأ غير متوقع أثناء إنشاء النسخة الاحتياطية.'
      );
    } finally {
      setLoadingBackup(false);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    setSelectedFile(null);
    setBackupInfo(null);
    setMessage('');
    setError('');
    setConfirmed(false);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError(
        'يرجى اختيار ملف النسخة الاحتياطية بصيغة JSON.'
      );
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('ملف النسخة الاحتياطية غير صالح.');
      }

      /*
       * نتحقق أن الملف يبدو كنسخة احتياطية صادرة
       * من نظامنا، بدل قبول أي JSON عشوائي.
       */
      if (
        data.backup_type &&
        data.backup_type !== 'tawasul_net_database_data'
      ) {
        throw new Error(
          'نوع ملف النسخة الاحتياطية غير متوافق مع نظام شبكة تواصل.'
        );
      }

      setSelectedFile(file);

      setBackupInfo({
        createdAt:
          data.created_at ||
          data.createdAt ||
          data.timestamp ||
          'غير محدد',

        tables:
          data.tables && typeof data.tables === 'object'
            ? Object.entries(data.tables).map(
                ([name, value]) => ({
                  name,
                  count: Array.isArray(value)
                    ? value.length
                    : Array.isArray(value?.rows)
                      ? value.rows.length
                      : Array.isArray(value?.data)
                        ? value.data.length
                        : 0,
                })
              )
            : [],
      });
    } catch (err) {
      setError(
        err?.message ||
          'تعذر قراءة ملف النسخة الاحتياطية. تأكد من أن الملف صحيح.'
      );
    }
  }

  /*
   * لا يوجد حاليًا Route فعلي للاستعادة:
   * /api/admin/backup/restore
   *
   * لذلك لا ننفذ أي طلب استعادة حتى يتم إنشاء
   * API آمن ومراجعته بشكل منفصل.
   *
   * هذا يمنع الصفحة من إرسال ملف إلى مسار غير موجود
   * أو من إنشاء أي عملية استعادة غير آمنة.
   */
  function restoreBackup() {
    setMessage('');
    setError(
      'استعادة النسخة الاحتياطية غير مفعلة حاليًا. سيتم تفعيلها بعد إنشاء Route آمن للاستعادة.'
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#f4f7f6',
        padding: '30px',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        {/* العنوان */}
        <div
          style={{
            background: '#fff',
            borderRadius: '18px',
            padding: '25px',
            marginBottom: '25px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '800',
              color: '#172033',
            }}
          >
            النسخ الاحتياطي والاستعادة
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            إدارة النسخ الاحتياطية لبيانات نظام شبكة تواصل واستعادتها بطريقة آمنة.
          </p>
        </div>

        {/* الرسائل */}
        {message && (
          <div
            style={{
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              borderRadius: '14px',
              padding: '15px 18px',
              marginBottom: '20px',
              fontWeight: '600',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '14px',
              padding: '15px 18px',
              marginBottom: '20px',
              fontWeight: '600',
            }}
          >
            {error}
          </div>
        )}

        {/* البطاقات */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '22px',
          }}
        >
          {/* إنشاء نسخة */}
          <section
            style={{
              background: '#fff',
              borderRadius: '18px',
              padding: '25px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                width: '55px',
                height: '55px',
                borderRadius: '15px',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '27px',
                marginBottom: '16px',
              }}
            >
              💾
            </div>

            <h2
              style={{
                margin: '0 0 10px',
                color: '#172033',
                fontSize: '21px',
              }}
            >
              إنشاء نسخة احتياطية
            </h2>

            <p
              style={{
                color: '#64748b',
                lineHeight: 1.8,
                marginBottom: '22px',
              }}
            >
              إنشاء نسخة من بيانات النظام وحفظها كملف JSON على جهازك.
            </p>

            <button
              type="button"
              onClick={createBackup}
              disabled={loadingBackup}
              style={{
                width: '100%',
                border: 0,
                borderRadius: '12px',
                padding: '13px 18px',
                background:
                  loadingBackup ? '#94a3b8' : '#1e40af',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loadingBackup
                  ? 'not-allowed'
                  : 'pointer',
              }}
            >
              {loadingBackup
                ? 'جاري إنشاء النسخة...'
                : 'إنشاء وتحميل النسخة الاحتياطية'}
            </button>
          </section>

          {/* الاستعادة */}
          <section
            style={{
              background: '#fff',
              borderRadius: '18px',
              padding: '25px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                width: '55px',
                height: '55px',
                borderRadius: '15px',
                background: '#f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '27px',
                marginBottom: '16px',
              }}
            >
              ♻️
            </div>

            <h2
              style={{
                margin: '0 0 10px',
                color: '#172033',
                fontSize: '21px',
              }}
            >
              استعادة نسخة احتياطية
            </h2>

            <p
              style={{
                color: '#64748b',
                lineHeight: 1.8,
                marginBottom: '18px',
              }}
            >
              اختر ملف النسخة الاحتياطية لمراجعته. لن يتم تنفيذ أي استعادة
              من هذه الصفحة حاليًا.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{
                width: '100%',
                marginBottom: '18px',
              }}
            />

            {backupInfo && (
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '15px',
                  marginBottom: '18px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontWeight: '700',
                    color: '#334155',
                    marginBottom: '8px',
                  }}
                >
                  معلومات النسخة
                </div>

                <div
                  style={{
                    color: '#64748b',
                    fontSize: '14px',
                    marginBottom: '10px',
                  }}
                >
                  تاريخ الإنشاء: {backupInfo.createdAt}
                </div>

                {backupInfo.tables.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '7px',
                    }}
                  >
                    {backupInfo.tables.map((table) => (
                      <span
                        key={table.name}
                        style={{
                          background: '#e2e8f0',
                          color: '#334155',
                          padding: '5px 9px',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      >
                        {table.name}: {table.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedFile && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '9px',
                  marginBottom: '18px',
                  color: '#475569',
                  fontSize: '14px',
                  lineHeight: 1.7,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) =>
                    setConfirmed(event.target.checked)
                  }
                  style={{
                    marginTop: '5px',
                  }}
                />

                <span>
                  أؤكد أنني أريد استعادة هذه النسخة. سيتم تنفيذ الاستعادة
                  فقط بعد تفعيل API آمن ومخصص لها.
                </span>
              </label>
            )}

            <button
              type="button"
              onClick={restoreBackup}
              disabled={!selectedFile || !confirmed}
              style={{
                width: '100%',
                border: 0,
                borderRadius: '12px',
                padding: '13px 18px',
                background:
                  !selectedFile || !confirmed
                    ? '#cbd5e1'
                    : '#15803d',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                cursor:
                  !selectedFile || !confirmed
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              استعادة النسخة الاحتياطية
            </button>
          </section>
        </div>

        {/* تنبيه أمني */}
        <div
          style={{
            marginTop: '25px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '16px',
            padding: '18px',
            color: '#92400e',
            lineHeight: 1.8,
          }}
        >
          <strong>تنبيه مهم:</strong> النسخ الاحتياطي يعمل من خلال API محمي
          على الخادم. لا يتم وضع مفتاح Service Role داخل المتصفح، ولا يتم
          تنفيذ أي استعادة أو حذف شامل للبيانات من هذه الصفحة حاليًا.
        </div>
      </div>
    </div>
  );
}
