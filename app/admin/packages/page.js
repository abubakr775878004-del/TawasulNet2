'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabaseClient';

export default function PackagesPage() {
  const { profile, loading: profileLoading } = useProfile();

  const [packages, setPackages] = useState([]);
  const [mikrotikProfiles, setMikrotikProfiles] = useState([]);
  const [mappings, setMappings] = useState({});

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const [error, setError] = useState('');
  const [packageMessage, setPackageMessage] = useState('');

  const [busyId, setBusyId] = useState(null);

  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingMikrotik, setLoadingMikrotik] = useState(false);

  const [savingMapping, setSavingMapping] = useState(null);

  const [connectionStatus, setConnectionStatus] =
    useState('idle');

  const [mikrotikMessage, setMikrotikMessage] =
    useState('');

  const [selectedPackageId, setSelectedPackageId] =
    useState('');

  const [cardQuantity, setCardQuantity] = useState(10);
  const [startCode, setStartCode] = useState('77');
  const [codeLength, setCodeLength] = useState(8);

  const [creatingCards, setCreatingCards] = useState(false);
  const [creationResult, setCreationResult] = useState(null);
  const [previewCodes, setPreviewCodes] = useState([]);

  const isAdmin =
    profile?.role === 'admin' &&
    profile?.status === 'active';

  const selectedPackage = useMemo(
    () =>
      packages.find(
        (pkg) => pkg.id === selectedPackageId
      ) || null,
    [packages, selectedPackageId]
  );

  /*
   * =========================================================
   * Supabase
   * =========================================================
   */

  async function loadPackages() {
    setLoadingPackages(true);
    setError('');

    const {
      data,
      error: fetchError
    } = await supabase
      .from('packages')
      .select('*, cards(id)')
      .order('created_at', {
        ascending: false
      });

    if (fetchError) {
      setError(
        `تعذر تحميل الباقات: ${fetchError.message}`
      );
      setPackages([]);
      setLoadingPackages(false);
      return;
    }

    const formatted = (data || []).map((pkg) => ({
      ...pkg,
      cardsCount: pkg.cards
        ? pkg.cards.length
        : 0
    }));

    setPackages(formatted);

    if (
      !selectedPackageId &&
      formatted.length > 0
    ) {
      setSelectedPackageId(
        formatted[0].id
      );
    }

    /*
     * إذا كانت الباقة المحددة حُذفت أو لم تعد موجودة،
     * ننتقل تلقائيًا إلى أول باقة.
     */
    if (
      selectedPackageId &&
      !formatted.some(
        (pkg) => pkg.id === selectedPackageId
      )
    ) {
      setSelectedPackageId(
        formatted[0]?.id || ''
      );
    }

    setLoadingPackages(false);
  }

  async function addPackage(event) {
    event.preventDefault();

    setError('');
    setPackageMessage('');

    const packageName = name.trim();
    const numericPrice = Number(price);

    if (!packageName) {
      setError('أدخل اسم الباقة.');
      return;
    }

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setError('أدخل سعرًا صحيحًا.');
      return;
    }

    const {
      data,
      error: insertError
    } = await supabase
      .from('packages')
      .insert({
        name: packageName,
        price: numericPrice
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const newPackage = {
      ...data,
      cardsCount: 0
    };

    setPackages((current) => [
      newPackage,
      ...current
    ]);

    setSelectedPackageId(data.id);

    setName('');
    setPrice('');

    setPackageMessage(
      'تمت إضافة الباقة بنجاح.'
    );
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
    setPackageMessage('');
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

    setPackages((current) =>
      current.filter(
        (pkg) => pkg.id !== id
      )
    );

    setMappings((current) => {
      const next = {
        ...current
      };

      delete next[id];

      return next;
    });

    if (selectedPackageId === id) {
      setSelectedPackageId('');
    }

    setPackageMessage(
      'تم حذف الباقة بنجاح.'
    );
  }

  /*
   * =========================================================
   * MikroTik API
   * =========================================================
   */

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token
    ) {
      throw new Error(
        'انتهت جلسة المدير. يرجى تسجيل الدخول مرة أخرى.'
      );
    }

    return session.access_token;
  }

  async function apiRequest(
    url,
    options = {}
  ) {
    const token =
      await getAccessToken();

    const response = await fetch(
      url,
      {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization:
            `Bearer ${token}`,
          'Content-Type':
            'application/json'
        },
        cache: 'no-store'
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error ||
          'حدث خطأ في الاتصال بالخادم.'
      );
    }

    return data;
  }

  async function loadMikrotikProfiles() {
    setLoadingMikrotik(true);
    setMikrotikMessage('');

    try {
      const data =
        await apiRequest(
          '/api/mikrotik/user-manager?action=profiles'
        );

      setMikrotikProfiles(
        data?.profiles || []
      );

      const mappingObject = {};

      for (
        const mapping of
          data?.mappings || []
      ) {
        mappingObject[
          mapping.package_id
        ] =
          mapping.mikrotik_profile_name;
      }

      setMappings(mappingObject);

      setConnectionStatus(
        'connected'
      );
    } catch (apiError) {
      setConnectionStatus(
        'error'
      );

      setMikrotikMessage(
        apiError?.message ||
          'تعذر الاتصال بـ MikroTik.'
      );
    } finally {
      setLoadingMikrotik(false);
    }
  }

  async function handleTestConnection() {
    setConnectionStatus(
      'testing'
    );

    setMikrotikMessage('');

    try {
      const data =
        await apiRequest(
          '/api/mikrotik/user-manager?action=test'
        );

      setConnectionStatus(
        'connected'
      );

      setMikrotikMessage(
        `تم الاتصال بنجاح — RouterOS ${
          data?.version ||
          'غير معروف'
        }`
      );

      await loadMikrotikProfiles();
    } catch (apiError) {
      setConnectionStatus(
        'error'
      );

      setMikrotikMessage(
        apiError?.message ||
          'فشل الاتصال بـ MikroTik.'
      );
    }
  }

  async function handleMappingChange(
    packageId,
    profileName
  ) {
    if (!profileName) {
      return;
    }

    setSavingMapping(packageId);
    setMikrotikMessage('');

    try {
      await apiRequest(
        '/api/mikrotik/user-manager',
        {
          method: 'POST',
          body: JSON.stringify({
            action:
              'save-mapping',
            packageId,
            profileName
          })
        }
      );

      setMappings((current) => ({
        ...current,
        [packageId]:
          profileName
      }));

      setMikrotikMessage(
        'تم حفظ ربط الباقة مع Profile بنجاح.'
      );
    } catch (apiError) {
      setMikrotikMessage(
        apiError?.message ||
          'تعذر حفظ الربط.'
      );
    } finally {
      setSavingMapping(null);
    }
  }

  /*
   * =========================================================
   * إنشاء ومعاينة أكواد الكروت
   * =========================================================
   */

  function generatePreviewCodes(
    quantity,
    prefix,
    length
  ) {
    const result = new Set();

    const remaining =
      length - prefix.length;

    if (remaining < 1) {
      return [];
    }

    const maximum =
      10 ** remaining;

    if (quantity > maximum) {
      return [];
    }

    while (
      result.size < quantity
    ) {
      let suffix = '';

      for (
        let i = 0;
        i < remaining;
        i += 1
      ) {
        suffix += Math.floor(
          Math.random() * 10
        );
      }

      result.add(
        `${prefix}${suffix}`
      );
    }

    return [
      ...result
    ];
  }

  function validateCardInputs() {
    const quantity =
      Number(cardQuantity);

    const length =
      Number(codeLength);

    const prefix =
      String(startCode).trim();

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      return {
        valid: false,
        message:
          'الكمية يجب أن تكون بين 1 و1000.'
      };
    }

    if (
      !/^[0-9]+$/.test(prefix)
    ) {
      return {
        valid: false,
        message:
          'البداية يجب أن تحتوي على أرقام فقط.'
      };
    }

    if (
      !Number.isInteger(length) ||
      length < 4 ||
      length > 32
    ) {
      return {
        valid: false,
        message:
          'طول الكرت يجب أن يكون بين 4 و32.'
      };
    }

    if (
      prefix.length >= length
    ) {
      return {
        valid: false,
        message:
          'طول البداية يجب أن يكون أقل من طول الكرت.'
      };
    }

    return {
      valid: true,
      quantity,
      length,
      prefix
    };
  }

  function handlePreview() {
    setCreationResult(null);

    const validation =
      validateCardInputs();

    if (!validation.valid) {
      setMikrotikMessage(
        validation.message
      );
      return;
    }

    if (!selectedPackage) {
      setMikrotikMessage(
        'اختر الباقة أولًا.'
      );
      return;
    }

    if (
      !mappings[
        selectedPackage.id
      ]
    ) {
      setMikrotikMessage(
        'يجب ربط الباقة بـ Profile من User Manager أولًا.'
      );
      return;
    }

    const codes =
      generatePreviewCodes(
        validation.quantity,
        validation.prefix,
        validation.length
      );

    if (!codes.length) {
      setMikrotikMessage(
        'تعذر إنشاء المعاينة.'
      );
      return;
    }

    setPreviewCodes(codes);

    setMikrotikMessage(
      `تم توليد معاينة ${codes.length} كرت.`
    );
  }

  async function handleCreateCards() {
    setCreationResult(null);

    if (!selectedPackage) {
      setMikrotikMessage(
        'اختر الباقة أولًا.'
      );
      return;
    }

    const profileName =
      mappings[
        selectedPackage.id
      ];

    if (!profileName) {
      setMikrotikMessage(
        'يجب ربط الباقة بـ Profile من User Manager أولًا.'
      );
      return;
    }

    const validation =
      validateCardInputs();

    if (!validation.valid) {
      setMikrotikMessage(
        validation.message
      );
      return;
    }

    const confirmed =
      window.confirm(
        `سيتم إنشاء ${validation.quantity} كرت فعليًا في MikroTik User Manager وربطها بالـ Profile:\n\n${profileName}\n\nثم حفظ الكروت الناجحة في نظام تواصل.\n\nهل تريد المتابعة؟`
      );

    if (!confirmed) {
      return;
    }

    setCreatingCards(true);
    setMikrotikMessage(
      'جارٍ إنشاء الكروت فعليًا...'
    );
    setCreationResult(null);

    try {
      const data =
        await apiRequest(
          '/api/mikrotik/user-manager',
          {
            method: 'POST',
            body: JSON.stringify({
              action:
                'create-cards',

              packageId:
                selectedPackage.id,

              quantity:
                validation.quantity,

              prefix:
                validation.prefix,

              codeLength:
                validation.length
            })
          }
        );

      setCreationResult(data);

      setPreviewCodes([]);

      setMikrotikMessage(
        `تم إنشاء ${data?.savedInSupabase || 0} كرت بنجاح من أصل ${data?.requested || validation.quantity}.`
      );

      await loadPackages();
    } catch (apiError) {
      setMikrotikMessage(
        apiError?.message ||
          'حدث خطأ أثناء إنشاء الكروت.'
      );
    } finally {
      setCreatingCards(false);
    }
  }

  useEffect(() => {
    if (
      !profileLoading &&
      isAdmin
    ) {
      loadPackages();
      loadMikrotikProfiles();
    }
  }, [
    profileLoading,
    isAdmin
  ]);

  /*
   * =========================================================
   * Loading / Authorization
   * =========================================================
   */

  if (profileLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center"
      >
        <div className="text-center">
          <h2 className="text-xl font-bold">
            غير مصرح
          </h2>

          <p className="mt-2 text-gray-500">
            هذه الصفحة متاحة للمدير فقط.
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div
      className="app"
      dir="rtl"
    >
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile?.full_name}
      />

      <div className="main">
        <h1>الباقات</h1>

        <p
          className="greet"
          style={{
            marginBottom: 20
          }}
        >
          إدارة باقات الكروت وأسعارها
        </p>

        {/* =====================================================
            إضافة باقة
        ====================================================== */}

        <div className="panel">
          <div className="panel-head">
            <h3>
              إضافة باقة جديدة
            </h3>
          </div>

          {error && (
            <div className="error-note">
              {error}
            </div>
          )}

          {packageMessage && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background:
                  '#eff6ff',
                color:
                  '#1d4ed8',
                fontSize: 14
              }}
            >
              {packageMessage}
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
              <label>
                اسم الباقة
              </label>

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
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
                min="0"
                value={price}
                onChange={(event) =>
                  setPrice(
                    event.target.value
                  )
                }
                placeholder="25"
              />
            </div>

            <button
              className="btn-primary"
              style={{
                width: 140
              }}
              type="submit"
            >
              إضافة
            </button>
          </form>
        </div>

        {/* =====================================================
            الباقات الحالية
            نفس شكل البطاقات الأفقية الأصلي
        ====================================================== */}

        <div className="panel">
          <div className="panel-head">
            <h3>
              الباقات الحالية
            </h3>

            <span className="muted">
              {packages.length}
            </span>
          </div>

          {loadingPackages ? (
            <div
              style={{
                padding: '35px 0',
                textAlign: 'center',
                color: '#6b7280'
              }}
            >
              جارٍ تحميل الباقات...
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 14,
                marginTop: 10
              }}
            >
              {packages.map((p) => {
                const mapping =
                  mappings[p.id];

                const isSelected =
                  selectedPackageId ===
                  p.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      minHeight: 82,
                      padding:
                        '14px 18px',
                      background:
                        '#ffffff',
                      border:
                        isSelected
                          ? '1px solid #2563eb'
                          : '1px solid #e5e7eb',
                      borderRadius: 10,
                      boxSizing:
                        'border-box',
                      boxShadow:
                        isSelected
                          ? '0 0 0 2px rgba(37,99,235,.08)'
                          : 'none'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        gap: 16
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
                            color:
                              '#111827',
                            marginBottom: 6,
                            whiteSpace:
                              'nowrap',
                            overflow:
                              'hidden',
                            textOverflow:
                              'ellipsis'
                          }}
                        >
                          {p.name}
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: 16,
                            flexWrap:
                              'wrap',
                            fontSize: 14
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                '#374151'
                            }}
                          >
                            {p.price} ريال
                          </span>

                          <span
                            style={{
                              fontWeight: 800,
                              color:
                                '#5B21B6'
                            }}
                          >
                            {p.cardsCount}{' '}
                            كرت
                          </span>
                        </div>
                      </div>

                      <button
                        className="btn-sm"
                        style={{
                          backgroundColor:
                            '#dc2626',
                          color:
                            '#ffffff',
                          opacity:
                            busyId ===
                            p.id
                              ? 0.6
                              : 1,
                          padding:
                            '6px 14px',
                          borderRadius:
                            '6px',
                          border:
                            'none',
                          flexShrink: 0,
                          cursor:
                            busyId ===
                            p.id
                              ? 'not-allowed'
                              : 'pointer'
                        }}
                        disabled={
                          busyId ===
                          p.id
                        }
                        onClick={() =>
                          deletePackage(
                            p.id,
                            p.name
                          )
                        }
                      >
                        {busyId ===
                        p.id
                          ? 'جارٍ...'
                          : 'حذف'}
                      </button>
                    </div>

                    {/* ربط الباقة بالـ MikroTik */}
                    <div
                      style={{
                        borderTop:
                          '1px solid #f1f5f9',
                        paddingTop: 10
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'space-between',
                          gap: 10,
                          marginBottom: 7
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color:
                              '#475569'
                          }}
                        >
                          User Manager
                        </span>

                        {mapping ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color:
                                '#16a34a'
                            }}
                          >
                            مربوط
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color:
                                '#dc2626'
                            }}
                          >
                            غير مربوط
                          </span>
                        )}
                      </div>

                      <select
                        value={
                          mapping || ''
                        }
                        onChange={(
                          event
                        ) => {
                          setSelectedPackageId(
                            p.id
                          );

                          handleMappingChange(
                            p.id,
                            event.target
                              .value
                          );
                        }}
                        disabled={
                          loadingMikrotik ||
                          savingMapping ===
                            p.id
                        }
                        style={{
                          width: '100%',
                          height: 40,
                          border:
                            '1px solid #d1d5db',
                          borderRadius:
                            7,
                          padding:
                            '0 10px',
                          background:
                            '#ffffff',
                          color:
                            '#111827',
                          fontSize: 13
                        }}
                      >
                        <option value="">
                          اختر Profile من User Manager
                        </option>

                        {mikrotikProfiles.map(
                          (
                            mikrotikProfile
                          ) => (
                            <option
                              key={
                                mikrotikProfile.id ||
                                mikrotikProfile.name
                              }
                              value={
                                mikrotikProfile.name
                              }
                            >
                              {
                                mikrotikProfile.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                );
              })}

              {packages.length === 0 && (
                <div
                  style={{
                    gridColumn:
                      '1 / -1',
                    padding:
                      '35px 0',
                    textAlign:
                      'center',
                    color:
                      '#6b7280'
                  }}
                >
                  لا توجد باقات حاليًا.
                </div>
              )}
            </div>
          )}
        </div>

        {/* =====================================================
            MikroTik
            يوضع تحت واجهة الباقات ولا يستبدلها
        ====================================================== */}

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>
                MikroTik User Manager
              </h3>

              <p
                style={{
                  margin:
                    '5px 0 0',
                  color:
                    '#6b7280',
                  fontSize: 13
                }}
              >
                إدارة Profiles وربطها بالباقات وإنشاء الكروت الفعلية.
              </p>
            </div>

            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap: 10,
                flexWrap:
                  'wrap'
              }}
            >
              <span
                style={{
                  padding:
                    '5px 10px',
                  borderRadius:
                    999,
                  fontSize: 12,
                  fontWeight: 800,
                  background:
                    connectionStatus ===
                    'connected'
                      ? '#dcfce7'
                      : connectionStatus ===
                        'testing'
                      ? '#fef3c7'
                      : connectionStatus ===
                        'error'
                      ? '#fee2e2'
                      : '#f3f4f6',
                  color:
                    connectionStatus ===
                    'connected'
                      ? '#15803d'
                      : connectionStatus ===
                        'testing'
                      ? '#a16207'
                      : connectionStatus ===
                        'error'
                      ? '#b91c1c'
                      : '#6b7280'
                }}
              >
                {connectionStatus ===
                'connected'
                  ? 'متصل'
                  : connectionStatus ===
                    'testing'
                  ? 'جارٍ الاختبار'
                  : connectionStatus ===
                    'error'
                  ? 'خطأ'
                  : 'غير مختبر'}
              </span>

              <button
                type="button"
                onClick={
                  handleTestConnection
                }
                disabled={
                  connectionStatus ===
                  'testing'
                }
                className="btn-primary"
                style={{
                  width: 'auto',
                  minWidth: 130
                }}
              >
                {connectionStatus ===
                'testing'
                  ? 'جارٍ الاختبار...'
                  : 'اختبار الاتصال'}
              </button>
            </div>
          </div>

          {mikrotikMessage && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                borderRadius: 8,
                background:
                  '#f8fafc',
                border:
                  '1px solid #e2e8f0',
                color:
                  '#334155',
                fontSize: 13
              }}
            >
              {mikrotikMessage}
            </div>
          )}

          <div
            style={{
              marginTop: 18
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                marginBottom: 10,
                color:
                  '#111827'
              }}
            >
              Profiles الموجودة في User Manager
            </div>

            {loadingMikrotik ? (
              <div
                style={{
                  padding:
                    '25px 0',
                  textAlign:
                    'center',
                  color:
                    '#6b7280'
                }}
              >
                جارٍ تحميل Profiles من User Manager...
              </div>
            ) : mikrotikProfiles.length ===
              0 ? (
              <div
                style={{
                  padding: 15,
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: 8,
                  color:
                    '#6b7280',
                  fontSize: 13
                }}
              >
                لا توجد Profiles أو لم يتم الاتصال بالراوتر.
              </div>
            ) : (
              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10
                }}
              >
                {mikrotikProfiles.map(
                  (mikrotikProfile) => (
                    <div
                      key={
                        mikrotikProfile.id ||
                        mikrotikProfile.name
                      }
                      style={{
                        border:
                          '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                        background:
                          '#ffffff'
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          color:
                            '#111827',
                          fontSize: 14
                        }}
                      >
                        {
                          mikrotikProfile.name
                        }
                      </div>

                      {mikrotikProfile.price !==
                        '0' && (
                        <div
                          style={{
                            marginTop: 5,
                            color:
                              '#6b7280',
                            fontSize: 12
                          }}
                        >
                          السعر:{' '}
                          {
                            mikrotikProfile.price
                          }
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: 3,
                          color:
                            '#6b7280',
                          fontSize: 12
                        }}
                      >
                        الصلاحية:{' '}
                        {
                          mikrotikProfile.validity
                        }
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            إنشاء الكروت الفعلية
        ====================================================== */}

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>
                إنشاء كروت فعلية
              </h3>

              <p
                style={{
                  margin:
                    '5px 0 0',
                  color:
                    '#6b7280',
                  fontSize: 13
                }}
              >
                سيتم إنشاء المستخدمين داخل MikroTik User Manager أولًا، ثم حفظ الكروت الناجحة في نظام تواصل.
              </p>
            </div>
          </div>

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 15
            }}
          >
            <div className="field">
              <label>
                الباقة
              </label>

              <select
                value={
                  selectedPackageId
                }
                onChange={(
                  event
                ) => {
                  setSelectedPackageId(
                    event.target.value
                  );

                  setPreviewCodes(
                    []
                  );

                  setCreationResult(
                    null
                  );
                }}
              >
                <option value="">
                  اختر الباقة
                </option>

                {packages.map(
                  (pkg) => (
                    <option
                      key={
                        pkg.id
                      }
                      value={
                        pkg.id
                      }
                    >
                      {pkg.name} — {pkg.price} ريال
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="field">
              <label>
                عدد الكروت
              </label>

              <input
                type="number"
                min="1"
                max="1000"
                value={
                  cardQuantity
                }
                onChange={(
                  event
                ) =>
                  setCardQuantity(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="field">
              <label>
                بداية الكود
              </label>

              <input
                value={
                  startCode
                }
                onChange={(
                  event
                ) =>
                  setStartCode(
                    event.target.value
                  )
                }
                inputMode="numeric"
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
                value={
                  codeLength
                }
                onChange={(
                  event
                ) =>
                  setCodeLength(
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          <div
            style={{
              display:
                'flex',
              gap: 10,
              flexWrap:
                'wrap',
              marginTop: 15
            }}
          >
            <button
              type="button"
              onClick={
                handlePreview
              }
              disabled={
                creatingCards
              }
              className="btn-primary"
              style={{
                width: 'auto'
              }}
            >
              معاينة الأكواد
            </button>

            <button
              type="button"
              onClick={
                handleCreateCards
              }
              disabled={
                creatingCards
              }
              style={{
                width: 'auto',
                minWidth: 170,
                border: 'none',
                borderRadius: 7,
                padding:
                  '9px 16px',
                background:
                  creatingCards
                    ? '#9ca3af'
                    : '#16a34a',
                color:
                  '#ffffff',
                fontWeight: 800,
                cursor:
                  creatingCards
                    ? 'not-allowed'
                    : 'pointer'
              }}
            >
              {creatingCards
                ? 'جارٍ إنشاء الكروت...'
                : 'إنشاء الكروت فعليًا'}
            </button>
          </div>

          {previewCodes.length >
            0 && (
            <div
              style={{
                marginTop: 18
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  marginBottom: 8
                }}
              >
                معاينة الأكواد
              </div>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 7
                }}
              >
                {previewCodes.map(
                  (code) => (
                    <div
                      key={
                        code
                      }
                      style={{
                        padding:
                          '8px 10px',
                        border:
                          '1px solid #e5e7eb',
                        borderRadius:
                          6,
                        background:
                          '#f8fafc',
                        fontFamily:
                          'monospace',
                        textAlign:
                          'center',
                        fontSize: 13,
                        fontWeight: 700
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
                marginTop: 18,
                padding: 14,
                borderRadius: 8,
                background:
                  '#f0fdf4',
                border:
                  '1px solid #bbf7d0'
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  color:
                    '#166534',
                  marginBottom: 8
                }}
              >
                نتيجة إنشاء الكروت
              </div>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 8,
                  fontSize: 13
                }}
              >
                <div>
                  المطلوب:{' '}
                  <strong>
                    {
                      creationResult.requested
                    }
                  </strong>
                </div>

                <div>
                  تم إنشاؤه في MikroTik:{' '}
                  <strong>
                    {
                      creationResult.createdInMikrotik
                    }
                  </strong>
                </div>

                <div>
                  حُفظ في Supabase:{' '}
                  <strong>
                    {
                      creationResult.savedInSupabase
                    }
                  </strong>
                </div>

                <div>
                  فشل:{' '}
                  <strong>
                    {
                      creationResult.failed
                    }
                  </strong>
                </div>
              </div>

              {creationResult
                ?.results
                ?.successful
                ?.length > 0 && (
                <div
                  style={{
                    marginTop: 12
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginBottom: 6
                    }}
                  >
                    الكروت الناجحة
                  </div>

                  <div
                    style={{
                      display:
                        'flex',
                      gap: 6,
                      flexWrap:
                        'wrap'
                    }}
                  >
                    {creationResult.results.successful.map(
                      (code) => (
                        <span
                          key={
                            code
                          }
                          style={{
                            padding:
                              '5px 8px',
                            borderRadius:
                              5,
                            background:
                              '#dcfce7',
                            color:
                              '#166534',
                            fontFamily:
                              'monospace',
                            fontSize: 12
                          }}
                        >
                          {code}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
