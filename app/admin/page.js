'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { AdSlotAdmin } from '../../components/AdSlot';
import WeeklyWinnerPanel from '../../components/WeeklyWinnerPanel';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
const { profile, loading } = useProfile('admin');

const [stats, setStats] = useState(null);

const [salesStats, setSalesStats] = useState({
totalRevenue: 0,
soldCardsCount: 0,
});

const [salesByPackage, setSalesByPackage] = useState({});
const [recentSales, setRecentSales] = useState([]);

const [backupLoading, setBackupLoading] = useState(false);
const [backupMessage, setBackupMessage] = useState('');
const [backupError, setBackupError] = useState('');

/*

* =========================================================
* الاستعادة
* =========================================================
  */

const [restoreFile, setRestoreFile] = useState(null);
const [restoreLoading, setRestoreLoading] = useState(false);
const [restoreMessage, setRestoreMessage] = useState('');
const [restoreError, setRestoreError] = useState('');
const [restorePreview, setRestorePreview] = useState(null);
const [restoreConfirmed, setRestoreConfirmed] = useState(false);

const formatNum = (num) => {
const val = Math.round(Number(num) || 0);

return val.toLocaleString('en-US', {
  maximumFractionDigits: 0,
});

};

async function loadData() {
try {
/*
* =========================================================
* 1. الإحصائيات الأساسية
* =========================================================
*/

  const [
    { count: totalCards, error: totalCardsError },
    { count: availableCards, error: availableCardsError },
    { count: activeDist, error: activeDistError },
    { count: pendingReq, error: pendingReqError },
  ] = await Promise.all([
    supabase
      .from('cards')
      .select('*', {
        count: 'exact',
        head: true,
      }),

    supabase
      .from('cards')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'available'),

    supabase
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('role', 'distributor')
      .eq('status', 'approved'),

    supabase
      .from('card_requests')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'pending'),
  ]);

  if (totalCardsError) {
    console.error(
      'Total cards error:',
      totalCardsError
    );
  }

  if (availableCardsError) {
    console.error(
      'Available cards error:',
      availableCardsError
    );
  }

  if (activeDistError) {
    console.error(
      'Active distributors error:',
      activeDistError
    );
  }

  if (pendingReqError) {
    console.error(
      'Pending requests error:',
      pendingReqError
    );
  }

  setStats({
    totalCards: totalCards ?? 0,
    availableCards: availableCards ?? 0,
    activeDist: activeDist ?? 0,
    pendingReq: pendingReq ?? 0,
  });

  /*
   * =========================================================
   * 2. المبيعات والإيرادات
   * =========================================================
   */

  const {
    data: soldList,
    error: soldError,
  } = await supabase
    .from('cards')
    .select(
      'id, code, sold_at, packages(name, price)'
    )
    .eq('status', 'sold')
    .order('sold_at', {
      ascending: false,
    });

  if (soldError) {
    console.error(
      'Sold cards error:',
      soldError
    );
  }

  let revenue = 0;
  let soldCount = 0;

  const pkgStats = {};

  (soldList || []).forEach((item) => {
    soldCount += 1;

    const price =
      Number(item.packages?.price) || 0;

    revenue += price;

    const pkgName =
      item.packages?.name || 'غير محدد';

    if (!pkgStats[pkgName]) {
      pkgStats[pkgName] = {
        count: 0,
        total: 0,
      };
    }

    pkgStats[pkgName].count += 1;
    pkgStats[pkgName].total += price;
  });

  setSalesStats({
    totalRevenue: revenue,
    soldCardsCount: soldCount,
  });

  setSalesByPackage(pkgStats);

  setRecentSales(
    (soldList || []).slice(0, 5)
  );
} catch (error) {
  console.error(
    'Admin dashboard loading error:',
    error
  );
}

}

/*

* =========================================================
* النسخ الاحتياطي
* =========================================================
  */

