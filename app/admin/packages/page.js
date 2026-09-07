'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');

  /* =========================================================
     Packages
     ========================================================= */

  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  /* =========================================================
     MikroTik Settings
     ========================================================= */

  const [mikrotikUrl, setMikrotikUrl] = useState('');
  const [mikrotikUsername, setMikrotikUsername] = useState('');
  const [mikrotikPassword, setMikrotikPassword] = useState('');

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [settingsConfigured, setSettingsConfigured] = useState(false);
  const [settingsSource, setSettingsSource] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  /* =========================================================
     MikroTik Connection
     ========================================================= */

  const [mikrotikProfiles, setMikrotikProfiles] = useState([]);
  const [mappings, setMappings] = useState([]);

  const [mikrotikLoading, setMikrotikLoading] = useState(false);
  const [mikrotikTesting, setMikrotikTesting] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);

  const [mikrotikConnected, setMikrotikConnected] = useState(false);
  const [mikrotikMessage, setMikrotikMessage] = useState('');

  /* =========================================================
     Selected Package
     ========================================================= */

  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedProfileName, setSelectedProfileName] = useState('');

  /* =========================================================
     Card Creation
     ========================================================= */

  const [cardQuantity, setCardQuantity] = useState(10);
  const [codePrefix, setCodePrefix] = useState('77');
  const [codeLength, setCodeLength] = useState(8);

  const [creatingCards, setCreatingCards] = useState(false);
  const [creationResult, setCreationResult] = useState(null);
  const [previewCodes, setPreviewCodes] = useState([]);

  /* =========================================================
     Common Styles
     ========================================================= */

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e8e7ef',
    borderRadius: 18,
    boxShadow: '0 8px 30px rgba(31, 25, 60, 0.06)'
  };

  const sectionTitleStyle = {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: '#17141f'
  };

  const mutedStyle = {
    color: '#6b7280',
    fontSize: 13
  };

  /* =========================================================
     Load Packages
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
     MikroTik API Request
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
     Load MikroTik Settings
     ========================================================= */

  async function loadMikrotikSettings() {
    setSettingsLoading(true);

    try {
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager?action=settings'
      );

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'تعذر تحميل إعدادات MikroTik.'
        );
      }

      setMikrotikUrl(data.routerUrl || '');
      setMikrotikUsername(data.username || '');

      setSettingsConfigured(
        Boolean(data.configured)
      );

      setPasswordSaved(
        Boolean(data.hasPassword)
      );

      setSettingsSource(
        data.source || ''
      );
    } catch (err) {
      setSettingsConfigured(false);
      setPasswordSaved(false);

      /*
       * لا نظهر خطأ قوي هنا عند أول تحميل،
       * لأن route.js سيتم تعديله في الخطوة التالية.
       */
      console.warn(
        'MikroTik settings:',
        err?.message
      );
    } finally {
      setSettingsLoading(false);
    }
  }

  /* =========================================================
     Save MikroTik Settings
     ========================================================= */

  async function saveMikrotikSettings() {
    setMikrotikMessage('');

    const routerUrl = mikrotikUrl.trim();
    const username = mikrotikUsername.trim();

    if (!routerUrl) {
      setMikrotikMessage(
        'يرجى إدخال عنوان MikroTik.'
      );
      return;
    }

    if (!/^https:\/\//i.test(routerUrl)) {
      setMikrotikMessage(
        'عنوان MikroTik يجب أن يبدأ بـ https://'
      );
      return;
    }

    if (!username) {
      setMikrotikMessage(
        'يرجى إدخال اسم مستخدم User Manager.'
      );
      return;
    }

    /*
     * عند وجود كلمة مرور محفوظة يمكن ترك الحقل فارغًا.
     */
    if (!mikrotikPassword.trim() && !passwordSaved) {
      setMikrotikMessage(
        'يرجى إدخال كلمة مرور MikroTik.'
      );
      return;
    }

    setSettingsSaving(true);
    setMikrotikConnected(false);

    try {
      const data = await mikrotikRequest(
        '/api/mikrotik/user-manager',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'save-settings',
            routerUrl,
            username,
            password: mikrotikPassword
          })
        }
      );

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'تعذر حفظ إعدادات MikroTik.'
        );
      }

      setSettingsConfigured(true);
      setPasswordSaved(true);
      setSettingsSource(
        data.source || 'database'
      );

      /*
       * لا نحتفظ بكلمة المرور في حالة الواجهة.
       */
      setMikrotikPassword('');

      setMikrotikMessage(
        'تم حفظ إعدادات MikroTik. جارٍ اختبار الاتصال...'
      );

      await testMikrotikConnection();
    } catch (err) {
      setMikrotikConnected(false);

      setMikrotikMessage(
        err?.message ||
          'تعذر حفظ إعدادات MikroTik.'
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  /* =========================================================
     Test MikroTik Connection
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
          ? `تم الاتصال بنجاح — ${details.join(' — ')}`
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
     Load MikroTik Profiles
     ========================================================= */

  async function loadMikrotikProfiles() {
    setMikrotikLoading(true);

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

      if (!mikrotikConnected) {
        setMikrotikMessage(
          err?.message ||
            'تعذر الاتصال بـ MikroTik.'
        );
      }
    } finally {
      setMikrotikLoading(false);
    }
  }

  /* =========================================================
     Save Package / Profile Mapping
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
        'يرجى اختيار Profile.'
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
        'تم ربط الباقة بـ Profile بنجاح.'
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
     Get Mapped Profile
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
     Select Package
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
     Preview Codes
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
     Create Cards
     ========================================================= */

  async function createCards() {
    setCreationResult(null);
    setPreviewCodes([]);

    if (!mikrotikConnected) {
      setCreationResult({
        success: false,
        message:
          'يرجى التأكد من اتصال MikroTik أولًا.'
      });
      return;
    }

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
          'هذه الباقة غير مربوطة بـ MikroTik Profile.'
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
    if (!profile) return;

    loadPackages();
    loadMikrotikSettings();
  }, [profile]);

  /* =========================================================
     Add Package
     ========================================================= */

  async function addPackage(e) {
    e.preventDefault();

    setError('');

    const packageName = name.trim();
    const packagePrice = Number(price);

    if (!packageName) {
      setError('يرجى إدخال اسم الباقة.');
      return;
    }

    if (
      !Number.isFinite(packagePrice) ||
      packagePrice <= 0
    ) {
      setError('يرجى إدخال سعر صحيح.');
      return;
    }

    const { error: insertError } =
      await supabase
        .from('packages')
        .insert({
          name: packageName,
          price: packagePrice
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
     Delete Package
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
        'تعذّر حذف الباقة — على الأغلب توجد كروت أو طلبات مرتبطة بها حاليًا.'
      );
      return;
    }

    if (selectedPackageId === id) {
      setSelectedPackageId('');
      setSelectedProfileName('');
      setCreationResult(null);
      setPreviewCodes([]);
    }

    await loadPackages();
    await loadMikrotikProfiles();
  }

  if (loading) {
    return null;
  }

  /* =========================================================
     Derived Data
     ========================================================= */

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
            Header
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: '25px 27px',
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
                maxWidth: 700
              }}
            >
              كل ما تحتاجه للباقات وUser Manager
              وإنشاء الكروت موجود هنا في صفحة واحدة.
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
            MikroTik Connection — FIRST
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20,
            border:
              mikrotikConnected
                ? '1px solid #bbf7d0'
                : '1px solid #e8e7ef'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 15,
              flexWrap: 'wrap',
              marginBottom: 18
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    display: 'grid',
                    placeItems: 'center',
                    background:
                      mikrotikConnected
                        ? '#dcfce7'
                        : '#f3e8ff',
                    color:
                      mikrotikConnected
                        ? '#15803d'
                        : '#6d28d9',
                    fontSize: 19,
                    fontWeight: 900
                  }}
                >
                  ⌁
                </span>

                <h2
                  style={{
                    ...sectionTitleStyle,
                    fontSize: 21
                  }}
                >
                  اتصال MikroTik / User Manager
                </h2>
              </div>

              <div style={mutedStyle}>
                أدخل بيانات جهاز MikroTik مرة واحدة،
                ثم اختبر الاتصال. لا توجد صفحة إعدادات
                منفصلة.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 13px',
                borderRadius: 11,
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
                fontSize: 13,
                fontWeight: 900
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background:
                    mikrotikConnected
                      ? '#22c55e'
                      : '#f59e0b'
                }}
              />

              {mikrotikConnected
                ? 'متصل وجاهز'
                : settingsConfigured
                ? 'الإعدادات محفوظة'
                : 'غير متصل'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(220px, 1.5fr) minmax(180px, .8fr) minmax(180px, .8fr)',
              gap: 12
            }}
          >
            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
              <label>عنوان MikroTik</label>

              <input
                type="url"
                value={mikrotikUrl}
                onChange={(e) => {
                  setMikrotikUrl(e.target.value);
                  setMikrotikConnected(false);
                }}
                disabled={settingsLoading}
                placeholder="https://192.168.88.1"
                dir="ltr"
              />
            </div>

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
              <label>اسم المستخدم</label>

              <input
                type="text"
                value={mikrotikUsername}
                onChange={(e) => {
                  setMikrotikUsername(e.target.value);
                  setMikrotikConnected(false);
                }}
                disabled={settingsLoading}
                placeholder="admin"
                dir="ltr"
                autoComplete="off"
              />
            </div>

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
              <label>كلمة المرور</label>

              <div
                style={{
                  display: 'flex',
                  gap: 7
                }}
              >
                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={mikrotikPassword}
                  onChange={(e) => {
                    setMikrotikPassword(
                      e.target.value
                    );
                    setMikrotikConnected(false);
                  }}
                  disabled={settingsLoading}
                  placeholder={
                    passwordSaved
                      ? 'محفوظة — اتركها فارغة'
                      : 'أدخل كلمة المرور'
                  }
                  dir="ltr"
                  autoComplete="new-password"
                  style={{
                    flex: 1,
                    minWidth: 0
                  }}
                />

                <button
                  type="button"
                  className="btn-sm"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  style={{
                    minWidth: 46,
                    padding: '8px 10px',
                    border:
                      '1px solid #d1d5db',
                    background: '#fff',
                    borderRadius: 9
                  }}
                >
                  {showPassword
                    ? 'إخفاء'
                    : 'إظهار'}
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 12
              }}
            >
              {settingsSource === 'database'
                ? 'الإعدادات محفوظة بأمان في النظام.'
                : settingsSource === 'environment'
                ? 'يتم استخدام إعدادات الخادم الحالية.'
                : passwordSaved
                ? 'كلمة المرور محفوظة. لا تحتاج لإدخالها مرة أخرى.'
                : 'أدخل بيانات الاتصال ثم احفظها.'}
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
                  testMikrotikConnection
                }
                disabled={
                  mikrotikTesting ||
                  settingsSaving ||
                  !settingsConfigured
                }
                style={{
                  padding: '10px 15px',
                  borderRadius: 9,
                  border:
                    '1px solid #d1d5db',
                  background: '#fff',
                  fontWeight: 800
                }}
              >
                {mikrotikTesting
                  ? 'جارٍ الاختبار...'
                  : 'اختبار الاتصال'}
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={
                  saveMikrotikSettings
                }
                disabled={
                  settingsSaving ||
                  settingsLoading
                }
                style={{
                  minWidth: 150
                }}
              >
                {settingsSaving
                  ? 'جارٍ الحفظ...'
                  : 'حفظ واختبار الاتصال'}
              </button>
            </div>
          </div>

          {mikrotikMessage && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 11,
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
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.7
              }}
            >
              {mikrotikMessage}
            </div>
          )}
        </div>

        {/* =====================================================
            Small Stats
            ===================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}
        >
          <div
            style={{
              ...cardStyle,
              padding: 17
            }}
          >
            <div style={mutedStyle}>
              إجمالي الباقات
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4
              }}
            >
              {packages.length}
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              padding: 17
            }}
          >
            <div style={mutedStyle}>
              إجمالي الكروت
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4
              }}
            >
              {totalCards}
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              padding: 17
            }}
          >
            <div style={mutedStyle}>
              الباقات المربوطة
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4
              }}
            >
              {mappedPackages}
            </div>
          </div>
        </div>

        {/* =====================================================
            Add Package
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h2 style={sectionTitleStyle}>
              إضافة باقة جديدة
            </h2>

            <div
              style={{
                ...mutedStyle,
                marginTop: 5
              }}
            >
              أضف اسم الباقة وسعرها فقط.
            </div>
          </div>

          <form
            onSubmit={addPackage}
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(200px, 1fr) minmax(150px, .6fr) auto',
              gap: 10,
              alignItems: 'end'
            }}
          >
            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
              <label>اسم الباقة</label>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="باقة 200"
              />
            </div>

            <div
              className="field"
              style={{ marginBottom: 0 }}
            >
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
              style={{
                minHeight: 42
              }}
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

        {/* =====================================================
            Packages
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
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 17
            }}
          >
            <div>
              <h2 style={sectionTitleStyle}>
                الباقات
              </h2>

              <div
                style={{
                  ...mutedStyle,
                  marginTop: 5
                }}
              >
                اختر باقة واحدة للعمل عليها.
              </div>
            </div>

            <div
              style={{
                padding: '7px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border:
                  '1px solid #e2e8f0',
                fontWeight: 800,
                fontSize: 13
              }}
            >
              {packages.length} باقة
            </div>
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
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 13
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
                      borderRadius: 15,
                      padding: 16,
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
                        gap: 10
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
                          borderRadius: 9,
                          fontSize: 12,
                          fontWeight: 800,
                          height: 'fit-content'
                        }}
                      >
                        {p.cardsCount || 0} كرت
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 13,
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
                        ? `Profile: ${mapped}`
                        : 'لم يتم ربط Profile'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 13
                      }}
                    >
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          handlePackageSelection(
                            p.id
                          )
                        }
                        style={{
                          flex: 1,
                          minHeight: 40
                        }}
                      >
                        {selected
                          ? 'الباقة الحالية'
                          : 'اختيار الباقة'}
                      </button>

                      <button
                        type="button"
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
                            '#dc2626',
                          fontWeight: 800
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
            Package / Profile Mapping
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 20,
            opacity: mikrotikConnected ? 1 : 0.72
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 17
            }}
          >
            <div>
              <h2 style={sectionTitleStyle}>
                ربط الباقة بـ User Manager
              </h2>

              <div
                style={{
                  ...mutedStyle,
                  marginTop: 5
                }}
              >
                اختر الباقة ثم Profile الموجود
                فعلًا في MikroTik.
              </div>
            </div>

            <button
              type="button"
              className="btn-sm"
              onClick={
                loadMikrotikProfiles
              }
              disabled={
                !mikrotikConnected ||
                mikrotikLoading
              }
              style={{
                padding: '9px 14px',
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

          {!mikrotikConnected ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: '#fff7ed',
                border:
                  '1px solid #fed7aa',
                color: '#9a3412',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              اتصل بـ MikroTik أولًا حتى تظهر
              Profiles الموجودة في User Manager.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr auto',
                  gap: 12,
                  alignItems: 'end'
                }}
              >
                <div
                  className="field"
                  style={{
                    marginBottom: 0
                  }}
                >
                  <label>الباقة</label>

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
                  style={{
                    marginBottom: 0
                  }}
                >
                  <label>
                    User Manager Profile
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
                        ? 'جارٍ التحميل...'
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
                    : 'حفظ الربط'}
                </button>
              </div>

              {selectedProfile && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 11,
                    background: '#f8fafc',
                    border:
                      '1px solid #e2e8f0',
                    fontSize: 13
                  }}
                >
                  <strong>
                    Profile المحدد:
                  </strong>{' '}
                  {selectedProfile.name}
                </div>
              )}
            </>
          )}
        </div>

        {/* =====================================================
            Create Cards
            ===================================================== */}

        <div
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 25,
            opacity: mikrotikConnected ? 1 : 0.72
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 17
            }}
          >
            <div>
              <h2 style={sectionTitleStyle}>
                إنشاء الكروت
              </h2>

              <div
                style={{
                  ...mutedStyle,
                  marginTop: 5
                }}
              >
                يتم إنشاء المستخدمين في MikroTik
                ثم حفظ الكروت الناجحة في Supabase.
              </div>
            </div>

            {selectedPackage && (
              <div
                style={{
                  padding: '9px 13px',
                  borderRadius: 11,
                  background: '#f3e8ff',
                  color: '#6d28d9',
                  fontWeight: 900
                }}
              >
                {selectedPackage.name}
              </div>
            )}
          </div>

          {!mikrotikConnected ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: '#fff7ed',
                border:
                  '1px solid #fed7aa',
                color: '#9a3412',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              بعد نجاح الاتصال بـ MikroTik ستتمكن
              من إنشاء الكروت.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(180px, 1.3fr) repeat(3, minmax(140px, .7fr))',
                  gap: 12
                }}
              >
                <div
                  style={{
                    padding: 13,
                    borderRadius: 12,
                    background: '#f8fafc',
                    border:
                      '1px solid #e2e8f0'
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      marginBottom: 4
                    }}
                  >
                    الباقة
                  </div>

                  <strong>
                    {selectedPackage
                      ? `${selectedPackage.name} — ${selectedPackage.price} ريال`
                      : 'لم يتم اختيار باقة'}
                  </strong>

                  {selectedProfileName && (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12,
                        color: '#166534'
                      }}
                    >
                      Profile:{' '}
                      {selectedProfileName}
                    </div>
                  )}
                </div>

                <div
                  className="field"
                  style={{
                    marginBottom: 0
                  }}
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
                  style={{
                    marginBottom: 0
                  }}
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
                    dir="ltr"
                  />
                </div>

                <div
                  className="field"
                  style={{
                    marginBottom: 0
                  }}
                >
                  <label>
                    طول الكود
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
                  marginTop: 16,
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: 14,
                  borderRadius: 13,
                  background: '#fafafa',
                  border:
                    '1px solid #eeeeee'
                }}
              >
                <div
                  style={{
                    color: '#64748b',
                    fontSize: 12
                  }}
                >
                  يبدأ الكود بـ{' '}
                  <strong>
                    {codePrefix || '—'}
                  </strong>{' '}
                  وطوله{' '}
                  <strong>
                    {codeLength || '—'}
                  </strong>{' '}
                  والكمية{' '}
                  <strong>
                    {cardQuantity || '—'}
                  </strong>.
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
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
                      background: '#fff'
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
                    style={{
                      minWidth: 160
                    }}
                  >
                    {creatingCards
                      ? 'جارٍ الإنشاء...'
                      : 'إنشاء الكروت الآن'}
                  </button>
                </div>
              </div>

              {selectedPackageId &&
                !selectedProfileName && (
                  <div
                    style={{
                      marginTop: 13,
                      padding: 11,
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
                    اربط الباقة بـ User Manager
                    Profile أولًا.
                  </div>
                )}

              {previewCodes.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 15,
                    borderRadius: 13,
                    background: '#f8fafc',
                    border:
                      '1px solid #e2e8f0'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      marginBottom: 9
                    }}
                  >
                    معاينة أول 10 أكواد
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

              {creationResult && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 17,
                    borderRadius: 14,
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
                      fontSize: 17,
                      fontWeight: 900,
                      color:
                        creationResult.success
                          ? '#166534'
                          : '#b91c1c',
                      marginBottom: 9
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
                      {
                        creationResult.message
                      }
                    </div>
                  )}

                  {creationResult.success &&
                    creationResult.data && (
                      <>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 9
                          }}
                        >
                          <div
                            style={{
                              padding: 11,
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
                              padding: 11,
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
                              في MikroTik
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
                              padding: 11,
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
                              في Supabase
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
                              padding: 11,
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

                        {creationResult.data
                          .results
                          ?.successful
                          ?.length > 0 && (
                          <div
                            style={{
                              marginTop: 15
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

                        {creationResult.data
                          .results
                          ?.failed
                          ?.length > 0 && (
                          <div
                            style={{
                              marginTop: 15
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
                                display: 'grid',
                                gap: 7
                              }}
                            >
                              {creationResult.data.results.failed.map(
                                (
                                  item,
                                  index
                                ) => (
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
                                      {
                                        item.code
                                      }
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
