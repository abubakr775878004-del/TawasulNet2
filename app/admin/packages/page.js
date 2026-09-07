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
  const [mikrotikConnected, setMikrotikConnected] = useState(false);
  const [mikrotikMessage, setMikrotikMessage] = useState('');

  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedProfileName, setSelectedProfileName] = useState('');

  /* =========================================================
     إنشاء الكروت
     ========================================================= */

  const [cardQuantity, setCardQuantity] = useState(10);
  const [codePrefix, setCodePrefix] = useState('77');
  const [codeLength, setCodeLength] = useState(8);
  const [creatingCards, setCreatingCards] = useState(false);
  const [creationResult, setCreationResult] = useState(null);
  const [previewCodes, setPreviewCodes] = useState([]);

  /* =========================================================
     تحميل الباقات
     ========================================================= */

  async function loadPackages() {
    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*, cards(id)')
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      setPackages(
        data.map((pkg) => ({
          ...pkg,
          cardsCount: pkg.cards ? pkg.cards.length : 0
        }))
      );
    } else {
      setPackages([]);
    }
  }

  /* =========================================================
     Session Token
     ========================================================= */

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        sessionError.message || 'تعذر الحصول على جلسة الدخول.'
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
     MikroTik Request
     ========================================================= */

  async function mikrotikRequest(url, options = {}) {
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
     تحميل MikroTik Profiles
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
     اختبار الاتصال
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
     حفظ ربط الباقة بالـ Profile
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
     Profile المرتبط بالباقة
     ========================================================= */

  function getMappedProfile(packageId) {
    const mapping = mappings.find(
      (item) =>
        item.package_id === packageId
    );

    return (
      mapping?.mikrotik_profile_name || ''
    );
  }

  /* =========================================================
     اختيار الباقة
     ========================================================= */

  function handlePackageSelection(packageId) {
    setSelectedPackageId(packageId);
    setCreationResult(null);
    setPreviewCodes([]);

    setSelectedProfileName(
      getMappedProfile(packageId)
    );
  }

  /* =========================================================
     معاينة الأكواد
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

    const maxAttempts =
      quantity * 100;

    while (
      generated.length <
        Math.min(quantity, 10) &&
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
     إنشاء الكروت
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

    if (
      !prefix ||
      !/^[0-9]+$/.test(prefix)
    ) {
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

      await loadPackages();

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
     Initial Load
     ========================================================= */

  useEffect(() => {
    if (profile) {
      loadPackages();
      loadMikrotikProfiles();
    }
  }, [profile]);

  /* =========================================================
     إضافة باقة
     ========================================================= */

  async function addPackage(e) {
    e.preventDefault();

    setError('');

    if (!name || !price) {
      return;
    }

    const { error: insertError } =
      await supabase
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
     حذف باقة
     ========================================================= */

  async function deletePackage(
    id,
    packageName
  ) {
    if (
      !window.confirm(
        `سيتم حذف باقة "${packageName}" نهائيًا. لا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا. متابعة؟`
      )
    ) {
      return;
    }

    setError('');
    setBusyId(id);

    const {
      error: deleteError
    } = await supabase
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

  if (loading) {
    return null;
  }

  const totalCards =
    packages.reduce(
      (sum, item) =>
        sum + (item.cardsCount || 0),
      0
    );

  const mappedPackages =
    packages.filter(
      (item) =>
        getMappedProfile(item.id)
    ).length;

  const selectedPackage =
    packages.find(
      (item) =>
        item.id === selectedPackageId
    );

  const selectedProfile =
    mikrotikProfiles.find(
      (item) =>
        item.name === selectedProfileName
    );

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e8e7ef',
    borderRadius: 18,
    boxShadow:
      '0 8px 30px rgba(31, 25, 60, 0.06)'
  };

  const statStyle = {
    ...cardStyle,
    padding: 18,
    minHeight: 112,
    display: 'flex',
    alignItems: 'center',
    gap: 14
  };

  const iconStyle = {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    flexShrink: 0
  };

  return (
    <div
      className="app"
      dir="rtl"
    >
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile.full_name}
      />

      <div className="main">

        {/* =====================================================
            رأس الصفحة
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: '24px 26px',
            marginBottom: 18,
            background:
              'linear-gradient(135deg, #4c1d95 0%, #6d28d9 48%, #0f766e 140%)',
            color: '#fff',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'relative',
              zIndex: 1
            }}
          >
            <div
              style={{
                fontSize: 13,
                opacity: 0.82,
                marginBottom: 7
              }}
            >
              TawasulNet • لوحة الإدارة
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900
              }}
            >
              إدارة الباقات والكروت
            </h1>

            <p
              style={{
                margin: '8px 0 0',
                opacity: 0.9,
                maxWidth: 720
              }}
            >
              إدارة الباقات، ربطها بملفات MikroTik
              User Manager، وإنشاء كروت حقيقية
              وحفظها في النظام من مكان واحد.
            </p>
          </div>

          <div
            style={{
              position: 'absolute',
              left: -35,
              top: -55,
              width: 170,
              height: 170,
              borderRadius: '50%',
              background:
                'rgba(255,255,255,.08)'
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: 90,
              bottom: -95,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background:
                'rgba(20,184,166,.13)'
            }}
          />
        </div>

        {/* =====================================================
            الإحصائيات
            ===================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
            marginBottom: 20
          }}
        >
          <div style={statStyle}>
            <div
              style={{
                ...iconStyle,
                background: '#f3e8ff',
                color: '#7e22ce'
              }}
            >
              ▣
            </div>

            <div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                إجمالي الباقات
              </div>

              <strong
                style={{ fontSize: 26 }}
              >
                {packages.length}
              </strong>

              <div
                style={{
                  fontSize: 12,
                  color: '#16a34a'
                }}
              >
                باقة في النظام
              </div>
            </div>
          </div>

          <div style={statStyle}>
            <div
              style={{
                ...iconStyle,
                background: '#e0f2fe',
                color: '#0369a1'
              }}
            >
              ▤
            </div>

            <div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                إجمالي الكروت
              </div>

              <strong
                style={{ fontSize: 26 }}
              >
                {totalCards}
              </strong>

              <div
                style={{
                  fontSize: 12,
                  color: '#64748b'
                }}
              >
                مرتبطة بالباقات
              </div>
            </div>
          </div>

          <div style={statStyle}>
            <div
              style={{
                ...iconStyle,
                background: '#dcfce7',
                color: '#15803d'
              }}
            >
              ✓
            </div>

            <div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                الباقات المربوطة
              </div>

              <strong
                style={{ fontSize: 26 }}
              >
                {mappedPackages}
              </strong>

              <div
                style={{
                  fontSize: 12,
                  color: '#16a34a'
                }}
              >
                مع MikroTik Profile
              </div>
            </div>
          </div>

          <div style={statStyle}>
            <div
              style={{
                ...iconStyle,
                background:
                  mikrotikConnected
                    ? '#dcfce7'
                    : '#fef3c7',
                color:
                  mikrotikConnected
                    ? '#15803d'
                    : '#b45309'
              }}
            >
              ⌁
            </div>

            <div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                حالة MikroTik
              </div>

              <strong
                style={{ fontSize: 18 }}
              >
                {mikrotikConnected
                  ? 'متصل'
                  : 'غير مؤكد'}
              </strong>

              <div
                style={{
                  fontSize: 12,
                  color:
                    mikrotikConnected
                      ? '#16a34a'
                      : '#b45309'
                }}
              >
                {mikrotikProfiles.length}{' '}
                Profile محمّل
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            إضافة باقة + اتصال MikroTik
            ===================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1.5fr) minmax(280px, 0.8fr)',
            gap: 18,
            marginBottom: 20
          }}
        >
          <div
            style={{
              ...cardStyle,
              padding: 22
            }}
          >
            <h3
              style={{
                marginTop: 0,
                fontSize: 19
              }}
            >
              إضافة باقة جديدة
            </h3>

            <form
              onSubmit={addPackage}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr auto',
                gap: 10,
                alignItems: 'end'
              }}
            >
              <div className="field">
                <label>اسم الباقة</label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="باقة 200"
                />
              </div>

              <div className="field">
                <label>السعر</label>

                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  placeholder="200"
                />
              </div>

              <button
                className="btn-primary"
                type="submit"
                style={{ minHeight: 42 }}
              >
                إضافة الباقة
              </button>
            </form>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 11,
                  borderRadius: 10,
                  background: '#fef2f2',
                  border:
                    '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div
            style={{
              ...cardStyle,
              padding: 22
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginBottom: 10
              }}
            >
              اتصال User Manager
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background:
                    mikrotikConnected
                      ? '#22c55e'
                      : '#f59e0b',
                  boxShadow:
                    mikrotikConnected
                      ? '0 0 0 5px #dcfce7'
                      : '0 0 0 5px #fef3c7'
                }}
              />

              <strong>
                {mikrotikConnected
                  ? 'MikroTik متصل وجاهز'
                  : 'اختبر الاتصال قبل الإنشاء'}
              </strong>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={
                testMikrotikConnection
              }
              disabled={mikrotikTesting}
              style={{ width: '100%' }}
            >
              {mikrotikTesting
                ? 'جارٍ اختبار الاتصال...'
                : 'اختبار اتصال MikroTik'}
            </button>

            {mikrotikMessage && (
              <div
                style={{
                  marginTop: 12,
                  padding: 11,
                  borderRadius: 10,
                  background:
                    mikrotikConnected
                      ? '#f0fdf4'
                      : '#fff7ed',
                  border:
                    mikrotikConnected
                      ? '1px solid #bbf7d0'
                      : '1px solid #fed7aa',
                  color:
                    mikrotikConnected
                      ? '#166534'
                      : '#9a3412',
                  fontSize: 12,
                  lineHeight: 1.7
                }}
              >
                {mikrotikMessage}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            الباقات الحالية
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom: 16
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 19
                }}
              >
                إدارة الباقات
              </h3>

              <span
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                اختر الباقة التي تريد ربطها
                أو إنشاء كروت لها.
              </span>
            </div>

            <span
              style={{
                background: '#f8fafc',
                border:
                  '1px solid #e2e8f0',
                padding: '7px 12px',
                borderRadius: 10,
                fontWeight: 800
              }}
            >
              {packages.length} باقة
            </span>
          </div>

          {packages.length === 0 ? (
            <div
              style={{
                padding: 35,
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: 14,
                color: '#64748b'
              }}
            >
              لا توجد باقات حاليًا.
              أضف أول باقة من القسم أعلاه.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14
              }}
            >
              {packages.map((p) => {
                const mapped =
                  getMappedProfile(p.id);

                const selected =
                  selectedPackageId === p.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      border: selected
                        ? '2px solid #7c3aed'
                        : '1px solid #e5e7eb',
                      borderRadius: 16,
                      padding: 17,
                      background: selected
                        ? '#faf5ff'
                        : '#fff'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 10,
                        alignItems:
                          'flex-start'
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 18
                          }}
                        >
                          {p.name}
                        </div>

                        <div
                          style={{
                            color: '#6d28d9',
                            fontWeight: 900,
                            marginTop: 4
                          }}
                        >
                          {p.price} ريال
                        </div>
                      </div>

                      <div
                        style={{
                          background:
                            '#f1f5f9',
                          padding:
                            '7px 10px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 800
                        }}
                      >
                        {p.cardsCount || 0}{' '}
                        كرت
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        padding: 10,
                        borderRadius: 10,
                        background:
                          mapped
                            ? '#f0fdf4'
                            : '#fff7ed',
                        color:
                          mapped
                            ? '#166534'
                            : '#9a3412',
                        fontSize: 12,
                        fontWeight: 800
                      }}
                    >
                      {mapped
                        ? `MikroTik: ${mapped}`
                        : 'غير مربوطة بـ MikroTik'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 14
                      }}
                    >
                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          flex: 1,
                          minHeight: 40
                        }}
                        onClick={() =>
                          handlePackageSelection(
                            p.id
                          )
                        }
                      >
                        {selected
                          ? 'الباقة محددة'
                          : 'اختيار الباقة'}
                      </button>

                      <button
                        type="button"
                        className="btn-sm"
                        disabled={
                          busyId === p.id
                        }
                        onClick={() =>
                          deletePackage(
                            p.id,
                            p.name
                          )
                        }
                        style={{
                          padding:
                            '8px 12px',
                          borderRadius: 9,
                          border:
                            '1px solid #fecaca',
                          background:
                            '#fff',
                          color:
                            '#dc2626'
                        }}
                      >
                        {busyId === p.id
                          ? '...'
                          : 'حذف'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =====================================================
            ربط الباقات مع MikroTik
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 20
                }}
              >
                ربط الباقات مع MikroTik
              </h3>

              <span
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                اختر الباقة ثم اختر Profile
                الموجود فعليًا داخل User Manager.
              </span>
            </div>

            <button
              type="button"
              className="btn-sm"
              onClick={
                loadMikrotikProfiles
              }
              disabled={mikrotikLoading}
              style={{
                padding:
                  '9px 14px',
                borderRadius: 9,
                border:
                  '1px solid #d1d5db',
                background: '#fff'
              }}
            >
              {mikrotikLoading
                ? 'جارٍ التحديث...'
                : 'تحديث Profiles'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12
            }}
          >
            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
              <label>
                MikroTik Profile
              </label>

              <select
                value={selectedProfileName}
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
                  (item) => (
                    <option
                      key={
                        item.id ||
                        item.name
                      }
                      value={item.name}
                    >
                      {item.name}
                      {item.price
                        ? ` — ${item.price}`
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
                minHeight: 42,
                alignSelf: 'end'
              }}
            >
              {mappingSaving
                ? 'جارٍ الحفظ...'
                : 'حفظ الربط'}
            </button>
          </div>

          {selectedProfile && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  padding:
                    '9px 12px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border:
                    '1px solid #e2e8f0',
                  fontSize: 13
                }}
              >
                <strong>
                  Profile:
                </strong>{' '}
                {selectedProfile.name}
              </div>

              {selectedProfile.price && (
                <div
                  style={{
                    padding:
                      '9px 12px',
                    borderRadius: 10,
                    background:
                      '#f8fafc',
                    border:
                      '1px solid #e2e8f0',
                    fontSize: 13
                  }}
                >
                  <strong>
                    السعر:
                  </strong>{' '}
                  {selectedProfile.price}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 11,
              background: '#f8fafc',
              border:
                '1px solid #e5e7eb',
              color: '#64748b',
              fontSize: 12
            }}
          >
            يتم التحقق من وجود الـ Profile
            فعليًا داخل User Manager قبل حفظ
            الربط. لا يتم اختراع سرعة أو مدة أو
            أي قيمة غير موجودة في MikroTik.
          </div>
        </div>

        {/* =====================================================
            إنشاء الكروت
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 20
                }}
              >
                إنشاء كروت MikroTik
              </h3>

              <span
                style={{
                  color: '#6b7280',
                  fontSize: 13
                }}
              >
                الأكواد النهائية يتم توليدها
                آمنًا من السيرفر ثم تُنشأ في
                MikroTik وتُحفظ في Supabase.
              </span>
            </div>

            {selectedPackage && (
              <div
                style={{
                  padding:
                    '9px 13px',
                  borderRadius: 12,
                  background:
                    '#f3e8ff',
                  color: '#6d28d9',
                  fontWeight: 900
                }}
              >
                {selectedPackage.name}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12
            }}
          >
            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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
              marginTop: 18,
              padding: 15,
              borderRadius: 14,
              background: '#fafafa',
              border:
                '1px solid #eee',
              display: 'flex',
              justifyContent:
                'space-between',
              gap: 15,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 4
                }}
              >
                إعداد الإنشاء
              </div>

              <div
                style={{
                  color: '#64748b',
                  fontSize: 12
                }}
              >
                مثال: يبدأ الكود بـ{' '}
                <strong>
                  {codePrefix || '—'}
                </strong>{' '}
                وطوله{' '}
                <strong>
                  {codeLength || '—'}
                </strong>{' '}
                أرقام، والكمية{' '}
                <strong>
                  {cardQuantity || '—'}
                </strong>.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 9,
                flexWrap: 'wrap'
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
                    '9px 14px',
                  borderRadius: 9,
                  border:
                    '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151'
                }}
              >
                معاينة 10 أكواد
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
                style={{
                  minWidth: 160
                }}
              >
                {creatingCards
                  ? 'جارٍ إنشاء الكروت...'
                  : 'إنشاء الكروت الآن'}
              </button>
            </div>
          </div>

          {selectedPackageId &&
            !selectedProfileName && (
              <div
                style={{
                  marginTop: 15,
                  padding:
                    '11px 13px',
                  borderRadius: 10,
                  background:
                    '#fff7ed',
                  border:
                    '1px solid #fed7aa',
                  color: '#c2410c',
                  fontSize: 13,
                  fontWeight: 800
                }}
              >
                لا يمكن إنشاء الكروت لهذه
                الباقة حتى يتم ربطها بـ
                MikroTik Profile.
              </div>
            )}

          {previewCodes.length > 0 && (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 14,
                background:
                  '#f8fafc',
                border:
                  '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 10
                }}
              >
                معاينة الأكواد
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8
                }}
              >
                {previewCodes.map(
                  (code) => (
                    <div
                      key={code}
                      style={{
                        padding: 10,
                        background:
                          '#fff',
                        border:
                          '1px solid #e2e8f0',
                        borderRadius: 9,
                        textAlign:
                          'center',
                        fontFamily:
                          'monospace',
                        fontWeight: 800
                      }}
                    >
                      {code}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ===================================================
              نتيجة الإنشاء
              =================================================== */}

          {creationResult && (
            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 15,
                background:
                  creationResult.success
                    ? '#f0fdf4'
                    : '#fef2f2',
                border:
                  creationResult.success
                    ? '1px solid #bbf7d0'
                    : '1px solid #fecaca'
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color:
                    creationResult.success
                      ? '#166534'
                      : '#b91c1c',
                  marginBottom: 10
                }}
              >
                {creationResult.success
                  ? 'تم إنشاء الكروت بنجاح'
                  : 'فشل إنشاء الكروت'}
              </div>

              {!creationResult.success && (
                <div
                  style={{
                    color: '#991b1b',
                    fontSize: 13
                  }}
                >
                  {creationResult.message}
                </div>
              )}

              {creationResult.success &&
                creationResult.data && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 10,
                        marginTop: 12
                      }}
                    >
                      <div
                        style={{
                          padding: 12,
                          background:
                            '#fff',
                          borderRadius: 10
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color:
                              '#64748b'
                          }}
                        >
                          المطلوب
                        </div>

                        <strong>
                          {
                            creationResult
                              .data
                              .requested
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: 12,
                          background:
                            '#fff',
                          borderRadius: 10
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color:
                              '#64748b'
                          }}
                        >
                          تم في MikroTik
                        </div>

                        <strong>
                          {
                            creationResult
                              .data
                              .createdInMikrotik
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: 12,
                          background:
                            '#fff',
                          borderRadius: 10
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color:
                              '#64748b'
                          }}
                        >
                          محفوظ في Supabase
                        </div>

                        <strong>
                          {
                            creationResult
                              .data
                              .savedInSupabase
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: 12,
                          background:
                            '#fff',
                          borderRadius: 10
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color:
                              '#64748b'
                          }}
                        >
                          فشل
                        </div>

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
                      .data.results
                      ?.successful
                      ?.length > 0 && (
                      <div
                        style={{
                          marginTop: 16
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            marginBottom: 8
                          }}
                        >
                          الكروت الناجحة
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap:
                              'wrap',
                            gap: 7
                          }}
                        >
                          {creationResult.data.results.successful.map(
                            (code) => (
                              <span
                                key={code}
                                style={{
                                  padding:
                                    '7px 10px',
                                  borderRadius:
                                    8,
                                  background:
                                    '#dcfce7',
                                  color:
                                    '#166534',
                                  fontFamily:
                                    'monospace',
                                  fontWeight:
                                    800,
                                  fontSize:
                                    12
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
                      .data.results
                      ?.failed
                      ?.length > 0 && (
                      <div
                        style={{
                          marginTop: 16
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            marginBottom: 8,
                            color:
                              '#b91c1c'
                          }}
                        >
                          الكروت الفاشلة
                        </div>

                        <div
                          style={{
                            display:
                              'grid',
                            gap: 7
                          }}
                        >
                          {creationResult.data.results.failed.map(
                            (item, index) => (
                              <div
                                key={`${item.code}-${index}`}
                                style={{
                                  padding: 9,
                                  borderRadius:
                                    8,
                                  background:
                                    '#fff',
                                  border:
                                    '1px solid #fecaca',
                                  fontSize:
                                    12
                                }}
                              >
                                <strong>
                                  {item.code}
                                </strong>

                                {' — '}

                                {item.error}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
        </div>

        {/* =====================================================
            تسلسل العملية
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 20,
            marginBottom: 25
          }}
        >
          <div
            style={{
              fontWeight: 900,
              marginBottom: 13
            }}
          >
            تسلسل العملية
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10
            }}
          >
            {[
              'إنشاء الباقة',
              'اختبار MikroTik',
              'ربط الـ Profile',
              'تحديد الكمية والكود',
              'إنشاء المستخدمين',
              'حفظ الكروت في Supabase'
            ].map((step, index) => (
              <div
                key={step}
                style={{
                  padding: 12,
                  borderRadius: 11,
                  background:
                    '#f8fafc',
                  border:
                    '1px solid #e2e8f0',
                  fontSize: 12
                }}
              >
                <span
                  style={{
                    display:
                      'inline-grid',
                    placeItems:
                      'center',
                    width: 24,
                    height: 24,
                    borderRadius:
                      '50%',
                    background:
                      '#ede9fe',
                    color:
                      '#6d28d9',
                    fontWeight: 900,
                    marginLeft: 7
                  }}
                >
                  {index + 1}
                </span>

                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