async function handleDatabaseBackup() {
if (backupLoading) {
return;
}

setBackupLoading(true);
setBackupMessage('');
setBackupError('');

try {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      'تعذر الحصول على جلسة تسجيل الدخول.'
    );
  }

  if (!session?.access_token) {
    throw new Error(
      'انتهت جلسة المدير. يرجى تسجيل الدخول مرة أخرى.'
    );
  }

  const response = await fetch(
    '/api/admin/backup/database',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    let errorMessage =
      'حدث خطأ أثناء إنشاء النسخة الاحتياطية.';

    try {
      const errorData =
        await response.json();

      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // تجاهل خطأ قراءة رسالة الخطأ
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();

  if (!blob || blob.size === 0) {
    throw new Error(
      'تم إنشاء استجابة فارغة ولم يتم تنزيل النسخة الاحتياطية.'
    );
  }

  const contentDisposition =
    response.headers.get(
      'Content-Disposition'
    );

  let filename =
    'tawasul-net-database-backup.json';

  if (contentDisposition) {
    const filenameMatch =
      contentDisposition.match(
        /filename="([^"]+)"/i
      );

    if (filenameMatch?.[1]) {
      filename = filenameMatch[1];
    }
  }

  const downloadUrl =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = downloadUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(
    downloadUrl
  );

  setBackupMessage(
    'تم إنشاء النسخة الاحتياطية وتنزيلها بنجاح.'
  );
} catch (error) {
  console.error(
    'Database backup download error:',
    error
  );

  setBackupError(
    error?.message ||
      'حدث خطأ أثناء إنشاء النسخة الاحتياطية.'
  );
} finally {
  setBackupLoading(false);
}

}

/*

* =========================================================
* اختيار ملف الاستعادة
* =========================================================
  */

function handleRestoreFileChange(event) {
const file =
event.target.files?.[0] || null;

setRestoreFile(file);
setRestorePreview(null);
setRestoreMessage('');
setRestoreError('');
setRestoreConfirmed(false);

if (!file) {
  return;
}

if (
  file.type !== 'application/json' &&
  !file.name.toLowerCase().endsWith('.json')
) {
  setRestoreError(
    'يرجى اختيار ملف النسخة الاحتياطية بصيغة JSON.'
  );

  setRestoreFile(null);
  return;
}

/*
 * نقرأ الملف محليًا فقط للمعاينة.
 * لا يتم إرسال أي شيء إلى قاعدة البيانات هنا.
 */

const reader = new FileReader();

reader.onload = () => {
  try {
    const parsed =
      JSON.parse(reader.result);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.tables
    ) {
      throw new Error(
        'ملف النسخة الاحتياطية غير صالح أو ليس من نظام تواصل.'
      );
    }

    const tables =
      parsed.tables || {};

    const tableNames =
      Object.keys(tables);

    const tableSummary =
      tableNames.map((tableName) => ({
        name: tableName,
        count:
          Number(
            tables[tableName]?.count
          ) ||
          (
            Array.isArray(
              tables[tableName]?.rows
            )
              ? tables[tableName].rows.length
              : 0
          ),
      }));

    const totalRows =
      tableSummary.reduce(
        (total, item) =>
          total + item.count,
        0
      );

    setRestorePreview({
      backupType:
        parsed.backup_type ||
        'غير معروف',

      backupVersion:
        parsed.backup_version ||
        'غير معروف',

      createdAt:
        parsed.created_at ||
        null,

      tables:
        tableSummary,

      totalRows,

      skippedTables:
        Array.isArray(
          parsed.skipped_tables
        )
          ? parsed.skipped_tables
          : [],
    });

    setRestoreMessage(
      'تم فحص الملف بنجاح. لم يتم تعديل أي بيانات حتى الآن.'
    );
  } catch (error) {
    console.error(
      'Restore file parsing error:',
      error
    );

    setRestorePreview(null);

    setRestoreError(
      error?.message ||
        'تعذر قراءة ملف النسخة الاحتياطية.'
    );
  }
};

reader.onerror = () => {
  setRestorePreview(null);

  setRestoreError(
    'تعذر قراءة ملف النسخة الاحتياطية.'
  );
};

reader.readAsText(file);

}

/*

* =========================================================
* الاستعادة
* =========================================================
* 
* هذه الوظيفة لا تنفذ الاستعادة مباشرة إلا بعد:
* 
* 1. اختيار الملف.
* 2. نجاح المعاينة.
* 3. موافقة المدير.
* 
* التنفيذ الحقيقي سيكون عبر API خادمي محمي.
  */

