'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  /* =========================================================
     MikroTik
     ========================================================= */

  const [mikrotikProfiles, setMikrotikProfiles] = useState([]);
  const [mappings, setMappings] = useState([]);

  const [mikrotikLoading, setMikrotikLoading] = useState(false);
  const [mikrotikTesting, setMikrotikTesting] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);

  const [mikrotikConnected, setMikrotikConnected] =
    useState(false);
  const [mikrotikMessage, setMikrotikMessage] =
    useState('');

  const [selectedPackageId, setSelectedPackageId] =
    useState('');

  const [selectedProfileName, setSelectedProfileName] =
    useState('');

  /* =========================================================
     إنشاء الكروت
     ========================================================= */

  const [cardQuantity, setCardQuantity] = useState(10);
  const [codePrefix, setCodePrefix] = useState('77');
  const [codeLength, setCodeLength] = useState(8);

  const [creatingCards, setCreatingCards] =
    useState(false);

  const [creationResult, setCreationResult] =
    useState(null);

  const [previewCodes, setPreviewCodes] =
    useState([]);

  /* =========================================================
     جلب الباقات - الكود الأصلي محفوظ
     ========================================================= */

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
    } else {
      setPackages([]);
    }
  }

  /* =========================================================
     الحصول على Access Token
     ========================================================= */

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        sessionError.message ||
          'تعذر الحصول على جلسة الدخول.'
      );
    }

    if (!session?.access_token) {
      throw new Error(
        'جلسة الدخول غير موجودة. يرجى تسجيل الدخول مرة أخرى.'
      );
    }

    return session.access_token;
  }

  /* =========================================================
     استدعاء API MikroTik
     ========================================================= */

  async function mikrotikRequest(
    url,
    options = {}
  ) {
    const token = await getAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `فشل الطلب. HTTP ${response.status}`
      );
    }

    return data;
  }

  /* =========================================================
     تحميل MikroTik Profiles والربط الحالي
     ========================================================= */

  async function loadMikrotikProfiles() {
    setMikrotikLoading(true);
    setMikrotikMessage('');

    try {
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager?action=profiles'
      );

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'تعذر تحميل Profiles من MikroTik.'
        );
      }

      setMikrotikProfiles(
        Array.isArray(data.profiles)
          ? data.profiles
          : []
      );

      setMappings(
        Array.isArray(data.mappings)
          ? data.mappings
          : []
      );
    } catch (err) {
      setMikrotikProfiles([]);
      setMappings([]);
      setMikrotikMessage(
        err?.message ||
          'تعذر الاتصال بـ MikroTik.'
      );
    } finally {
      setMikrotikLoading(false);
    }
  }

  /* =========================================================
     اختبار اتصال MikroTik
     ========================================================= */

  async function testMikrotikConnection() {
    setMikrotikTesting(true);
    setMikrotikMessage('');
    setMikrotikConnected(false);

    try {
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager?action=test'
      );

      if (!data?.success || !data?.connected) {
        throw new Error(
          data?.error ||
            'تعذر تأكيد الاتصال بـ MikroTik.'
        );
      }

      setMikrotikConnected(true);

      const details = [];

      if (data.board) {
        details.push(`الجهاز: ${data.board}`);
      }

      if (data.version) {
        details.push(`الإصدار: ${data.version}`);
      }

      setMikrotikMessage(
        details.length
          ? `تم الاتصال بـ MikroTik بنجاح — ${details.join(
              ' — '
            )}`
          : 'تم الاتصال بـ MikroTik بنجاح.'
      );

      await loadMikrotikProfiles();
    } catch (err) {
      setMikrotikConnected(false);
      setMikrotikMessage(
        err?.message ||
          'فشل الاتصال بـ MikroTik.'
      );
    } finally {
      setMikrotikTesting(false);
    }
  }

  /* =========================================================
     حفظ ربط الباقة بـ MikroTik Profile
     ========================================================= */

  async function saveMikrotikMapping() {
    setMikrotikMessage('');

    if (!selectedPackageId) {
      setMikrotikMessage(
        'يرجى اختيار الباقة أولًا.'
      );
      return;
    }

    if (!selectedProfileName) {
      setMikrotikMessage(
        'يرجى اختيار MikroTik Profile أولًا.'
      );
      return;
    }

    setMappingSaving(true);

    try {
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'save-mapping',
            packageId: selectedPackageId,
            profileName: selectedProfileName
          })
        }
      );

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'تعذر حفظ الربط.'
        );
      }

      setMikrotikMessage(
        'تم ربط الباقة بـ MikroTik Profile بنجاح.'
      );

      await loadMikrotikProfiles();
    } catch (err) {
      setMikrotikMessage(
        err?.message ||
          'تعذر حفظ ربط الباقة.'
      );
    } finally {
      setMappingSaving(false);
    }
  }

  /* =========================================================
     الحصول على Profile المرتبط بباقة
     ========================================================= */

  function getMappedProfile(packageId) {
    const mapping = mappings.find(
      (item) => item.package_id === packageId
    );

    return mapping?.mikrotik_profile_name || '';
  }

  /* =========================================================
     عند اختيار باقة
     ========================================================= */

  function handlePackageSelection(packageId) {
    setSelectedPackageId(packageId);
    setCreationResult(null);
    setPreviewCodes([]);

    const mappedProfile =
      getMappedProfile(packageId);

    setSelectedProfileName(mappedProfile);
  }

  /* =========================================================
     معاينة إعدادات الكرت
     ========================================================= */

  function generatePreviewCodes() {
    setCreationResult(null);

    const quantity = Number(cardQuantity);
    const prefix = String(codePrefix).trim();
    const length = Number(codeLength);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      setPreviewCodes([]);
      return;
    }

    if (
      !/^[0-9]+$/.test(prefix) ||
      prefix.length >= length
    ) {
      setPreviewCodes([]);
      return;
    }

    const generated = [];
    const used = new Set();

    let attempts = 0;
    const maxAttempts = quantity * 100;

    while (
      generated.length < Math.min(quantity, 10) &&
      attempts < maxAttempts
    ) {
      attempts += 1;

      let suffix = '';

      for (
        let i = prefix.length;
        i < length;
        i += 1
      ) {
        suffix += Math.floor(
          Math.random() * 10
        ).toString();
      }

      const code = `${prefix}${suffix}`;

      if (!used.has(code)) {
        used.add(code);
        generated.push(code);
      }
    }

    setPreviewCodes(generated);
  }

  /* =========================================================
     إنشاء الكروت الحقيقية
     ========================================================= */

  async function createCards() {
    setCreationResult(null);
    setPreviewCodes([]);

    if (!selectedPackageId) {
      setCreationResult({
        success: false,
        message:
          'يرجى اختيار الباقة أولًا.'
      });
      return;
    }

    if (!selectedProfileName) {
      setCreationResult({
        success: false,
        message:
          'هذه الباقة غير مربوطة بـ MikroTik Profile. قم بربطها أولًا.'
      });
      return;
    }

    const quantity = Number(cardQuantity);
    const prefix = String(codePrefix).trim();
    const length = Number(codeLength);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      setCreationResult({
        success: false,
        message:
          'عدد الكروت يجب أن يكون بين 1 و1000.'
      });
      return;
    }

    if (!prefix || !/^[0-9]+$/.test(prefix)) {
      setCreationResult({
        success: false,
        message:
          'بداية الكرت يجب أن تحتوي على أرقام فقط.'
      });
      return;
    }

    if (
      !Number.isInteger(length) ||
      length < 4 ||
      length > 32
    ) {
      setCreationResult({
        success: false,
        message:
          'طول الكرت يجب أن يكون بين 4 و32.'
      });
      return;
    }

    if (prefix.length >= length) {
      setCreationResult({
        success: false,
        message:
          'طول البداية يجب أن يكون أقل من طول الكرت.'
      });
      return;
    }

    setCreatingCards(true);

    try {
      /*
       * الأكواد يتم توليدها فعليًا من السيرفر
       * وليس من المتصفح.
       */
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'create-cards',
            packageId: selectedPackageId,
            quantity,
            prefix,
            codeLength: length
          })
        }
      );

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'تعذر إنشاء الكروت.'
        );
      }

      setCreationResult({
        success: true,
        data
      });

      /*
       * تحديث عدد الكروت في الواجهة
       */
      await loadPackages();

      /*
       * تنظيف المعاينة بعد الإنشاء الناجح.
       */
      setPreviewCodes([]);
    } catch (err) {
      setCreationResult({
        success: false,
        message:
          err?.message ||
          'حدث خطأ أثناء إنشاء الكروت.'
      });
    } finally {
      setCreatingCards(false);
    }
  }

  /* =========================================================
     تحميل البيانات
     ========================================================= */

  useEffect(() => {
    if (profile) {
      loadPackages();
      loadMikrotikProfiles();
    }
  }, [profile]);

  /* =========================================================
     إضافة باقة - الكود الأصلي محفوظ
     ========================================================= */

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

    await loadPackages();
  }

  /* =========================================================
     حذف الباقة - الكود الأصلي محفوظ
     ========================================================= */

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

    const { error: deleteError } =
      await supabase
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

    await loadPackages();
    await loadMikrotikProfiles();
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

        <p
          className="greet"
          style={{ marginBottom: 20 }}
        >
          إدارة باقات الكروت وأسعارها
        </p>

        {/* =====================================================
            إضافة باقة جديدة
            نفس القسم الأصلي بدون تغيير
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
                onChange={(e) =>
                  setName(e.target.value)
                }
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
              <label>
                السعر (لكل كرت)
              </label>

              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
                }
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

        {/* =====================================================
            الباقات الحالية
            نفس واجهة الكود الأصلي
            ===================================================== */}

        <div className="panel">
          <div className="panel-head">
            <h3>الباقات الحالية</h3>

            <span className="muted">
              {packages.length}
            </span>
          </div>

          {/* الباقات بشكل مستطيلات أفقية */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
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
                  justifyContent:
                    'space-between',
                  gap: 16,
                  minHeight: 82,
                  padding: '14px 18px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  boxSizing: 'border-box'
                }}
              >
                {/* اسم الباقة */}
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
                      textOverflow:
                        'ellipsis'
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

                    {/* عرض الربط بدون تغيير التصميم الأصلي */}
                    {getMappedProfile(
                      p.id
                    ) && (
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#047857'
                        }}
                      >
                        MikroTik:{" "}
                        {getMappedProfile(
                          p.id
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* زر الحذف */}
                <button
                  className="btn-sm"
                  style={{
                    backgroundColor:
                      '#dc2626',
                    color: '#ffffff',
                    opacity: 1,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    flexShrink: 0
                  }}
                  disabled={
                    busyId === p.id
                  }
                  onClick={() =>
                    deletePackage(
                      p.id,
                      p.name
                    )
                  }
                >
                  {busyId === p.id
                    ? 'جارٍ...'
                    : 'حذف'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* =====================================================
            MikroTik User Manager
            تمت إضافته بدون حذف أي شيء من الواجهة الأصلية
            ===================================================== */}

        <div
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-head">
            <h3>
              ربط الباقات مع MikroTik
            </h3>

            <button
              type="button"
              className="btn-primary"
              onClick={
                testMikrotikConnection
              }
              disabled={
                mikrotikTesting
              }
              style={{
                width: 160
              }}
            >
              {mikrotikTesting
                ? 'جارٍ الاختبار...'
                : 'اختبار MikroTik'}
            </button>
          </div>

          {mikrotikMessage && (
            <div
              style={{
                marginBottom: 15,
                padding: '10px 12px',
                borderRadius: 8,
                background:
                  mikrotikConnected
                    ? '#ecfdf5'
                    : '#fff7ed',
                color:
                  mikrotikConnected
                    ? '#047857'
                    : '#c2410c',
                border:
                  '1px solid ' +
                  (mikrotikConnected
                    ? '#a7f3d0'
                    : '#fed7aa'),
                fontSize: 14,
                fontWeight: 700
              }}
            >
              {mikrotikMessage}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
              alignItems: 'end'
            }}
          >
            <div className="field">
              <label>
                الباقة
              </label>

              <select
                value={selectedPackageId}
                onChange={(e) =>
                  handlePackageSelection(
                    e.target.value
                  )
                }
                style={{
                  width: '100%'
                }}
              >
                <option value="">
                  اختر الباقة
                </option>

                {packages.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name} — {p.price} ريال
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>
                MikroTik Profile
              </label>

              <select
                value={
                  selectedProfileName
                }
                onChange={(e) =>
                  setSelectedProfileName(
                    e.target.value
                  )
                }
                disabled={
                  mikrotikLoading
                }
                style={{
                  width: '100%'
                }}
              >
                <option value="">
                  {mikrotikLoading
                    ? 'جارٍ تحميل Profiles...'
                    : 'اختر Profile'}
                </option>

                {mikrotikProfiles.map(
                  (mikrotikProfile) => (
                    <option
                      key={
                        mikrotikProfile.id ||
                        mikrotikProfile.name
                      }
                      value={
                        mikrotikProfile.name
                      }
                    >
                      {mikrotikProfile.name}
                      {mikrotikProfile.price
                        ? ` — ${mikrotikProfile.price}`
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={
                saveMikrotikMapping
              }
              disabled={
                mappingSaving ||
                !selectedPackageId ||
                !selectedProfileName
              }
              style={{
                minHeight: 42
              }}
            >
              {mappingSaving
                ? 'جارٍ الحفظ...'
                : 'حفظ ربط الباقة'}
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 8,
              background: '#f9fafb',
              border:
                '1px solid #e5e7eb',
              fontSize: 13,
              color: '#4b5563'
            }}
          >
            يتم التحقق من وجود الـ
            Profile فعليًا داخل User
            Manager قبل حفظ الربط.
          </div>
        </div>

        {/* =====================================================
            إنشاء الكروت
            ===================================================== */}

        <div
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-head">
            <h3>
              إنشاء كروت MikroTik
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              alignItems: 'end'
            }}
          >
            <div className="field">
              <label>
                الباقة
              </label>

              <select
                value={selectedPackageId}
                onChange={(e) =>
                  handlePackageSelection(
                    e.target.value
                  )
                }
                style={{
                  width: '100%'
                }}
              >
                <option value="">
                  اختر الباقة
                </option>

                {packages.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name} — {p.price} ريال
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>
                MikroTik Profile
              </label>

              <input
                value={
                  selectedProfileName
                }
                readOnly
                placeholder="يظهر بعد ربط الباقة"
              />
            </div>

            <div className="field">
              <label>
                عدد الكروت
              </label>

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
              />
            </div>

            <div className="field">
              <label>
                بداية الكرت
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={codePrefix}
                onChange={(e) =>
                  setCodePrefix(
                    e.target.value.replace(
                      /[^0-9]/g,
                      ''
                    )
                  )
                }
                placeholder="77"
              />
            </div>

            <div className="field">
              <label>
                طول الكرت
              </label>

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
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 18
            }}
          >
            <button
              type="button"
              className="btn-sm"
              onClick={
                generatePreviewCodes
              }
              style={{
                padding:
                  '8px 14px',
                borderRadius: 6,
                border:
                  '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151'
              }}
            >
              معاينة الأكواد
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={createCards}
              disabled={
                creatingCards ||
                !selectedPackageId ||
                !selectedProfileName
              }
            >
              {creatingCards
                ? 'جارٍ إنشاء الكروت...'
                : 'إنشاء الكروت'}
            </button>
          </div>

          {/* ===================================================
              تنبيه الربط
              =================================================== */}

          {selectedPackageId &&
            !selectedProfileName && (
              <div
                style={{
                  marginTop: 15,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background:
                    '#fff7ed',
                  border:
                    '1px solid #fed7aa',
                  color: '#c2410c',
                  fontSize: 14,
                  fontWeight: 700
                }}
              >
                لا يمكن إنشاء الكروت
                لهذه الباقة حتى يتم
                ربطها بـ MikroTik
                Profile.
              </div>
            )}

          {/* ===================================================
              المعاينة
              =================================================== */}

          {previewCodes.length >
            0 && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 8,
                background:
                  '#f9fafb',
                border:
                  '1px solid #e5e7eb'
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 10,
                  color: '#111827'
                }}
              >
                معاينة أولية للأكواد
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                {previewCodes.map(
                  (code) => (
                    <span
                      key={code}
                      style={{
                        padding:
                          '6px 10px',
                        borderRadius:
                          6,
                        background:
                          '#ffffff',
                        border:
                          '1px solid #d1d5db',
                        fontFamily:
                          'monospace',
                        fontWeight: 700
                      }}
                    >
                      {code}
                    </span>
                  )
                )}
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: '#6b7280',
                  fontSize: 12
                }}
              >
                هذه معاينة فقط.
                الأكواد النهائية
                يتم توليدها بشكل آمن
                من السيرفر عند الضغط
                على إنشاء الكروت.
              </div>
            </div>
          )}

          {/* ===================================================
              نتيجة إنشاء الكروت
              =================================================== */}

          {creationResult && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 8,
                background:
                  creationResult.success
                    ? '#ecfdf5'
                    : '#fef2f2',
                border:
                  '1px solid ' +
                  (creationResult.success
                    ? '#a7f3d0'
                    : '#fecaca'),
                color:
                  creationResult.success
                    ? '#047857'
                    : '#b91c1c'
              }}
            >
              {!creationResult.success ? (
                <div
                  style={{
                    fontWeight: 700
                  }}
                >
                  {creationResult.message}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 10
                    }}
                  >
                    تم إنشاء الكروت
                    بنجاح.
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 8,
                      fontSize: 14
                    }}
                  >
                    <div>
                      المطلوب:{' '}
                      <strong>
                        {
                          creationResult
                            .data
                            .requested
                        }
                      </strong>
                    </div>

                    <div>
                      في MikroTik:{' '}
                      <strong>
                        {
                          creationResult
                            .data
                            .createdInMikrotik
                        }
                      </strong>
                    </div>

                    <div>
                      في قاعدة البيانات:{' '}
                      <strong>
                        {
                          creationResult
                            .data
                            .savedInSupabase
                        }
                      </strong>
                    </div>

                    <div>
                      الفاشلة:{' '}
                      <strong>
                        {
                          creationResult
                            .data
                            .failed
                        }
                      </strong>
                    </div>
                  </div>

                  {creationResult
                    .data
                    ?.results
                    ?.successful
                    ?.length > 0 && (
                    <div
                      style={{
                        marginTop: 15
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          marginBottom: 8
                        }}
                      >
                        الأكواد التي
                        تم إنشاؤها:
                      </div>

                      <div
                        style={{
                          display:
                            'flex',
                          flexWrap:
                            'wrap',
                          gap: 8
                        }}
                      >
                        {creationResult.data.results.successful.map(
                          (code) => (
                            <span
                              key={
                                code
                              }
                              style={{
                                padding:
                                  '6px 10px',
                                borderRadius:
                                  6,
                                background:
                                  '#ffffff',
                                border:
                                  '1px solid #a7f3d0',
                                fontFamily:
                                  'monospace',
                                fontWeight:
                                  800
                              }}
                            >
                              {code}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {creationResult
                    .data
                    ?.results
                    ?.failed
                    ?.length > 0 && (
                    <div
                      style={{
                        marginTop: 15,
                        color: '#b91c1c'
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          marginBottom: 8
                        }}
                      >
                        الكروت التي
                        فشلت:
                      </div>

                      {creationResult.data.results.failed.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={`${item.code}-${index}`}
                            style={{
                              marginBottom: 5,
                              fontSize: 13
                            }}
                          >
                            <strong>
                              {item.code}
                            </strong>
                            {' — '}
                            {item.error ||
                              'فشل غير معروف'}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
