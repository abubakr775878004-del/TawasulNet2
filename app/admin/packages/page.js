'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

/*
 * ============================================================
 * MikroTik - ربط تجريبي مؤقت
 * ============================================================
 *
 * مهم:
 * - هذا الجزء لا يتصل بالراوتر حاليًا.
 * - لا يضيف أو يحذف أو يعدل أي كروت في قاعدة البيانات.
 * - لا يغير أي شيء في نظام الباقات الحالي.
 * - الربط الموجود هنا تجريبي فقط إلى أن نتأكد من Profiles
 *   الموجودة فعليًا في MikroTik.
 *
 * سيتم لاحقًا نقل بيانات الاتصال إلى Server/API آمن.
 */

const mikrotikProfileMappings = {
  'أبو 200': 'new 700m-1d-200r',
  'أبو 300': 'new 1g-3d-300r',
  'أبو 500': 'new 2g-5d-500r',
  'أبو 1000': 'new 4g-10d-1000r',
  'أبو 3000': 'new 12g-30d-3000r',
  'أبو 5000': 'new 20g-30d-5000r',
  'أبو 7000': 'new 30g-30d-7000r'
};

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  /*
   * ============================================================
   * MikroTik UI state
   * ============================================================
   */

  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [cardQuantity, setCardQuantity] = useState('');
  const [startCode, setStartCode] = useState('');
  const [codeLength, setCodeLength] = useState('8');
  const [generationMethod, setGenerationMethod] = useState('sequential');

  const [routerAddress, setRouterAddress] = useState('');
  const [routerPort, setRouterPort] = useState('8728');
  const [routerUsername, setRouterUsername] = useState('');
  const [routerPassword, setRouterPassword] = useState('');

  const [mikrotikMessage, setMikrotikMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('idle');

  /*
   * ============================================================
   * النظام الحالي - لم يتم تغييره
   * ============================================================
   */

  async function loadPackages() {
    // جلب الباقات مع حساب عدد الكروت المرتبطة بكل باقة
    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*, cards(id)')
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      const formatted = data.map((pkg) => ({
        ...pkg,
        cardsCount: pkg.cards ? pkg.cards.length : 0
      }));

      setPackages(formatted);

      /*
       * اختيار أول باقة تلقائيًا فقط في واجهة MikroTik
       * ولا يؤثر على الباقات أو قاعدة البيانات.
       */
      if (!selectedPackageId && formatted.length > 0) {
        setSelectedPackageId(formatted[0].id);
      }
    } else {
      setPackages([]);
    }
  }

  useEffect(() => {
    if (profile) loadPackages();
  }, [profile]);

  async function addPackage(e) {
    e.preventDefault();
    setError('');

    if (!name || !price) return;

    const { error: insertError } = await supabase
      .from('packages')
      .insert({
        name,
        price: parseFloat(price)
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setPrice('');
    loadPackages();
  }

  async function deletePackage(id, name) {
    if (
      !window.confirm(
        `سيتم حذف باقة "${name}" نهائيًا. لا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا. متابعة؟`
      )
    ) {
      return;
    }

    setError('');
    setBusyId(id);

    const { error: deleteError } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    setBusyId(null);

    if (deleteError) {
      setError(
        'تعذّر حذف الباقة — على الأغلب توجد كروت أو طلبات مرتبطة بها حاليًا'
      );
      return;
    }

    loadPackages();
  }

  /*
   * ============================================================
   * MikroTik - وظائف تجريبية فقط
   * ============================================================
   */

  const selectedPackage =
    packages.find((pkg) => pkg.id === selectedPackageId) || null;

  const selectedMikrotikProfile = selectedPackage
    ? mikrotikProfileMappings[selectedPackage.name] || ''
    : '';

  function handleGeneratePreview(e) {
    e.preventDefault();

    setMikrotikMessage('');

    const quantity = Number(cardQuantity);
    const start = String(startCode || '').trim();
    const length = Number(codeLength);

    if (!selectedPackage) {
      setMikrotikMessage('يرجى اختيار باقة أولًا.');
      return;
    }

    if (!selectedMikrotikProfile) {
      setMikrotikMessage(
        `الباقة "${selectedPackage.name}" غير مرتبطة حاليًا بـ Profile MikroTik.`
      );
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMikrotikMessage('أدخل عدد كروت صحيح أكبر من صفر.');
      return;
    }

    if (!start) {
      setMikrotikMessage('أدخل بداية الكرت.');
      return;
    }

    if (!Number.isInteger(length) || length <= 0) {
      setMikrotikMessage('أدخل طول كود صحيح.');
      return;
    }

    /*
     * لا يتم إنشاء أي كرت فعلي هنا.
     * مجرد اختبار للواجهة.
     */
    setMikrotikMessage(
      `تم تجهيز طلب تجريبي لإنشاء ${quantity} كرت من باقة "${selectedPackage.name}" وربطها بالـ Profile "${selectedMikrotikProfile}". لم يتم إرسال أي شيء إلى MikroTik ولم يتم تعديل قاعدة البيانات.`
    );
  }

  function handleTestConnection(e) {
    e.preventDefault();

    setConnectionStatus('testing');
    setMikrotikMessage('');

    /*
     * لا يوجد اتصال حقيقي حاليًا.
     * ننتظر بناء Server/API آمن قبل الاتصال بالراوتر.
     */
    setTimeout(() => {
      setConnectionStatus('preview');

      setMikrotikMessage(
        'وضع تجريبي: لم يتم الاتصال بالراوتر. بيانات الاتصال لم تُحفظ ولم تُرسل لأي جهة.'
      );
    }, 500);
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile.full_name}
      />

      <div className="main">
        <h1>الباقات</h1>

        <p className="greet" style={{ marginBottom: 20 }}>
          إدارة باقات الكروت وأسعارها
        </p>

        {/* =====================================================
            النظام الحالي للباقات - محفوظ كما هو
            ===================================================== */}

        <div className="panel">
          <div className="panel-head">
            <h3>إضافة باقة جديدة</h3>
          </div>

          {error && <div className="error-note">{error}</div>}

          <form
            onSubmit={addPackage}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}
          >
            <div
              className="field"
              style={{
                marginBottom: 0,
                flex: 1,
                minWidth: 180
              }}
            >
              <label>اسم الباقة</label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: باقة 20GB"
              />
            </div>

            <div
              className="field"
              style={{
                marginBottom: 0,
                width: 140
              }}
            >
              <label>السعر (لكل كرت)</label>

              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25"
              />
            </div>

            <button
              className="btn-primary"
              style={{ width: 140 }}
              type="submit"
            >
              إضافة
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>الباقات الحالية</h3>
            <span className="muted">{packages.length}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
              marginTop: 10
            }}
          >
            {packages.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  minHeight: 82,
                  padding: '14px 18px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#111827',
                      marginBottom: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {p.name}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                      fontSize: 14
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#374151'
                      }}
                    >
                      {p.price} ريال
                    </span>

                    <span
                      style={{
                        fontWeight: 800,
                        color: '#5B21B6'
                      }}
                    >
                      {p.cardsCount} كرت
                    </span>
                  </div>
                </div>

                <button
                  className="btn-sm"
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    opacity: 1,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    flexShrink: 0
                  }}
                  disabled={busyId === p.id}
                  onClick={() => deletePackage(p.id, p.name)}
                >
                  {busyId === p.id ? 'جاري...' : 'حذف'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* =====================================================
            فاصل بصري
            ===================================================== */}

        <div
          style={{
            height: 35
          }}
        />

        {/* =====================================================
            MikroTik
            ===================================================== */}

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3 style={{ marginBottom: 5 }}>
                نظام إنشاء الكروت — MikroTik
              </h3>

              <div
                style={{
                  fontSize: 13,
                  color: '#6b7280'
                }}
              >
                مرحلة تجريبية — لا يوجد اتصال فعلي بالراوتر حاليًا
              </div>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 999,
                background: '#fef3c7',
                color: '#92400e',
                fontSize: 12,
                fontWeight: 800
              }}
            >
              تجريبي
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 18,
              marginTop: 18
            }}
          >
            {/* إنشاء الكروت */}
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 18,
                background: '#ffffff'
              }}
            >
              <h4
                style={{
                  margin: '0 0 16px',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111827'
                }}
              >
                إنشاء كروت
              </h4>

              <form onSubmit={handleGeneratePreview}>
                <div className="field">
                  <label>الباقة</label>

                  <select
                    value={selectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value);
                      setMikrotikMessage('');
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      background: '#ffffff'
                    }}
                  >
                    <option value="">اختر الباقة</option>

                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} — {pkg.price} ريال
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: selectedMikrotikProfile
                      ? '#ecfdf5'
                      : '#f3f4f6',
                    border: `1px solid ${
                      selectedMikrotikProfile ? '#a7f3d0' : '#e5e7eb'
                    }`
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginBottom: 4
                    }}
                  >
                    Profile MikroTik
                  </div>

                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: selectedMikrotikProfile
                        ? '#065f46'
                        : '#6b7280'
                    }}
                  >
                    {selectedMikrotikProfile || 'غير مرتبط حاليًا'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginTop: 14
                  }}
                >
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>عدد الكروت</label>

                    <input
                      type="number"
                      min="1"
                      value={cardQuantity}
                      onChange={(e) => setCardQuantity(e.target.value)}
                      placeholder="100"
                    />
                  </div>

                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>بداية الكرت</label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={startCode}
                      onChange={(e) => setStartCode(e.target.value)}
                      placeholder="50000001"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginTop: 14
                  }}
                >
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>طول الكود</label>

                    <input
                      type="number"
                      min="1"
                      max="32"
                      value={codeLength}
                      onChange={(e) => setCodeLength(e.target.value)}
                    />
                  </div>

                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>طريقة التوليد</label>

                    <select
                      value={generationMethod}
                      onChange={(e) =>
                        setGenerationMethod(e.target.value)
                      }
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        background: '#ffffff'
                      }}
                    >
                      <option value="sequential">تسلسلي</option>
                      <option value="random">عشوائي</option>
                    </select>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  type="submit"
                  style={{
                    width: '100%',
                    marginTop: 18
                  }}
                >
                  توليد الكروت — تجريبي
                </button>
              </form>
            </div>

            {/* إعدادات الاتصال */}
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 18,
                background: '#ffffff'
              }}
            >
              <h4
                style={{
                  margin: '0 0 5px',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111827'
                }}
              >
                إعدادات MikroTik
              </h4>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: 16
                }}
              >
                معاينة فقط — لا يتم حفظ هذه البيانات حاليًا
              </div>

              <div className="field">
                <label>عنوان الراوتر / Domain</label>

                <input
                  value={routerAddress}
                  onChange={(e) => setRouterAddress(e.target.value)}
                  placeholder="مثال: 192.168.88.1"
                />
              </div>

              <div className="field">
                <label>API Port</label>

                <input
                  type="number"
                  value={routerPort}
                  onChange={(e) => setRouterPort(e.target.value)}
                  placeholder="8728"
                />
              </div>

              <div className="field">
                <label>اسم المستخدم</label>

                <input
                  value={routerUsername}
                  onChange={(e) => setRouterUsername(e.target.value)}
                  placeholder="MikroTik username"
                  autoComplete="off"
                />
              </div>

              <div className="field">
                <label>كلمة المرور</label>

                <input
                  type="password"
                  value={routerPassword}
                  onChange={(e) => setRouterPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="button"
                className="btn-sm"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    connectionStatus === 'testing'
                      ? '#9ca3af'
                      : '#111827',
                  color: '#ffffff',
                  fontWeight: 800
                }}
              >
                {connectionStatus === 'testing'
                  ? 'جاري الاختبار...'
                  : 'اختبار الاتصال — تجريبي'}
              </button>

              <div
                style={{
                  marginTop: 12,
                  padding: '9px 11px',
                  borderRadius: 8,
                  background:
                    connectionStatus === 'preview'
                      ? '#fef3c7'
                      : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  color: '#6b7280'
                }}
              >
                الحالة:{' '}
                <strong>
                  {connectionStatus === 'testing'
                    ? 'جارٍ الاختبار'
                    : connectionStatus === 'preview'
                      ? 'تجريبي — غير متصل'
                      : 'لم يتم الاختبار'}
                </strong>
              </div>
            </div>
          </div>

          {/* رسالة النظام */}
          {mikrotikMessage && (
            <div
              style={{
                marginTop: 18,
                padding: '12px 14px',
                borderRadius: 9,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e3a8a',
                fontSize: 13,
                lineHeight: 1.7
              }}
            >
              {mikrotikMessage}
            </div>
          )}

          {/* تنبيه أمني */}
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 9,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontSize: 12,
              lineHeight: 1.8
            }}
          >
            <strong>تنبيه أمني:</strong> عند تفعيل الاتصال الحقيقي لاحقًا،
            لن نضع كلمة مرور MikroTik داخل كود الواجهة أو داخل JavaScript
            الذي يصل إلى المتصفح. سيتم تنفيذ الاتصال من خادم Next.js/API
            بشكل آمن.
          </div>
        </div>
      </div>
    </div>
  );
}