async function handleDatabaseRestore() {
if (restoreLoading) {
return;
}

if (!restoreFile) {
  setRestoreError(
    'يرجى اختيار ملف النسخة الاحتياطية أولًا.'
  );
  return;
}

if (!restorePreview) {
  setRestoreError(
    'يجب فحص ملف النسخة الاحتياطية قبل الاستعادة.'
  );
  return;
}

if (!restoreConfirmed) {
  setRestoreError(
    'يرجى تأكيد أنك تريد تحديث السجلات الموجودة وإضافة السجلات غير الموجودة.'
  );
  return;
}

const confirmed =
  window.confirm(
    'تنبيه مهم:\n\n' +
      'سيتم تحديث السجلات الموجودة من النسخة الاحتياطية، ' +
      'وإضافة السجلات غير الموجودة فقط.\n\n' +
      'لن يتم استخدام حذف شامل أو TRUNCATE.\n\n' +
      'هل تريد المتابعة؟'
  );

if (!confirmed) {
  return;
}

setRestoreLoading(true);
setRestoreMessage('');
setRestoreError('');

try {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      'تعذر الحصول على جلسة تسجيل الدخول.'
    );
  }

  if (!session?.access_token) {
    throw new Error(
      'انتهت جلسة المدير. يرجى تسجيل الدخول مرة أخرى.'
    );
  }

  const formData =
    new FormData();

  formData.append(
    'file',
    restoreFile
  );

  const response =
    await fetch(
      '/api/admin/backup/restore',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

  let responseData = null;

  try {
    responseData =
      await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    throw new Error(
      responseData?.error ||
        'حدث خطأ أثناء استعادة النسخة الاحتياطية.'
    );
  }

  setRestoreMessage(
    responseData?.message ||
      'تمت عملية الاستعادة بنجاح.'
  );

  /*
   * بعد الاستعادة نعيد تحميل الإحصائيات
   * حتى تظهر البيانات الجديدة في لوحة المدير.
   */

  await loadData();

  setRestoreConfirmed(false);
} catch (error) {
  console.error(
    'Database restore error:',
    error
  );

  setRestoreError(
    error?.message ||
      'حدث خطأ أثناء استعادة النسخة الاحتياطية.'
  );
} finally {
  setRestoreLoading(false);
}

}

useEffect(() => {
if (profile) {
loadData();
}
}, [profile]);

if (loading) {
return null;
}

if (!profile) {
return null;
}

