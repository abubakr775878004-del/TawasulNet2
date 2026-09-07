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
 * - الربط الموجود هنا تجريبي فقط إلى أن يتم تجهيز Server/API.
 *
 * طريقة إنشاء الكروت:
 * - بداية الكرت يتم إدخالها يدويًا.
 * - الأرقام المتبقية يتم توليدها عشوائيًا.
 *
 * مثال:
 * البداية = 77
 * طول الكود = 8
 *
 * الناتج:
 * 77182463
 * 77490512
 * 77273184
 *
 * سيتم لاحقًا تنفيذ التوليد الفعلي وإرسال الكروت إلى
 * MikroTik User Manager من خلال Server/API آمن.
 */

const mikrotikProfileMappings = {
  'أبو 200': 'new 700m-1d-200r',
  'أبو 300': 'new 1g-3d-300r',
  'أبو 500': 'new 2g-5d-500r',
  'أبو 1000': 'new 4g-10d-1000r',
  'أبو 3000': 'new 12g-30d-3000r',
  'أبو 5000': 'new 20g-30d-5000r',
  'أبو 7000': 'new 30g-30d-7000r',
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

  const [routerAddress, setRouterAddress] = useState('');

  const [mikrotikMessage, setMikrotikMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('idle');

  /*
   * ============================================================
   * النظام الحالي - لم يتم تغييره
   * ============================================================
   */

  async function loadPackages() {
    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*, cards(id)')
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      const formatted = data.map((pkg) => ({
        ...pkg,
        cardsCount: pkg.cards ? pkg.cards.length : 0,
      }));

      setPackages(formatted);

      if (!selectedPackageId && formatted.length > 0) {
        setSelectedPackageId(formatted[0].id);
      }
    } else {
      setPackages([]);
    }
  }

  useEffect(() => {
    if (profile) {
      loadPackages();
    }
  }, [profile]);

  async function addPackage(e) {
    e.preventDefault();
    setError('');

    if (!name || !price) {
      return;
    }

    const numericPrice = parseFloat(price);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('يرجى إدخال سعر صحيح أكبر من صفر.');
      return;
    }

    const { error: insertError } = await supabase
      .from('packages')
      .insert({
        name,
        price: numericPrice,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setPrice('');

    await loadPackages();
  }

  async function deletePackage(id, packageName) {
    if (
      !window.confirm(
        `سيتم حذف باقة "${packageName}" نهائيًا. لا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا. متابعة؟`
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
        'تعذّر حذف الباقة — على الأغلب توجد كروت أو طلبات مرتبطة بها حاليًا.'
      );
      return;
    }

    if (selectedPackageId === id) {
      setSelectedPackageId('');
    }

    await loadPackages();
  }

  /*
   * ============================================================
   * MikroTik
   * ============================================================
   */

  const selectedPackage =
    packages.find((pkg) => pkg.id === selectedPackageId) || null;

  const selectedMikrotikProfile = selectedPackage
    ? mikrotikProfileMappings[selectedPackage.name] || ''
    : '';

  /*
   * ============================================================
   * توليد كود عشوائي مع بداية ثابتة
   * ============================================================
   *
   * مثال:
   *
   * البداية = 77
   * طول الكود = 8
   *
   * الناتج:
   * 77182736
   * 77491628
   * 77350291
   *
   * الجزء بعد البداية عشوائي.
   */

  function generateRandomSuffix(length) {
    const chars = '0123456789';
    let result = '';

    for (let i = 0; i < length; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  function generatePreviewCodes(quantity, start, length) {
    const prefix = String(start).trim();
    const remainingLength = length - prefix.length;

    if (remainingLength < 1) {
      return [];
    }

    /*
     * الحد الأقصى النظري للأكواد المختلفة
     * بناءً على عدد الأرقام العشوائية.
     *
     * مثلًا:
     * 6 أرقام عشوائية = 1,000,000 احتمال.
     */
    const possibleCodes = 10 ** remainingLength;

    if (quantity > possibleCodes) {
      return [];
    }

    const codes = new Set();

    /*
     * حد أمان حتى لا ندخل في حلقة لا نهائية
     * إذا كان المجال العشوائي صغيرًا جدًا.
     */
    const maxAttempts = Math.max(quantity * 100, 1000);

    let attempts = 0;

    while (codes.size < quantity && attempts < maxAttempts) {
      attempts += 1;

      const suffix = generateRandomSuffix(remainingLength);
      const code = `${prefix}${suffix}`;

      codes.add(code);
    }

    if (codes.size !== quantity) {
      return [];
    }

    return [...codes];
  }

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

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      setMikrotikMessage('أدخل عدد كروت صحيح بين 1 و1000.');
      return;
    }

    if (!start) {
      setMikrotikMessage('أدخل بداية الكرت يدويًا.');
      return;
    }

    if (!/^\d+$/.test(start)) {
      setMikrotikMessage('بداية الكرت يجب أن تحتوي على أرقام فقط.');
      return;
    }

    if (!Number.isInteger(length) || length < 4 || length > 32) {
      setMikrotikMessage('طول الكود يجب أن يكون بين 4 و32 رقمًا.');
      return;
    }

    if (start.length >= length) {
      setMikrotikMessage(
        `بداية الكرت يجب أن تكون أقصر من طول الكود. البداية الحالية ${start.length} أرقام وطول الكود ${length} أرقام.`
      );
      return;
    }

    /*
     * إنشاء معاينة فعلية للأكواد العشوائية فقط.
     *
     * لا يتم إرسالها إلى MikroTik.
     * ولا يتم حفظها في Supabase.
     */

    const previewCodes = generatePreviewCodes(
      quantity,
      start,
      length
    );

    if (previewCodes.length !== quantity) {
      setMikrotikMessage(
        'تعذر إنشاء العدد المطلوب من الأكواد الفريدة. زِد طول الكود أو قلل عدد الكروت.'
      );
      return;
    }

    const preview = previewCodes.slice(0, 10);

    setMikrotikMessage(
      `تم إنشاء معاينة لـ ${quantity} كرت عشوائي. البداية الثابتة: "${start}". Profile: "${selectedMikrotikProfile}". أول الأكواد: ${preview.join(
        ' — '
      )}. لم يتم إرسال أي كرت إلى MikroTik ولم يتم تعديل قاعدة البيانات.`
    );
  }

  /*
   * ============================================================
   * اختبار الاتصال - تجريبي فقط
   * ============================================================
   */

  function handleTestConnection(e) {
    e.preventDefault();

    setConnectionStatus('testing');
    setMikrotikMessage('');

    /*
     * لا يوجد اتصال حقيقي حاليًا.
     * الاتصال الحقيقي سيتم لاحقًا من Server/API.
     */

    setTimeout(() => {
      setConnectionStatus('preview');

      setMikrotikMessage(
        'وضع تجريبي: لم يتم الاتصال بالراوتر. سيتم تنفيذ الاتصال الحقيقي لاحقًا من الخادم بشكل آمن.'
      );
    }, 500);
  }

  if (loading) {
    return null;
  }

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile?.full_name}
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

          {error && (
            <div className="error-note">
              {error}
            </div>
          )}

          <form
            onSubmit={addPackage}
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
                minWidth: 180,
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
                width: 140,
              }}
            >
              <label>السعر (لكل كرت)</label>

              <input
                type="number"
                step="0.01"
                min="0"
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
            <span className="muted">
              {packages.length}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
              marginTop: 10,
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
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
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
                      textOverflow: 'ellipsis',
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
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#374151',
                      }}
                    >
                      {p.price} ريال
                    </span>

                    <span
                      style={{
                        fontWeight: 800,
                        color: '#5B21B6',
                      }}
                    >
                      {p.cardsCount} كرت
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-sm"
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    opacity: 1,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    flexShrink: 0,
                  }}
                  disabled={busyId === p.id}
                  onClick={() =>
                    deletePackage(p.id, p.name)
                  }
                >
                  {busyId === p.id
                    ? 'جاري...'
                    : 'حذف'}
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
            height: 35,
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
                  color: '#6b7280',
                }}
              >
                مرحلة تجريبية — التوليد عشوائي مع بداية يحددها المدير
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
                fontWeight: 800,
              }}
            >
              تجريبي
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 18,
              marginTop: 18,
            }}
          >
            {/* =================================================
                إنشاء الكروت
                ================================================= */}

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <h4
                style={{
                  margin: '0 0 16px',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111827',
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
                      setSelectedPackageId(
                        e.target.value
                      );
                      setMikrotikMessage('');
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      background: '#ffffff',
                    }}
                  >
                    <option value="">
                      اختر الباقة
                    </option>

                    {packages.map((pkg) => (
                      <option
                        key={pkg.id}
                        value={pkg.id}
                      >
                        {pkg.name} — {pkg.price} ريال
                      </option>
                    ))}
                  </select>
                </div>

                {/* السعر */}

                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    سعر الكرت
                  </div>

                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: '#111827',
                    }}
                  >
                    {selectedPackage
                      ? `${selectedPackage.price} ريال`
                      : '—'}
                  </div>
                </div>

                {/* Profile */}

                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background:
                      selectedMikrotikProfile
                        ? '#ecfdf5'
                        : '#f3f4f6',
                    border: `1px solid ${
                      selectedMikrotikProfile
                        ? '#a7f3d0'
                        : '#e5e7eb'
                    }`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    Profile MikroTik
                  </div>

                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color:
                        selectedMikrotikProfile
                          ? '#065f46'
                          : '#6b7280',
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedMikrotikProfile ||
                      'غير مرتبط حاليًا'}
                  </div>
                </div>

                {/* العدد */}

                <div
                  style={{
                    marginTop: 14,
                  }}
                >
                  <div className="field">
                    <label>عدد الكروت</label>

                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={cardQuantity}
                      onChange={(e) =>
                        setCardQuantity(
                          e.target.value
                        )
                      }
                      placeholder="100"
                    />
                  </div>
                </div>

                {/* بداية الكرت */}

                <div
                  className="field"
                  style={{
                    marginBottom: 0,
                  }}
                >
                  <label>بداية الكرت</label>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={startCode}
                    onChange={(e) => {
                      const value =
                        e.target.value.replace(
                          /\D/g,
                          ''
                        );

                      setStartCode(value);
                    }}
                    placeholder="مثال: 77"
                  />

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: '#6b7280',
                      lineHeight: 1.7,
                    }}
                  >
                    هذه البداية ثابتة في جميع الكروت،
                    أما الأرقام المتبقية فتُولد
                    عشوائيًا.
                  </div>
                </div>

                {/* طول الكود */}

                <div
                  className="field"
                  style={{
                    marginTop: 14,
                    marginBottom: 0,
                  }}
                >
                  <label>طول الكود الكامل</label>

                  <input
                    type="number"
                    min="4"
                    max="32"
                    value={codeLength}
                    onChange={(e) =>
                      setCodeLength(
                        e.target.value
                      )
                    }
                  />

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: '#6b7280',
                      lineHeight: 1.7,
                    }}
                  >
                    مثال: البداية 77 + طول الكود 8 =
                    <strong>
                      {' '}
                      6 أرقام عشوائية
                    </strong>{' '}
                    بعد 77.
                  </div>
                </div>

                {/* معاينة شكل الكود */}

                <div
                  style={{
                    marginTop: 14,
                    padding: '11px 12px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e3a8a',
                    fontSize: 12,
                    lineHeight: 1.8,
                  }}
                >
                  <strong>
                    طريقة التوليد:
                  </strong>{' '}
                  عشوائي فقط
                  <br />

                  البداية:{' '}
                  <strong>
                    {startCode || '—'}
                  </strong>

                  <br />

                  طول الكود:{' '}
                  <strong>
                    {codeLength || '—'}
                  </strong>

                  <br />

                  مثال:{' '}
                  <strong>
                    {startCode &&
                    Number(codeLength) >
                      String(startCode).length
                      ? `${startCode}${'X'.repeat(
                          Math.max(
                            0,
                            Number(codeLength) -
                              String(startCode)
                                .length
                          )
                        )}`
                      : '—'}
                  </strong>
                </div>

                <button
                  className="btn-primary"
                  type="submit"
                  style={{
                    width: '100%',
                    marginTop: 18,
                  }}
                >
                  توليد الكروت — معاينة
                </button>
              </form>
            </div>

            {/* =================================================
                إعدادات الاتصال
                ================================================= */}

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <h4
                style={{
                  margin: '0 0 5px',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111827',
                }}
              >
                إعدادات MikroTik
              </h4>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: 16,
                }}
              >
                سيتم تنفيذ الاتصال الحقيقي لاحقًا من
                الخادم/API بشكل آمن.
              </div>

              <div className="field">
                <label>
                  عنوان الراوتر / Domain
                </label>

                <input
                  value={routerAddress}
                  onChange={(e) =>
                    setRouterAddress(
                      e.target.value
                    )
                  }
                  placeholder="مثال: 192.168.88.1"
                />
              </div>

              <button
                type="button"
                className="btn-sm"
                onClick={handleTestConnection}
                disabled={
                  connectionStatus === 'testing'
                }
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    connectionStatus ===
                    'testing'
                      ? '#9ca3af'
                      : '#111827',
                  color: '#ffffff',
                  fontWeight: 800,
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
                    connectionStatus ===
                    'preview'
                      ? '#fef3c7'
                      : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  color: '#6b7280',
                }}
              >
                الحالة:{' '}
                <strong>
                  {connectionStatus ===
                  'testing'
                    ? 'جارٍ الاختبار'
                    : connectionStatus ===
                        'preview'
                      ? 'تجريبي — غير متصل'
                      : 'لم يتم الاختبار'}
                </strong>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: '11px 12px',
                  borderRadius: 8,
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  color: '#4b5563',
                  lineHeight: 1.8,
                }}
              >
                <strong>مهم:</strong>
                <br />
                لن نضع اسم مستخدم MikroTik أو كلمة
                المرور داخل كود الواجهة.
                <br />
                سيتم حفظ بيانات الاتصال واستخدامها من
                Server/API فقط عند تفعيل الربط الحقيقي.
              </div>
            </div>
          </div>

          {/* =====================================================
              رسالة النظام
              ===================================================== */}

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
                lineHeight: 1.7,
                wordBreak: 'break-word',
              }}
            >
              {mikrotikMessage}
            </div>
          )}

          {/* =====================================================
              تنبيه أمني
              ===================================================== */}

          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 9,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            <strong>تنبيه أمني:</strong> عند تفعيل الاتصال
            الحقيقي، لن نضع كلمة مرور MikroTik داخل كود
            الواجهة أو JavaScript الذي يصل إلى المتصفح.
            سيتم تنفيذ الاتصال من خادم Next.js/API بشكل آمن.
          </div>
        </div>
      </div>
    </div>
  );
}
