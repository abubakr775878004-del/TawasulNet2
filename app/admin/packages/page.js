'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabaseClient';

export default function PackagesPage() {
  const { profile, loading: profileLoading } =
    useProfile();

  const [packages, setPackages] = useState([]);
  const [mikrotikProfiles, setMikrotikProfiles] =
    useState([]);

  const [mappings, setMappings] = useState({});

  const [loadingPackages, setLoadingPackages] =
    useState(true);

  const [loadingMikrotik, setLoadingMikrotik] =
    useState(false);

  const [savingMapping, setSavingMapping] =
    useState(null);

  const [connectionStatus, setConnectionStatus] =
    useState('idle');

  const [mikrotikMessage, setMikrotikMessage] =
    useState('');

  const [selectedPackageId, setSelectedPackageId] =
    useState('');

  const [cardQuantity, setCardQuantity] =
    useState(10);

  const [startCode, setStartCode] =
    useState('77');

  const [codeLength, setCodeLength] =
    useState(8);

  const [creatingCards, setCreatingCards] =
    useState(false);

  const [creationResult, setCreationResult] =
    useState(null);

  const [previewCodes, setPreviewCodes] =
    useState([]);

  const [newPackageName, setNewPackageName] =
    useState('');

  const [newPackagePrice, setNewPackagePrice] =
    useState('');

  const [packageMessage, setPackageMessage] =
    useState('');

  const isAdmin =
    profile?.role === 'admin' &&
    profile?.status === 'active';

  const selectedPackage = useMemo(
    () =>
      packages.find(
        (pkg) =>
          pkg.id === selectedPackageId
      ) || null,
    [packages, selectedPackageId]
  );

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
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

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization:
          `Bearer ${token}`,
        'Content-Type':
          'application/json',
      },
      cache: 'no-store',
    });

    const data =
      await response.json().catch(
        () => ({})
      );

    if (!response.ok) {
      throw new Error(
        data?.error ||
          'حدث خطأ في الاتصال بالخادم.'
      );
    }

    return data;
  }

  async function loadPackages() {
    setLoadingPackages(true);

    const {
      data,
      error,
    } = await supabase
      .from('packages')
      .select(
        '*, cards(id)'
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (error) {
      setPackageMessage(
        `تعذر تحميل الباقات: ${error.message}`
      );
      setPackages([]);
    } else {
      const formatted =
        (data || []).map(
          (pkg) => ({
            ...pkg,
            cardsCount:
              pkg.cards
                ? pkg.cards.length
                : 0,
          })
        );

      setPackages(formatted);

      if (
        !selectedPackageId &&
        formatted.length
      ) {
        setSelectedPackageId(
          formatted[0].id
        );
      }
    }

    setLoadingPackages(false);
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
        data.profiles || []
      );

      const mappingObject = {};

      for (const mapping of
        data.mappings || []) {
        mappingObject[
          mapping.package_id
        ] =
          mapping.mikrotik_profile_name;
      }

      setMappings(mappingObject);

      setConnectionStatus(
        'connected'
      );
    } catch (error) {
      setConnectionStatus(
        'error'
      );

      setMikrotikMessage(
        error.message ||
          'تعذر الاتصال بـ MikroTik.'
      );
    } finally {
      setLoadingMikrotik(false);
    }
  }

  useEffect(() => {
    if (!profileLoading && isAdmin) {
      loadPackages();
      loadMikrotikProfiles();
    }
  }, [
    profileLoading,
    isAdmin,
  ]);

  async function handleTestConnection() {
    setConnectionStatus('testing');
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
          data.version || 'غير معروف'
        }`
      );

      await loadMikrotikProfiles();
    } catch (error) {
      setConnectionStatus(
        'error'
      );

      setMikrotikMessage(
        error.message ||
          'فشل الاتصال بـ MikroTik.'
      );
    }
  }

  async function handleMappingChange(
    packageId,
    profileName
  ) {
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

            profileName,
          }),
        }
      );

      setMappings(
        (current) => ({
          ...current,
          [packageId]:
            profileName,
        })
      );

      setMikrotikMessage(
        'تم حفظ الربط بنجاح.'
      );
    } catch (error) {
      setMikrotikMessage(
        error.message ||
          'تعذر حفظ الربط.'
      );
    } finally {
      setSavingMapping(null);
    }
  }

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

    return [...result];
  }

  function handlePreview() {
    setCreationResult(null);

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
      setMikrotikMessage(
        'الكمية يجب أن تكون بين 1 و1000.'
      );
      return;
    }

    if (!/^[0-9]+$/.test(prefix)) {
      setMikrotikMessage(
        'البداية يجب أن تحتوي على أرقام فقط.'
      );
      return;
    }

    if (
      !Number.isInteger(length) ||
      length < 4 ||
      length > 32
    ) {
      setMikrotikMessage(
        'طول الكرت يجب أن يكون بين 4 و32.'
      );
      return;
    }

    if (
      prefix.length >= length
    ) {
      setMikrotikMessage(
        'طول البداية يجب أن يكون أقل من طول الكرت.'
      );
      return;
    }

    if (
      !selectedPackage
    ) {
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
        quantity,
        prefix,
        length
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
      setMikrotikMessage(
        'الكمية يجب أن تكون بين 1 و1000.'
      );
      return;
    }

    if (!/^[0-9]+$/.test(prefix)) {
      setMikrotikMessage(
        'البداية يجب أن تحتوي على أرقام فقط.'
      );
      return;
    }

    if (
      !Number.isInteger(length) ||
      length < 4 ||
      length > 32
    ) {
      setMikrotikMessage(
        'طول الكرت غير صحيح.'
      );
      return;
    }

    if (
      prefix.length >= length
    ) {
      setMikrotikMessage(
        'طول البداية يجب أن يكون أقل من طول الكرت.'
      );
      return;
    }

    const confirmed =
      window.confirm(
        `سيتم إنشاء ${quantity} كرت فعليًا في MikroTik User Manager وربطها بالـ Profile:\n\n${profileName}\n\nثم حفظ الكروت الناجحة في النظام.\n\nهل تريد المتابعة؟`
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

              quantity,

              prefix,

              codeLength: length,
            }),
          }
        );

      setCreationResult(
        data
      );

      setPreviewCodes([]);

      setMikrotikMessage(
        `تم إنشاء ${data.savedInSupabase} كرت بنجاح من أصل ${data.requested}.`
      );

      await loadPackages();
    } catch (error) {
      setMikrotikMessage(
        error.message ||
          'حدث خطأ أثناء إنشاء الكروت.'
      );
    } finally {
      setCreatingCards(false);
    }
  }

  async function handleAddPackage(
    event
  ) {
    event.preventDefault();

    const name =
      newPackageName.trim();

    const numericPrice =
      Number(newPackagePrice);

    if (!name) {
      setPackageMessage(
        'أدخل اسم الباقة.'
      );
      return;
    }

    if (
      !Number.isFinite(
        numericPrice
      ) ||
      numericPrice <= 0
    ) {
      setPackageMessage(
        'أدخل سعرًا صحيحًا.'
      );
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from('packages')
      .insert({
        name,
        price:
          numericPrice,
      })
      .select()
      .single();

    if (error) {
      setPackageMessage(
        `تعذر إضافة الباقة: ${error.message}`
      );
      return;
    }

    setPackages(
      (current) => [
        {
          ...data,
          cardsCount: 0,
        },
        ...current,
      ]
    );

    setSelectedPackageId(
      data.id
    );

    setNewPackageName('');
    setNewPackagePrice('');

    setPackageMessage(
      'تمت إضافة الباقة بنجاح.'
    );
  }

  async function handleDeletePackage(
    id
  ) {
    const confirmed =
      window.confirm(
        'هل أنت متأكد من حذف هذه الباقة؟'
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      setPackageMessage(
        `تعذر حذف الباقة: ${error.message}`
      );
      return;
    }

    setPackages(
      (current) =>
        current.filter(
          (pkg) =>
            pkg.id !== id
        )
    );

    setMappings(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );

    if (
      selectedPackageId === id
    ) {
      setSelectedPackageId('');
    }

    setPackageMessage(
      'تم حذف الباقة.'
    );
  }

  if (profileLoading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center"
      >
        جارٍ التحقق من صلاحيات المدير...
      </div>
    );
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

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50"
    >
      <Sidebar />

      <main className="mr-0 md:mr-64 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              إدارة الباقات والكروت
            </h1>

            <p className="mt-1 text-gray-500">
              إدارة باقات تواصل وربطها يدويًا مع User Manager.
            </p>
          </div>

          {packageMessage && (
            <div className="rounded-xl border bg-white p-4 text-sm">
              {packageMessage}
            </div>
          )}

          {mikrotikMessage && (
            <div className="rounded-xl border bg-white p-4 text-sm">
              {mikrotikMessage}
            </div>
          )}

          {/* MikroTik connection */}
          <section className="rounded-2xl bg-white border shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg">
                  MikroTik User Manager
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Profiles الحقيقية الموجودة داخل User Manager.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    connectionStatus ===
                    'connected'
                      ? 'bg-green-100 text-green-700'
                      : connectionStatus ===
                        'testing'
                      ? 'bg-yellow-100 text-yellow-700'
                      : connectionStatus ===
                        'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
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
                  className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-bold disabled:opacity-50"
                >
                  اختبار الاتصال
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              {loadingMikrotik ? (
                <div className="py-8 text-center text-gray-500">
                  جارٍ تحميل Profiles من User Manager...
                </div>
              ) : mikrotikProfiles.length ===
                0 ? (
                <div className="py-8 text-center text-gray-500">
                  لا توجد Profiles أو لم يتم الاتصال بالراوتر.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mikrotikProfiles.map(
                    (profile) => (
                      <div
                        key={
                          profile.id ||
                          profile.name
                        }
                        className="border rounded-xl p-4"
                      >
                        <div className="font-bold text-sm">
                          {profile.name}
                        </div>

                        {profile.price !==
                          '0' && (
                          <div className="text-xs text-gray-500 mt-1">
                            السعر في MikroTik:{' '}
                            {
                              profile.price
                            }
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          الصلاحية:{' '}
                          {
                            profile.validity
                          }
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Packages */}
          <section className="rounded-2xl bg-white border shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">
                باقات تواصل
              </h2>
            </div>

            {loadingPackages ? (
              <div className="py-8 text-center text-gray-500">
                جارٍ تحميل الباقات...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-3">
                        الباقة
                      </th>

                      <th className="text-right p-3">
                        السعر
                      </th>

                      <th className="text-right p-3">
                        الكروت
                      </th>

                      <th className="text-right p-3 min-w-[280px]">
                        User Manager Profile
                      </th>

                      <th className="text-right p-3">
                        الحالة
                      </th>

                      <th className="text-right p-3">
                        إجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {packages.map(
                      (pkg) => {
                        const mapping =
                          mappings[
                            pkg.id
                          ];

                        return (
                          <tr
                            key={
                              pkg.id
                            }
                            className="border-b last:border-0"
                          >
                            <td className="p-3 font-bold">
                              {
                                pkg.name
                              }
                            </td>

                            <td className="p-3">
                              {
                                pkg.price
                              }
                            </td>

                            <td className="p-3">
                              {
                                pkg.cardsCount
                              }
                            </td>

                            <td className="p-3">
                              <select
                                value={
                                  mapping ||
                                  ''
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleMappingChange(
                                    pkg.id,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  savingMapping ===
                                    pkg.id ||
                                  loadingMikrotik
                                }
                                className="w-full rounded-xl border px-3 py-2 bg-white"
                              >
                                <option value="">
                                  اختر Profile من User Manager
                                </option>

                                {mikrotikProfiles.map(
                                  (
                                    profile
                                  ) => (
                                    <option
                                      key={
                                        profile.id ||
                                        profile.name
                                      }
                                      value={
                                        profile.name
                                      }
                                    >
                                      {
                                        profile.name
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td className="p-3">
                              {mapping ? (
                                <span className="text-green-600 font-bold">
                                  مربوط
                                </span>
                              ) : (
                                <span className="text-red-600 font-bold">
                                  غير مربوط
                                </span>
                              )}
                            </td>

                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeletePackage(
                                    pkg.id
                                  )
                                }
                                className="text-red-600 font-bold"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Add package */}
          <section className="rounded-2xl bg-white border shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">
              إضافة باقة
            </h2>

            <form
              onSubmit={
                handleAddPackage
              }
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <input
                value={
                  newPackageName
                }
                onChange={(event) =>
                  setNewPackageName(
                    event.target.value
                  )
                }
                placeholder="اسم الباقة"
                className="rounded-xl border px-4 py-3"
              />

              <input
                type="number"
                min="1"
                value={
                  newPackagePrice
                }
                onChange={(event) =>
                  setNewPackagePrice(
                    event.target.value
                  )
                }
                placeholder="السعر"
                className="rounded-xl border px-4 py-3"
              />

              <button
                type="submit"
                className="rounded-xl bg-green-600 text-white font-bold px-4 py-3"
              >
                إضافة الباقة
              </button>
            </form>
          </section>

          {/* Card generator */}
          <section className="rounded-2xl bg-white border shadow-sm p-5">
            <h2 className="text-lg font-bold">
              إنشاء كروت فعلية
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              سيتم إنشاء المستخدمين داخل MikroTik User Manager أولًا، ثم حفظ الناجحين في نظام تواصل.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              <div>
                <label className="block text-sm font-bold mb-2">
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
                  className="w-full rounded-xl border px-4 py-3 bg-white"
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
                        {pkg.name} —{' '}
                        {
                          pkg.price
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  العدد
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
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  بداية الكرت
                </label>

                <input
                  inputMode="numeric"
                  value={
                    startCode
                  }
                  onChange={(
                    event
                  ) =>
                    setStartCode(
                      event.target.value.replace(
                        /\D/g,
                        ''
                      )
                    )
                  }
                  placeholder="77"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
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
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>
            </div>

            {selectedPackage && (
              <div className="mt-5 rounded-xl bg-gray-50 border p-4">
                <div className="font-bold">
                  {selectedPackage.name}
                </div>

                <div className="text-sm text-gray-600 mt-1">
                  سعر النظام:{' '}
                  {
                    selectedPackage.price
                  }
                </div>

                <div className="text-sm mt-1">
                  Profile في MikroTik:{' '}
                  <span className="font-bold">
                    {mappings[
                      selectedPackage.id
                    ] ||
                      'غير مربوط'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="button"
                onClick={
                  handlePreview
                }
                disabled={
                  creatingCards
                }
                className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50"
              >
                معاينة الأكواد
              </button>

              <button
                type="button"
                onClick={
                  handleCreateCards
                }
                disabled={
                  creatingCards ||
                  !selectedPackage ||
                  !mappings[
                    selectedPackage?.id
                  ]
                }
                className="rounded-xl bg-blue-600 text-white px-5 py-3 font-bold disabled:opacity-50"
              >
                {creatingCards
                  ? 'جارٍ إنشاء الكروت...'
                  : 'إنشاء الكروت فعليًا'}
              </button>
            </div>

            {previewCodes.length >
              0 && (
              <div className="mt-5">
                <h3 className="font-bold mb-3">
                  معاينة الأكواد
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-8 gap-2">
                  {previewCodes.map(
                    (code) => (
                      <div
                        key={code}
                        className="rounded-lg border bg-gray-50 px-3 py-2 text-center font-mono"
                      >
                        {code}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {creationResult && (
              <div className="mt-5 rounded-xl border p-4">
                <h3 className="font-bold text-lg">
                  نتيجة الإنشاء
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">
                      المطلوب
                    </div>

                    <div className="text-xl font-bold">
                      {
                        creationResult.requested
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-green-50 p-3">
                    <div className="text-xs text-green-700">
                      تم إنشاؤه في MikroTik
                    </div>

                    <div className="text-xl font-bold text-green-700">
                      {
                        creationResult.createdInMikrotik
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-3">
                    <div className="text-xs text-blue-700">
                      محفوظ في النظام
                    </div>

                    <div className="text-xl font-bold text-blue-700">
                      {
                        creationResult.savedInSupabase
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-red-50 p-3">
                    <div className="text-xs text-red-700">
                      فشل
                    </div>

                    <div className="text-xl font-bold text-red-700">
                      {
                        creationResult.failed
                      }
                    </div>
                  </div>
                </div>

                {creationResult
                  .results
                  ?.failed
                  ?.length >
                  0 && (
                  <div className="mt-4">
                    <h4 className="font-bold text-red-600 mb-2">
                      الكروت التي فشلت
                    </h4>

                    <div className="space-y-1">
                      {creationResult.results.failed.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={`${item.code}-${index}`}
                            className="text-sm border rounded-lg p-2"
                          >
                            <span className="font-mono font-bold">
                              {
                                item.code
                              }
                            </span>

                            <span className="text-gray-500 mr-2">
                              {
                                item.error
                              }
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