return (
<div className="app">
<Sidebar
role="admin"
active="/admin"
name={profile.full_name}
/>

  <div className="main">
    {/* =====================================================
        رأس الصفحة
    ====================================================== */}

    <div
      className="topbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 15,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1>نظرة عامة والتقارير</h1>

        <div className="greet">
          مرحبًا بعودتك يا {profile.full_name}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDatabaseBackup}
        disabled={backupLoading}
        style={{
          border: 'none',
          borderRadius: 12,
          padding: '12px 18px',
          background: backupLoading
            ? '#94A3B8'
            : '#1E40AF',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 800,
          cursor: backupLoading
            ? 'not-allowed'
            : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow:
            '0 6px 16px rgba(30, 64, 175, 0.18)',
          transition:
            'opacity 0.2s ease, transform 0.2s ease',
          minWidth: 190,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 17,
            lineHeight: 1,
          }}
        >
          {backupLoading
            ? '⏳'
            : '💾'}
        </span>

        <span>
          {backupLoading
            ? 'جاري إنشاء النسخة...'
            : 'نسخ احتياطي لقاعدة البيانات'}
        </span>
      </button>
    </div>

    {/* =====================================================
        النسخ الاحتياطي والاستعادة
    ====================================================== */}

    <div
      className="panel"
      style={{
        marginBottom: 20,
        marginTop: 20,
      }}
    >
      <div
        className="panel-head"
        style={{
          marginBottom: 15,
        }}
      >
        <h3>
          النسخ الاحتياطي والاستعادة
        </h3>
      </div>

      <div
        style={{
          padding: 15,
          borderRadius: 12,
          background: '#EFF6FF',
          border:
            '1px solid #BFDBFE',
          color: '#1E3A8A',
          fontSize: 13,
          lineHeight: 1.8,
          marginBottom: 15,
        }}
      >
        <strong>
          الاستعادة الآمنة:
        </strong>{' '}
        سيتم تحديث السجلات الموجودة بدل إنشاء
        سجلات مكررة، وإضافة السجلات غير الموجودة
        فقط. لا يتم حذف قاعدة البيانات بالكامل.
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 10,
            padding: '11px 15px',
            background: '#F1F5F9',
            border:
              '1px solid #CBD5E1',
            color: '#334155',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          📁 اختيار نسخة احتياطية

          <input
            type="file"
            accept=".json,application/json"
            onChange={
              handleRestoreFileChange
            }
            style={{
              display: 'none',
            }}
          />
        </label>

        {restoreFile && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              fontWeight: 700,
              wordBreak: 'break-word',
            }}
          >
            {restoreFile.name}
          </div>
        )}
      </div>

      {/* ===================================================
          معاينة النسخة
      ==================================================== */}

      {restorePreview && (
        <div
          style={{
            marginTop: 18,
            padding: 15,
            borderRadius: 12,
            background: '#F8FAFC',
            border:
              '1px solid #E2E8F0',
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: '#0F172A',
              marginBottom: 10,
            }}
          >
            🔍 معاينة النسخة قبل الاستعادة
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              marginBottom: 15,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-soft)',
                }}
              >
                نوع النسخة
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {restorePreview.backupType}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-soft)',
                }}
              >
                إصدار النسخة
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {restorePreview.backupVersion}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-soft)',
                }}
              >
                إجمالي السجلات
              </div>

              <div
                style={{
                  fontWeight: 900,
                  fontSize: 15,
                }}
              >
                {formatNum(
                  restorePreview.totalRows
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {restorePreview.tables.map(
              (table) => (
                <div
                  key={table.name}
                  style={{
                    padding: 10,
                    borderRadius: 9,
                    background: '#FFFFFF',
                    border:
                      '1px solid #E2E8F0',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    {table.name}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      color: '#64748B',
                    }}
                  >
                    {formatNum(
                      table.count
                    )}{' '}
                    سجل
                  </div>
                </div>
              )
            )}
          </div>

          {restorePreview
            .skippedTables
            ?.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 9,
                background: '#FFFBEB',
                border:
                  '1px solid #FDE68A',
                color: '#92400E',
                fontSize: 12,
              }}
            >
              ⚠️ توجد جداول تم تجاوزها
              أثناء إنشاء هذه النسخة.
              سيتم التعامل معها بحذر أثناء
              الاستعادة.
            </div>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 15,
              fontSize: 12.5,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={
                restoreConfirmed
              }
              onChange={(event) =>
                setRestoreConfirmed(
                  event.target.checked
                )
              }
              style={{
                marginTop: 3,
              }}
            />

            <span>
              أؤكد أنني أريد استعادة
              النسخة بهذه الطريقة:
              تحديث السجلات الموجودة،
              إضافة السجلات غير الموجودة،
              وعدم حذف البيانات الحالية
              حذفًا شاملًا.
            </span>
          </label>

          <button
            type="button"
            onClick={
              handleDatabaseRestore
            }
            disabled={
              restoreLoading ||
              !restoreConfirmed
            }
            style={{
              marginTop: 15,
              border: 'none',
              borderRadius: 10,
              padding:
                '11px 18px',
              background:
                restoreLoading ||
                !restoreConfirmed
                  ? '#94A3B8'
                  : '#059669',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 900,
              cursor:
                restoreLoading ||
                !restoreConfirmed
                  ? 'not-allowed'
                  : 'pointer',
              minWidth: 190,
            }}
          >
            {restoreLoading
              ? '⏳ جاري الاستعادة...'
              : '🔄 بدء الاستعادة الآمنة'}
          </button>
        </div>
      )}
    </div>

    {/* =====================================================
        رسائل النسخ والاستعادة
    ====================================================== */}

    {(backupMessage ||
      backupError ||
      restoreMessage ||
      restoreError) && (
      <div
        style={{
          marginBottom: 20,
          padding: '12px 15px',
          borderRadius: 10,
          background:
            backupError ||
            restoreError
              ? '#FEF2F2'
              : '#ECFDF5',
          border:
            backupError ||
            restoreError
              ? '1px solid #FECACA'
              : '1px solid #A7F3D0',
          color:
            backupError ||
            restoreError
              ? '#B91C1C'
              : '#047857',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.7,
        }}
      >
        {backupError ||
          restoreError ||
          backupMessage ||
          restoreMessage}
      </div>
    )}

    {/* =====================================================
        الإحصائيات الأساسية
    ====================================================== */}

    <div
      className="grid-stats"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="stat">
        <div className="label">
          إجمالي الكروت
        </div>

        <div className="value">
          {stats?.totalCards ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          كروت متاحة
        </div>

        <div className="value">
          {stats?.availableCards ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          موزعون نشطون
        </div>

        <div className="value">
          {stats?.activeDist ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          طلبات معلّقة
        </div>

        <div className="value">
          {stats?.pendingReq ?? '—'}
        </div>
      </div>
    </div>

    {/* =====================================================
        الإحصائيات المالية
    ====================================================== */}

    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '1fr 1fr',
        gap: 15,
        marginBottom: 20,
      }}
    >
      <div
        className="panel"
        style={{
          margin: 0,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontWeight: 700,
          }}
        >
          إجمالي الإيرادات المالية
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#7C3AED',
            marginTop: 5,
          }}
        >
          {salesStats.totalRevenue.toLocaleString()}

          <span
            style={{
              fontSize: 12,
              marginRight: 4,
            }}
          >
            ريال
          </span>
        </div>
      </div>

      <div
        className="panel"
        style={{
          margin: 0,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontWeight: 700,
          }}
        >
          إجمالي الكروت المباعة
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#10B981',
            marginTop: 5,
          }}
        >
          {salesStats.soldCardsCount}
        </div>
      </div>
    </div>

    {/* =====================================================
        المسابقة الأسبوعية
    ====================================================== */}

    <WeeklyWinnerPanel />

    {/* =====================================================
        تحليل المبيعات حسب الباقات
    ====================================================== */}

    <div
      className="panel"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="panel-head">
        <h3>
          تحليل المبيعات حسب الباقات
        </h3>
      </div>

      {Object.keys(salesByPackage).length ===
      0 ? (
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 13,
            padding: '10px 0',
          }}
        >
          لا توجد مبيعات مسجلة بعد
        </div>
      ) : (
        Object.entries(
          salesByPackage
        ).map(([name, data]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom:
                '1px solid #F3F0FB',
              fontSize: 13.5,
              gap: 10,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                color: '#3A1D66',
              }}
            >
              {name}
            </span>

            <span
              style={{
                color: '#5B21B6',
                fontWeight: 700,
                textAlign: 'left',
              }}
            >
              {data.count} كروت —{' '}

              <b
                style={{
                  color: '#10B981',
                }}
              >
                {data.total.toLocaleString()}{' '}
                ريال
              </b>
            </span>
          </div>
        ))
      )}
    </div>

    {/* =====================================================
        آخر المبيعات
    ====================================================== */}

    <div
      className="panel"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="panel-head">
        <h3>
          آخر المبيعات في النظام
        </h3>
      </div>

      {recentSales.length === 0 ? (
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 13,
            padding: '10px 0',
          }}
        >
          لا توجد عمليات بيع حديثة
        </div>
      ) : (
        recentSales.map((c) => (
          <div
            className="timer-row"
            key={c.id}
          >
            <div>
              <div className="tcode mono">
                {c.code}
              </div>

              <div className="tpkg">
                {c.packages?.name ||
                  'غير محدد'}{' '}
                —{' '}
                {Number(
                  c.packages?.price || 0
                ).toLocaleString()}{' '}
                ريال
              </div>
            </div>

            <div
              className="tleft"
              style={{
                fontSize: 11.5,
              }}
            >
              {c.sold_at
                ? new Date(
                    c.sold_at
                  ).toLocaleDateString(
                    'ar-YE'
                  )
                : '—'}
            </div>
          </div>
        ))
      )}
    </div>

    {/* =====================================================
        الإعلان
    ====================================================== */}

    <AdSlotAdmin />
  </div>
</div>

);
}
