'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function RequestCardsPage() {
  const { profile, loading } = useProfile('distributor');

  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [myRequests, setMyRequests] = useState([]);

  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!profile?.id) return;

    const [{ data: pkgs }, { data: reqs }] = await Promise.all([
      supabase.from('packages').select('*'),

      supabase
        .from('card_requests')
        .select('*, packages(name)')
        .eq('distributor_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    setPackages(pkgs || []);
    setMyRequests(reqs || []);
  }

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const parsedQty = parseInt(quantity, 10) || 0;

  const selectedPkg = packages.find(
    (p) => p.id === packageId
  );

  const totalNumber = selectedPkg
    ? Number(selectedPkg.price || 0) * parsedQty
    : 0;

  const total = totalNumber.toFixed(2);

  const currentBalance = Number(profile?.balance || 0);

  const insufficientBalance =
    !!selectedPkg &&
    parsedQty > 0 &&
    totalNumber > currentBalance;

  const shortage = insufficientBalance
    ? totalNumber - currentBalance
    : 0;

  const expectedBalance = insufficientBalance
    ? 0
    : currentBalance - totalNumber;

  function formatDate(date) {
    if (!date) return '—';

    try {
      return new Date(date).toLocaleString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  }

  function getRequestStatus(status) {
    if (status === 'fulfilled') {
      return {
        text: 'تم التنفيذ',
        className: 'green',
      };
    }

    if (status === 'rejected') {
      return {
        text: 'مرفوض',
        className: 'red',
      };
    }

    return {
      text: 'قيد الانتظار',
      className: 'amber',
    };
  }

  async function submitRequest(e) {
    e.preventDefault();

    setError('');
    setDone(false);

    if (!packageId || parsedQty < 1) {
      setError('يرجى اختيار الباقة وإدخال كمية صحيحة.');
      return;
    }

    // فحص واجهة فقط للتأكد من وضوح حالة الرصيد للموزع.
    // لا يغيّر هذا الفحص أي منطق مالي في قاعدة البيانات.
    if (insufficientBalance) {
      setError(
        `الرصيد غير كافٍ. تحتاج إلى ${shortage.toFixed(
          2
        )} ريال إضافية لإتمام هذا الطلب.`
      );
      return;
    }

    setSubmitting(true);

    try {
      // 1) حفظ طلب الكروت في قاعدة البيانات أولاً
      const { error: insertError } = await supabase
        .from('card_requests')
        .insert({
          distributor_id: profile.id,
          package_id: packageId,
          quantity: parsedQty,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setDone(true);

      // 2) إرسال إشعار إلى تليجرام تلقائياً
      try {
        const packageName = selectedPkg
          ? selectedPkg.name
          : 'باقة غير معروفة';

        const telegramContent =
          `طلب كروت جديد:\n` +
          `📦 الباقة: ${packageName}\n` +
          `🔢 الكمية: ${parsedQty}\n` +
          `💰 الإجمالي: ${total} ريال`;

        await fetch('/api/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            distributor_name: profile.full_name,
            content: telegramContent,
          }),
          cache: 'no-store',
        });
      } catch (telegramError) {
        console.error(
          'Telegram notification error for card request:',
          telegramError
        );
      }

      setQuantity('');
      setPackageId('');

      await loadData();
    } catch (requestError) {
      console.error('Card request error:', requestError);
      setError('حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRequest(id) {
    const confirmed = window.confirm(
      'هل أنت متأكد من حذف هذا الطلب؟'
    );

    if (!confirmed) return;

    setBusyId(id);

    try {
      await supabase
        .from('card_requests')
        .delete()
        .eq('id', id);

      await loadData();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="distributor"
        active="/distributor/request"
        name={profile?.full_name}
      />

      <div className="main">
        <h1>طلب كروت جديد</h1>

        <p
          className="greet"
          style={{
            marginBottom: 20,
          }}
        >
          يُخصم المبلغ من رصيدك تلقائيًا فور موافقة المدير
        </p>

        {/* نموذج الطلب */}
        <div className="panel">
          {error && (
            <div
              className="error-note"
              style={{
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {done && (
            <div
              className="pending-note"
              style={{
                marginBottom: 16,
              }}
            >
              ✅ تم إرسال طلبك وحفظه، وتم إشعار المدير بنجاح
            </div>
          )}

          <form
            onSubmit={submitRequest}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            {/* الباقة */}
            <div
              className="field"
              style={{
                marginBottom: 0,
                flex: 1,
                minWidth: 200,
              }}
            >
              <label>الباقة</label>

              <select
                value={packageId}
                onChange={(e) => {
                  setPackageId(e.target.value);
                  setError('');
                  setDone(false);
                }}
              >
                <option value="">اختر باقة</option>

                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price} ريال/كرت
                  </option>
                ))}
              </select>
            </div>

            {/* الكمية */}
            <div
              className="field"
              style={{
                marginBottom: 0,
                width: 140,
              }}
            >
              <label>الكمية</label>

              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(
                    e.target.value === ''
                      ? ''
                      : e.target.value
                  );

                  setError('');
                  setDone(false);
                }}
              />
            </div>

            {/* زر الإرسال */}
            <button
              className="btn-primary"
              style={{
                width: 170,
                minHeight: 42,
                opacity:
                  submitting || insufficientBalance
                    ? 0.6
                    : 1,
                cursor:
                  submitting || insufficientBalance
                    ? 'not-allowed'
                    : 'pointer',
              }}
              type="submit"
              disabled={
                submitting || insufficientBalance
              }
            >
              {submitting
                ? 'جاري الإرسال...'
                : insufficientBalance
                ? 'الرصيد غير كافٍ'
                : `إرسال الطلب${
                    selectedPkg && parsedQty > 0
                      ? ` (${total} ريال)`
                      : ''
                  }`}
            </button>
          </form>

          {/* ملخص الطلب */}
          {selectedPkg && parsedQty > 0 && (
            <div
              style={{
                marginTop: 22,
                padding: 16,
                borderRadius: 14,
                background: insufficientBalance
                  ? '#fff7f7'
                  : '#f8fafc',
                border: insufficientBalance
                  ? '1px solid #fecaca'
                  : '1px solid #e2e8f0',
              }}
            >
              {insufficientBalance ? (
                /* حالة الرصيد غير الكافي */
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 14,
                      color: '#b91c1c',
                      fontSize: 17,
                      fontWeight: 800,
                    }}
                  >
                    <span>⚠️</span>
                    <span>الرصيد غير كافٍ</span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {/* الباقة */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#2563eb',
                          marginBottom: 5,
                        }}
                      >
                        📦 الباقة
                      </div>

                      <strong
                        style={{
                          fontSize: 15,
                          color: '#1e3a8a',
                        }}
                      >
                        {selectedPkg.name}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 4,
                        }}
                      >
                        {Number(
                          selectedPkg.price || 0
                        ).toFixed(2)}{' '}
                        ريال / كرت
                      </div>
                    </div>

                    {/* الكمية */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#7c3aed',
                          marginBottom: 5,
                        }}
                      >
                        🔢 الكمية
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#5b21b6',
                        }}
                      >
                        {parsedQty}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 4,
                        }}
                      >
                        كرت
                      </div>
                    </div>

                    {/* إجمالي الطلب */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#ea580c',
                          marginBottom: 5,
                        }}
                      >
                        💰 إجمالي الطلب
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#c2410c',
                        }}
                      >
                        {total} ريال
                      </strong>
                    </div>

                    {/* الرصيد الحالي */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#16a34a',
                          marginBottom: 5,
                        }}
                      >
                        💳 رصيدك الحالي
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#15803d',
                        }}
                      >
                        {currentBalance.toFixed(2)} ريال
                      </strong>
                    </div>
                  </div>

                  {/* مقدار النقص */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: 13,
                      borderRadius: 10,
                      background: '#fee2e2',
                      border:
                        '1px solid #fecaca',
                      color: '#991b1b',
                      lineHeight: 1.8,
                      fontSize: 13,
                    }}
                  >
                    تحتاج إلى إضافة{' '}
                    <strong>
                      {shortage.toFixed(2)} ريال
                    </strong>{' '}
                    إلى رصيدك حتى تتمكن من طلب هذه الكمية.
                  </div>
                </div>
              ) : (
                /* حالة الرصيد الكافي */
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 14,
                      color: '#166534',
                      fontSize: 17,
                      fontWeight: 800,
                    }}
                  >
                    <span>✅</span>
                    <span>تفاصيل الطلب</span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {/* الباقة */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#2563eb',
                          marginBottom: 5,
                        }}
                      >
                        📦 الباقة
                      </div>

                      <strong
                        style={{
                          fontSize: 15,
                          color: '#1e3a8a',
                        }}
                      >
                        {selectedPkg.name}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 4,
                        }}
                      >
                        {Number(
                          selectedPkg.price || 0
                        ).toFixed(2)}{' '}
                        ريال / كرت
                      </div>
                    </div>

                    {/* الكمية */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#7c3aed',
                          marginBottom: 5,
                        }}
                      >
                        🔢 الكمية
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#5b21b6',
                        }}
                      >
                        {parsedQty}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 4,
                        }}
                      >
                        كرت
                      </div>
                    </div>

                    {/* الإجمالي */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#ea580c',
                          marginBottom: 5,
                        }}
                      >
                        💰 إجمالي الطلب
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#c2410c',
                        }}
                      >
                        {total} ريال
                      </strong>
                    </div>

                    {/* الرصيد الحالي */}
                    <div
                      style={{
                        padding: 13,
                        borderRadius: 11,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#16a34a',
                          marginBottom: 5,
                        }}
                      >
                        💳 الرصيد الحالي
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                          color: '#15803d',
                        }}
                      >
                        {currentBalance.toFixed(2)} ريال
                      </strong>
                    </div>
                  </div>

                  {/* الرصيد المتوقع */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 11,
                      background:
                        'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                      border: '1px solid #86efac',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#15803d',
                          marginBottom: 5,
                          fontWeight: 700,
                        }}
                      >
                        💵 الرصيد المتبقي المتوقع
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                        }}
                      >
                        بعد تنفيذ الطلب
                      </div>
                    </div>

                    <strong
                      style={{
                        fontSize: 21,
                        color: '#166534',
                      }}
                    >
                      {expectedBalance.toFixed(2)} ريال
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* الطلبات السابقة */}
        <div className="panel">
          <div className="panel-head">
            <h3>طلباتي السابقة</h3>

            <span className="muted">
              {myRequests.length}
            </span>
          </div>

          {/* عرض الجوال */}
          <div
            style={{
              display: 'none',
            }}
            className="mobile-request-list"
          >
            {myRequests.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 25,
                  color: '#64748b',
                }}
              >
                لا توجد طلبات سابقة
              </div>
            ) : (
              myRequests.map((r) => {
                const status = getRequestStatus(
                  r.status
                );

                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      background: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <strong>
                        {r.packages?.name ||
                          'باقة غير معروفة'}
                      </strong>

                      <span
                        className={`pill ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: '#64748b',
                        lineHeight: 1.9,
                      }}
                    >
                      <div>
                        🔢 الكمية:{' '}
                        <strong>
                          {r.quantity}
                        </strong>
                      </div>

                      {r.created_at && (
                        <div>
                          🕐 التاريخ:{' '}
                          <strong>
                            {formatDate(
                              r.created_at
                            )}
                          </strong>
                        </div>
                      )}
                    </div>

                    <button
                      className="btn-sm"
                      style={{
                        marginTop: 10,
                        backgroundColor:
                          '#dc2626',
                        color: '#ffffff',
                        opacity:
                          busyId === r.id
                            ? 0.6
                            : 1,
                        padding:
                          '7px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor:
                          busyId === r.id
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      disabled={
                        busyId === r.id
                      }
                      onClick={() =>
                        deleteRequest(r.id)
                      }
                    >
                      {busyId === r.id
                        ? 'جاري الحذف...'
                        : 'حذف'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* عرض سطح المكتب */}
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>الباقة</th>
                  <th>الكمية</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {myRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        textAlign: 'center',
                        padding: 30,
                        color: '#64748b',
                      }}
                    >
                      لا توجد طلبات سابقة
                    </td>
                  </tr>
                ) : (
                  myRequests.map((r) => {
                    const status =
                      getRequestStatus(r.status);

                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            {r.packages?.name ||
                              'باقة غير معروفة'}
                          </strong>
                        </td>

                        <td>{r.quantity}</td>

                        <td
                          style={{
                            color: '#64748b',
                            fontSize: 13,
                          }}
                        >
                          {formatDate(
                            r.created_at
                          )}
                        </td>

                        <td>
                          <span
                            className={`pill ${status.className}`}
                          >
                            {status.text}
                          </span>
                        </td>

                        <td>
                          <button
                            className="btn-sm"
                            style={{
                              backgroundColor:
                                '#dc2626',
                              color: '#ffffff',
                              opacity:
                                busyId === r.id
                                  ? 0.6
                                  : 1,
                              padding:
                                '6px 14px',
                              borderRadius:
                                '6px',
                              border: 'none',
                              cursor:
                                busyId === r.id
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                            disabled={
                              busyId === r.id
                            }
                            onClick={() =>
                              deleteRequest(r.id)
                            }
                          >
                            {busyId === r.id
                              ? 'جاري الحذف...'
                              : 'حذف'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* تحسين عرض البطاقات على الجوال */}
      <style jsx>{`
        @media (max-width: 700px) {
          .mobile-request-list {
            display: block !important;
          }

          .mobile-request-list + div {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
