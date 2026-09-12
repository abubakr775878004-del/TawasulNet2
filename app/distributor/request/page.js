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
    if (profile) loadData();
  }, [profile]);

  const parsedQty = parseInt(quantity, 10) || 0;
  const selectedPkg = packages.find((p) => p.id === packageId);

  const total = selectedPkg
    ? (selectedPkg.price * parsedQty).toFixed(2)
    : '0.00';

  const currentBalance = Number(profile?.balance || 0);
  const numericTotal = Number(total || 0);

  // معلومة بصرية فقط، ولا يتم استخدامها لاتخاذ أي قرار مالي.
  const expectedBalance = currentBalance - numericTotal;

  const totalRequestedCards = myRequests.reduce(
    (sum, request) => sum + (Number(request.quantity) || 0),
    0
  );

  const pendingRequests = myRequests.filter(
    (request) => request.status !== 'fulfilled' && request.status !== 'rejected'
  ).length;

  async function submitRequest(e) {
    e.preventDefault();

    if (submitting) return;

    setError('');
    setDone(false);

    if (!packageId || parsedQty < 1) {
      setError('يرجى اختيار الباقة وإدخال كمية صحيحة.');
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
          : 'باقة غير معروفةة';

        const telegramContent = `طلب كروت جديد:\n📦 الباقة: ${packageName}\n🔢 الكمية: ${parsedQty}\n💰 الإجمالي: ${total} ريال`;

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
      setError('حدث خطأ غير متوقع أثناء إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRequest(id) {
    const confirmed = window.confirm(
      'هل أنت متأكد من حذف هذا الطلب؟\n\nلا يمكن التراجع عن عملية الحذف.'
    );

    if (!confirmed) return;

    setBusyId(id);

    try {
      await supabase
        .from('card_requests')
        .delete()
        .eq('id', id);

      await loadData();
    } catch (deleteError) {
      console.error('Delete request error:', deleteError);
      setError('حدث خطأ أثناء حذف الطلب.');
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(dateValue) {
    if (!dateValue) return '—';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getRequestStatus(status) {
    if (status === 'fulfilled') {
      return {
        label: 'تم التنفيذ',
        className: 'green',
      };
    }

    if (status === 'rejected') {
      return {
        label: 'مرفوض',
        className: 'red',
      };
    }

    return {
      label: 'قيد الانتظار',
      className: 'amber',
    };
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="distributor"
        active="/distributor/request"
        name={profile.full_name}
      />

      <div className="main">
        <h1>طلب كروت جديد</h1>

        <p className="greet" style={{ marginBottom: 20 }}>
          يُخصم المبلغ من رصيدك تلقائيًا فور موافقة المدير
        </p>

        {/* ملخص سريع */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              رصيدك الحالي
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {currentBalance.toFixed(2)}{' '}
              <span style={{ fontSize: 13, fontWeight: 500 }}>ريال</span>
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              إجمالي الطلبات
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {myRequests.length}
            </div>

            <div
              style={{
                color: '#64748b',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              منها {pendingRequests} قيد الانتظار
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              إجمالي الكروت المطلوبة
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {totalRequestedCards}
            </div>

            <div
              style={{
                color: '#64748b',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              جميع الطلبات السابقة
            </div>
          </div>
        </div>

        {/* نموذج الطلب */}
        <div className="panel">
          {error && (
            <div
              className="error-note"
              style={{
                marginBottom: 16,
                lineHeight: 1.7,
              }}
            >
              ❌ {error}
            </div>
          )}

          {done && (
            <div
              className="pending-note"
              style={{
                marginBottom: 16,
                lineHeight: 1.7,
              }}
            >
              ✅ تم إرسال طلبك وحفظه بنجاح، وتم إرسال إشعار المدير.
            </div>
          )}

          <div
            style={{
              marginBottom: 18,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 6 }}>
              إنشاء طلب جديد
            </h3>

            <p
              style={{
                margin: 0,
                color: '#64748b',
                fontSize: 13,
              }}
            >
              اختر الباقة ثم حدد عدد الكروت المطلوبة.
            </p>
          </div>

          <form
            onSubmit={submitRequest}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
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
                disabled={submitting}
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value="">اختر باقة</option>

                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price} ريال/كرت
                  </option>
                ))}
              </select>
            </div>

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
                disabled={submitting}
                onChange={(e) =>
                  setQuantity(
                    e.target.value === '' ? '' : e.target.value
                  )
                }
              />
            </div>

            <button
              className="btn-primary"
              style={{
                width: 170,
                minHeight: 42,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? 'جاري الإرسال...'
                : `إرسال الطلب${
                    selectedPkg && parsedQty > 0
                      ? ` (${total} ريال)`
                      : ''
                  }`}
            </button>
          </form>

          {/* تفاصيل الطلب الحالي */}
          {selectedPkg && parsedQty > 0 && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    الباقة
                  </div>

                  <strong>{selectedPkg.name}</strong>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    سعر الكرت
                  </div>

                  <strong>
                    {Number(selectedPkg.price).toFixed(2)} ريال
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    الكمية
                  </div>

                  <strong>{parsedQty} كرت</strong>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    إجمالي الطلب
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {total} ريال
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    الرصيد المتوقع بعد التنفيذ
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {expectedBalance.toFixed(2)} ريال
                  </strong>

                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    تقديري فقط — لا يغيّر الرصيد فعليًا
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* سجل الطلبات */}
        <div className="panel">
          <div
            className="panel-head"
            style={{
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <h3>طلباتي السابقة</h3>

            <span className="muted">
              {myRequests.length} طلب
            </span>
          </div>

          {myRequests.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '35px 15px',
                color: '#64748b',
              }}
            >
              لا توجد طلبات سابقة حتى الآن.
            </div>
          ) : (
            <>
              {/* عرض الجوال */}
              <div
                style={{
                  display: 'none',
                }}
                className="request-mobile-list"
              >
                {myRequests.map((r) => {
                  const status = getRequestStatus(r.status);
                  const requestPackage = packages.find(
                    (p) => p.id === r.package_id
                  );

                  const price = requestPackage
                    ? Number(requestPackage.price || 0)
                    : 0;

                  const requestTotal = (
                    price * Number(r.quantity || 0)
                  ).toFixed(2);

                  return (
                    <div
                      key={r.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <strong>
                          {r.packages?.name || '—'}
                        </strong>

                        <span className={`pill ${status.className}`}>
                          {status.label}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(2, 1fr)',
                          gap: 10,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <span style={{ color: '#64748b' }}>
                            الكمية
                          </span>
                          <div>
                            {r.quantity} كرت
                          </div>
                        </div>

                        <div>
                          <span style={{ color: '#64748b' }}>
                            السعر
                          </span>
                          <div>
                            {price.toFixed(2)} ريال
                          </div>
                        </div>

                        <div>
                          <span style={{ color: '#64748b' }}>
                            الإجمالي
                          </span>
                          <div>
                            {requestTotal} ريال
                          </div>
                        </div>

                        <div>
                          <span style={{ color: '#64748b' }}>
                            التاريخ
                          </span>
                          <div>
                            {formatDate(r.created_at)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-sm"
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          opacity:
                            busyId === r.id ? 0.6 : 1,
                          padding: '7px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          marginTop: 12,
                          width: '100%',
                          cursor:
                            busyId === r.id
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                        disabled={busyId === r.id}
                        onClick={() => deleteRequest(r.id)}
                      >
                        {busyId === r.id
                          ? 'جاري الحذف...'
                          : 'حذف الطلب'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* عرض الكمبيوتر */}
              <div
                className="request-desktop-table"
                style={{
                  overflowX: 'auto',
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>الباقة</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                      <th>التاريخ</th>
                      <th>الحالة</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {myRequests.map((r) => {
                      const status = getRequestStatus(r.status);

                      const requestPackage = packages.find(
                        (p) => p.id === r.package_id
                      );

                      const price = requestPackage
                        ? Number(requestPackage.price || 0)
                        : 0;

                      const requestTotal = (
                        price * Number(r.quantity || 0)
                      ).toFixed(2);

                      return (
                        <tr key={r.id}>
                          <td>
                            {r.packages?.name || '—'}
                          </td>

                          <td>
                            {r.quantity}
                          </td>

                          <td>
                            {price.toFixed(2)} ريال
                          </td>

                          <td>
                            <strong>
                              {requestTotal} ريال
                            </strong>
                          </td>

                          <td>
                            {formatDate(r.created_at)}
                          </td>

                          <td>
                            <span
                              className={`pill ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="btn-sm"
                              style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                opacity:
                                  busyId === r.id ? 0.6 : 1,
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor:
                                  busyId === r.id
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                              disabled={busyId === r.id}
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
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* تحسين عرض الجدول على الجوال */}
        <style jsx>{`
          @media (max-width: 700px) {
            .request-desktop-table {
              display: none !important;
            }

            .request-mobile-list {
              display: block !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
